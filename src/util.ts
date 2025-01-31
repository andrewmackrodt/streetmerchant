import {unlinkSync} from 'fs';
import {Browser, Page, BrowserContext, HTTPRequest} from 'puppeteer';
import {StatusCodeRangeArray, Store} from './store/model';
import {config} from './config';
import {enableBlockerInPage} from './adblocker';
import {logger} from './logger';
import {handleDefaultContextProxy, nextStoreProxy} from './proxy';

// must be a require call unless converting project to use esm
const topUserAgents: string[] = require('top-user-agents/desktop');

export function getSleepTime(store: Store) {
  const minSleep = store.minPageSleep as number;
  return minSleep + Math.random() * ((store.maxPageSleep as number) - minSleep);
}

export async function delay(ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

export function noop() {
  // Do nothing
}

async function handleLowBandwidth(request: HTTPRequest) {
  if (!config.browser.lowBandwidth) {
    return false;
  }

  const typ = request.resourceType();
  if (typ === 'font' || typ === 'image') {
    try {
      await request.abort();
    } catch {
      logger.debug('Failed to abort request.');
    }

    return true;
  }

  return false;
}

export function isStatusCodeInRange(
  statusCode: number,
  range: StatusCodeRangeArray
) {
  for (const value of range) {
    let min: number;
    let max: number;
    if (typeof value === 'number') {
      min = value;
      max = value;
    } else {
      [min, max] = value;
    }

    if (min <= statusCode && statusCode <= max) {
      return true;
    }
  }

  return false;
}

// the main application loop does not have a way to interrupt async tasks, e.g.
// store lookup or browser close during a restart which leads to errors being
// thrown during routine application tasks; do not log the following errors:
const IGNORE_ERRORS_REGEXP = new RegExp(
  [
    'Connection closed',
    'Navigating frame was detached',
    'Requesting main frame too early',
    'Target\\.(attachToTarget|createTarget|(create|dispose)BrowserContext)',
    'TargetCloseError',
  ].join('|')
);

export async function usingPage<T>(
  browser: Browser,
  store: Store,
  cb: (page: Page, browser: Browser) => Promise<T>
) {
  const isDefaultContent = !config.browser.isIncognito;
  const storeProxy = nextStoreProxy(store);
  let context: BrowserContext | undefined;
  let page: Page | undefined;

  // proxy middleware is required if using the default context
  // and a store specific proxy as it cannot be set via
  // the chrome arg --proxy-server
  const registerProxyMiddleware = isDefaultContent && storeProxy;

  try {
    context = isDefaultContent
      ? browser.defaultBrowserContext()
      : await browser.createBrowserContext({proxyServer: storeProxy?.server});

    page = await context.newPage();

    page.setDefaultNavigationTimeout(config.page.timeout);
    await page.setRequestInterception(true);
    await page.setUserAgent(await getRandomUserAgent());

    // chrome does not support specifying username/password to --proxy-server
    // prefill basic auth popup for proxy authentication if either of:
    // - root proxy is used
    // - store proxy is used with custom context
    const credentials = !storeProxy
      ? config.browser.proxyCredentials
      : isDefaultContent
      ? undefined
      : storeProxy.credentials;

    if (credentials) {
      await page
        .authenticate({
          username: credentials.username,
          password: credentials.password,
        })
        .catch(err => {
          logger.error('error configuration proxy auth on page', err);
        });
    }

    const useAdBlock = !config.browser.lowBandwidth && !store.disableAdBlocker;

    if (useAdBlock) {
      await enableBlockerInPage(page);
    }

    page.on('request', async request => {
      if (await handleLowBandwidth(request)) {
        return;
      }

      if (registerProxyMiddleware) {
        if (page) {
          await handleDefaultContextProxy(page, storeProxy.toString(), request);
        } else {
          await request.abort().catch(() => {});
        }
        return;
      }

      try {
        await request.continue();
      } catch {
        logger.debug('Failed to continue request.');
      }
    });

    return await cb(page, browser);
  } finally {
    await doUsingPageCleanup(store, isDefaultContent, context, page).catch(
      logUnexpectedBrowsingError
    );
  }
}

export async function tryUsingPage<T>(
  browser: Browser,
  store: Store,
  cb: (page: Page, browser: Browser) => Promise<T | undefined>
) {
  return usingPage(browser, store, cb).catch(logUnexpectedBrowsingError);
}

async function doUsingPageCleanup(
  store: Store,
  isDefaultContent: boolean,
  context?: BrowserContext,
  page?: Page
) {
  if (!context) {
    // noop if context is undefined
    return;
  }

  if (isDefaultContent) {
    // close the finished page
    if (page) {
      await page.close().catch(() => {});
    }
    // clear browser cookies if using a store proxy
    if (
      store.currentProxyIndex !== undefined &&
      store.proxyList &&
      Number(store.proxyList?.length) > 1
    ) {
      const client = await context.browser().target().createCDPSession();
      await client.send('Network.clearBrowserCookies');
    }
  } else {
    // close the custom context
    await context.close();
  }
}

function logUnexpectedBrowsingError(err: unknown) {
  if (!err?.toString().match(IGNORE_ERRORS_REGEXP)) {
    logger.error(err);
  } else {
    logger.silly(err);
  }
}

export async function getRandomUserAgent(): Promise<string> {
  const deprecatedUserAgent = (
    process.env.USER_AGENT
      ? process.env.USER_AGENT.includes('\n')
        ? process.env.USER_AGENT.split('\n')
        : process.env.USER_AGENT.split(',')
      : []
  ).map(s => s.trim());

  if (deprecatedUserAgent.length > 0) {
    return deprecatedUserAgent[
      Math.floor(Math.random() * deprecatedUserAgent.length)
    ];
  }

  const userAgent =
    topUserAgents[Math.floor(Math.random() * topUserAgents.length)];
  logger.debug('user agent', {userAgent});
  return userAgent;
}

export function deleteFile(path: string) {
  try {
    unlinkSync(path);
  } catch (error: unknown) {
    logger.error('unable to delete file', error);
  }
}
