import {Browser, HTTPResponse, Page} from 'puppeteer';
import * as abortctl from '../abortctl';
import {getStores, Link, Store} from './model';
import {Print, logger} from '../logger';
import {Selector, getPrice, pageIncludesLabels} from './includes-labels';
import {
  delay,
  getSleepTime,
  isStatusCodeInRange,
  logUnexpectedError,
} from '../util';
import {config} from '../config';
import {refreshLinksBuilder} from './fetch-links';
import {filterStoreLink} from './filter';
import open from 'open';
import {processBackoffDelay} from './model/helpers/backoff';
import {sendNotification} from '../messaging';
import {handleCaptchaAsync} from './captcha-handler';
import {promises as fs} from 'fs';
import path from 'path';
import {tryUsingPage} from '../browser';
import {addTimeout} from '../timers';

const inStock: Record<string, boolean> = {};

/**
 * Responsible for looking up information about a each product within
 * a `Store`. It's important that we ignore `no-await-in-loop` here
 * because we don't want to get rate limited within the same store.
 *
 * @param browser Puppeteer browser.
 * @param store Vendor of items.
 */
async function lookup(browser: Browser, store: Store) {
  if (!storeShouldRun(store)) {
    // store has been disabled or main application loop is stopping
    return;
  }

  await refreshLinksBuilder(browser, store);

  /* eslint-disable no-await-in-loop */
  for (const link of store.links) {
    if (!storeShouldRun(store)) {
      // store has been disabled or main application loop is stopping
      return;
    }

    if (!filterStoreLink(link)) {
      // filter for store links within the lookup loop as watched brands, series
      // etc may have been updated externally via the web interface
      continue;
    }

    if (config.page.inStockWaitTime && inStock[link.url]) {
      logger.info(Print.inStockWaiting(link, store, true));
      continue;
    }

    await tryUsingPage<void>(browser, store, async page => {
      if (store.captchaDeterrent) {
        await runCaptchaDeterrent(browser, store, page);
      }

      let statusCode = 0;

      try {
        statusCode = await lookupIem(browser, store, page, link);
      } catch (error: unknown) {
        if (store.currentProxyIndex !== undefined && store.proxyList) {
          const proxy = `${store.currentProxyIndex + 1}/${
            store.proxyList.length
          }`;
          logger.error(
            `✖ [${proxy}] [${store.name}] ${link.brand} ${link.series} ${
              link.model
            } - ${(error as Error).message}`
          );
        } else {
          logger.error(
            `✖ [${store.name}] ${link.brand} ${link.series} ${link.model} - ${
              (error as Error).message
            }`
          );
        }
        const client = await page.target().createCDPSession();
        await client.send('Network.clearBrowserCookies');
      }

      // Must apply backoff before closing the page, e.g. if CloudFlare is
      // used to detect bot traffic, it introduces a 5 second page delay
      // before redirecting to the next page
      await processBackoffDelay(store, link, statusCode);
    });
  }
  /* eslint-enable no-await-in-loop */
}

async function lookupIem(
  browser: Browser,
  store: Store,
  page: Page,
  link: Link
): Promise<number> {
  const givenWaitFor = store.waitUntil ? store.waitUntil : 'networkidle0';
  const response: HTTPResponse | null = await page.goto(link.url, {
    waitUntil: givenWaitFor,
  });

  const successStatusCodes = store.successStatusCodes ?? [[0, 399]];
  const statusCode = await handleResponse(browser, store, page, link, response);

  if (!isStatusCodeInRange(statusCode, successStatusCodes)) {
    return statusCode;
  }

  if (await isItemInStock(store, page, link)) {
    const givenUrl =
      link.cartUrl && config.store.autoAddToCart ? link.cartUrl : link.url;
    logger.info(`${Print.inStock(link, store, true)}\n${givenUrl}`);

    if (config.browser.open) {
      await (link.openCartAction === undefined
        ? open(givenUrl)
        : link.openCartAction(browser));
    }

    sendNotification(link, store);

    if (config.page.inStockWaitTime) {
      inStock[link.url] = true;

      addTimeout(() => {
        inStock[link.url] = false;
      }, 1000 * config.page.inStockWaitTime);
    }

    if (config.page.screenshot) {
      logger.debug('ℹ saving screenshot');

      await fs.mkdir(config.page.screenshotDir, {recursive: true});
      link.screenshot = path.join(
        config.page.screenshotDir,
        `success-${Date.now()}.png`
      );
      await page.screenshot({
        path: link.screenshot,
        fullPage: config.page.screenshotFullPage,
      });
    }
  }

  return statusCode;
}

// eslint-disable-next-line max-params
async function handleResponse(
  browser: Browser,
  store: Store,
  page: Page,
  link: Link,
  response?: HTTPResponse | null,
  recursionDepth = 0
) {
  if (!response) {
    logger.debug(Print.noResponse(link, store, true));
  }

  const successStatusCodes = store.successStatusCodes ?? [[0, 399]];
  let statusCode = response?.status() ?? 0;
  if (!isStatusCodeInRange(statusCode, successStatusCodes)) {
    if (statusCode === 429) {
      logger.warn(Print.rateLimit(link, store, true));
    } else if ([403, 503].includes(statusCode)) {
      if (await checkIsCloudflare(store, page, link, response)) {
        if (recursionDepth > 4) {
          logger.warn(Print.recursionLimit(link, store, true));
        } else {
          const response: HTTPResponse | null = await page.waitForNavigation({
            waitUntil: 'networkidle0',
          });
          recursionDepth++;
          const tryStatusCode = await handleResponse(
            browser,
            store,
            page,
            link,
            response,
            recursionDepth
          );
          if (tryStatusCode > 0) {
            statusCode = tryStatusCode;
          }
        }
      } else {
        logger.warn(Print.badStatusCode(link, store, statusCode, true));
      }
    } else {
      logger.warn(Print.badStatusCode(link, store, statusCode, true));
    }
  }

  return statusCode;
}

async function checkIsCloudflare(
  store: Store,
  page: Page,
  link: Link,
  response?: HTTPResponse | null
) {
  // inspect the response headers to determine if a cloudflare challenge has been issued
  if (
    response?.headers()['cf-mitigated'] === 'challenge' &&
    response.headers()['cf-ray']
  ) {
    logger.warn(Print.cloudflare(link, store, true));
    return true;
  }

  // otherwise fall back to inspecting the dom, is this needed since checking headers?
  const baseOptions: Selector = {
    requireVisible: true,
    selector: 'body',
    type: 'textContent',
  };

  const cloudflareLabels = [
    {
      container: 'div[class="attribution"] a[rel="noopener noreferrer"]',
      text: ['Cloudflare'],
    },
    {
      text: ['window._cf_chl_opt='],
    },
  ];

  const checks = await Promise.all(
    cloudflareLabels.map(label => pageIncludesLabels(page, label, baseOptions))
  );

  if (checks.some(result => Boolean(result))) {
    logger.warn(Print.cloudflare(link, store, true));
    return true;
  }

  return false;
}

async function isItemInStock(
  store: Store,
  page: Page,
  link: Link
): Promise<boolean> {
  const baseOptions: Selector = {
    requireVisible: false,
    selector: store.labels.container ?? 'body',
    type: 'textContent',
  };

  if (store.labels.captcha) {
    if (await pageIncludesLabels(page, store.labels.captcha, baseOptions)) {
      logger.warn(Print.captcha(link, store, true));
      if (config.captchaHandler.service && store.labels.captchaHandler) {
        logger.debug(`[${store.name}] captcha handler called`);
        if (!(await handleCaptchaAsync(page, store))) {
          logger.warn(`[${store.name}] captcha handler failed`);
          return false;
        } else {
          logger.debug(`[${store.name}] captcha handler done, checking item`);
          return await isItemInStock(store, page, link);
        }
      } else {
        logger.debug(`[${store.name}] captcha handler skipped`);
        await delay(getSleepTime(store));
        return false;
      }
    }
  }

  if (store.labels.bannedSeller) {
    if (
      await pageIncludesLabels(page, store.labels.bannedSeller, baseOptions)
    ) {
      logger.warn(Print.bannedSeller(link, store, true));
      return false;
    }
  }

  if (store.labels.outOfStock) {
    if (await pageIncludesLabels(page, store.labels.outOfStock, baseOptions)) {
      logger.info(Print.outOfStock(link, store, true));
      return false;
    }
  }

  if (link.labels?.inStock) {
    const options = {
      ...baseOptions,
      requireVisible: true,
      type: 'outerHTML' as const,
    };

    if (!(await pageIncludesLabels(page, link.labels.inStock, options))) {
      logger.info(Print.outOfStock(link, store, true));
      return false;
    }
  }

  if (store.labels.inStock) {
    const options = {
      ...baseOptions,
      requireVisible: true,
      type: 'outerHTML' as const,
    };

    if (!(await pageIncludesLabels(page, store.labels.inStock, options))) {
      logger.info(Print.outOfStock(link, store, true));
      return false;
    }
  }

  if (store.labels.maxPrice) {
    const maxPrice = config.store.maxPrice.series[link.series];

    link.price = await getPrice(page, store.labels.maxPrice, baseOptions);

    if (link.price && link.price > maxPrice && maxPrice > 0) {
      logger.info(Print.maxPrice(link, store, maxPrice, true));
      return false;
    }
  }

  return true;
}

async function runCaptchaDeterrent(browser: Browser, store: Store, page: Page) {
  const successStatusCodes = store.successStatusCodes ?? [[0, 399]];
  let statusCode = 0;
  let deterrentLinks: string[] = [];

  logger.debug(`[${store.name}] Navigating to random anti-captcha page...`);

  if (store.captchaDeterrent?.hardLinks?.length) {
    deterrentLinks = deterrentLinks.concat(store.captchaDeterrent.hardLinks);
  }

  if (store.captchaDeterrent?.searchUrl) {
    if (store.captchaDeterrent.searchTerms) {
      store.captchaDeterrent.searchTerms.forEach(element =>
        deterrentLinks.push(
          store.captchaDeterrent?.searchUrl
            ? store.captchaDeterrent.searchUrl.replace('%%s', element)
            : ''
        )
      );
    }
  }

  if (deterrentLinks.length > 0) {
    const link: Link = {
      brand: 'captcha-deterrent',
      model: 'captcha-deterrent',
      series: 'captcha-deterrent',
      url: deterrentLinks[Math.floor(Math.random() * deterrentLinks.length)],
    };
    logger.debug(`Selected captcha-deterrent link: ${link.url}`);

    try {
      const givenWaitFor = store.waitUntil ? store.waitUntil : 'networkidle0';
      const response: HTTPResponse | null = await page.goto(link.url, {
        waitUntil: givenWaitFor,
      });
      statusCode = await handleResponse(browser, store, page, link, response);
      await new Promise<void>(resolve => addTimeout(resolve, 3000));
    } catch (error: unknown) {
      logger.error(error);
    }

    if (!isStatusCodeInRange(statusCode, successStatusCodes)) {
      logger.warn(
        `✖ [${store.name}] - Failed to navigate to anti-captcha target: ${link.url}`
      );
    }
  }
}

export async function tryLookupAndLoop(browser: Browser, store: Store) {
  // delay starting the loop to reduce the amount of simultaneous requests
  // during application start or when enabling new stores via the web api
  await delay(getSleepTime(store));

  if (store.setupAction) {
    await store.setupAction(browser);
  }

  logger.debug('store links', {meta: {links: store.links}});

  while (storeShouldRun(store)) {
    try {
      logger.silly(`[${store.name}] Starting lookup...`);
      await lookup(browser, store);
    } catch (error: unknown) {
      logUnexpectedError(error);
    }

    if (storeShouldRun(store)) {
      const sleep = getSleepTime(store);
      logger.silly(`[${store.name}] Lookup done, next one in ${sleep} ms`);
      await delay(sleep);
    }
  }
}

function storeShouldRun(store: Store) {
  return getStores().has(store.name) && abortctl.available('app.running');
}
