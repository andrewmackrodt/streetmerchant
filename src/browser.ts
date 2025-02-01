import type {Browser, BrowserContext, LaunchOptions, Page} from 'puppeteer';
import Puppeteer from 'puppeteer';
import {enableBlockerInPage} from './adblocker';
import {config} from './config';
import {logger} from './logger';
import {onRequest, tryAbortRequest} from './handlers';
import {nextStoreProxy, parseProxy} from './proxy';
import {Store} from './store/model';
import {getRandomUserAgent, logUnexpectedError} from './util';

export async function launchBrowser(options?: LaunchOptions): Promise<Browser> {
  const args: string[] = [
    '--disable-blink-features=AutomationControlled',
    `--window-size=${config.page.width},${config.page.height}`,
  ];

  // Skip Chromium Linux Sandbox
  // https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md#setting-up-chrome-linux-sandbox
  if (config.browser.isTrusted) {
    args.push('--disable-setuid-sandbox');
    args.push('--no-sandbox');
  }

  // https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md#tips
  // https://stackoverflow.com/questions/48230901/docker-alpine-with-node-js-and-chromium-headless-puppeter-failed-to-launch-c
  if (config.docker) {
    args.push('--disable-dev-shm-usage');
    args.push('--disable-gpu');
    args.push('--disable-setuid-sandbox');
    args.push('--no-sandbox');
    config.browser.open = false;
  }

  // Enable headless (force if docker)
  if (config.browser.isHeadless || config.docker) {
    args.push(
      '--headless=new',
      `--ozone-override-screen-size=${config.page.width},${config.page.height}`
    );
  }

  // Add the address of the proxy server if defined
  if (config.proxy.address) {
    const proxy = parseProxy(config.proxy.address);
    args.push(`--proxy-server=${proxy.server}`);
    if (proxy.credentials) {
      config.browser.proxyCredentials = proxy.credentials;
    }
  }

  if (args.length > 0) {
    logger.info('ℹ puppeteer config: ', args.toSorted());
  }

  const browser = await Puppeteer.launch({
    args,
    defaultViewport: null,
    handleSIGHUP: false,
    handleSIGINT: false,
    handleSIGTERM: false,
    headless: false, // explicitly specified in args
    ...options,
  });

  if (!config.browser.userAgent) {
    const userAgent = await browser.userAgent();
    config.browser.userAgent = userAgent.replaceAll(/Headless/gi, '');
  }

  return browser;
}

export async function usingPage<T>(
  browser: Browser,
  store: Store,
  cb: (page: Page, browser: Browser) => Promise<T>
) {
  const isDefaultContent = !config.browser.isIncognito;
  const storeProxy = nextStoreProxy(store);
  let context: BrowserContext | undefined;
  let page: Page | undefined;

  try {
    context = isDefaultContent
      ? browser.defaultBrowserContext()
      : await browser.createBrowserContext({proxyServer: storeProxy?.server});

    page = await context.newPage();

    page.setDefaultNavigationTimeout(config.page.timeout);
    await page.setRequestInterception(true);
    const userAgent = getRandomUserAgent();
    if (userAgent) {
      await page.setUserAgent(userAgent);
    }

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

    page.on('request', request => {
      if (page) {
        onRequest(page, request, isDefaultContent, storeProxy);
      } else {
        logger.debug(`page not defined, aborting request: ${request.url()}`);
        tryAbortRequest(request);
      }
    });

    return await cb(page, browser);
  } finally {
    await doUsingPageCleanup(store, isDefaultContent, context, page).catch(
      logUnexpectedError
    );
  }
}

export async function tryUsingPage<T>(
  browser: Browser,
  store: Store,
  cb: (page: Page, browser: Browser) => Promise<T | undefined>
) {
  return usingPage(browser, store, cb).catch(logUnexpectedError);
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
    if (page) {
      // close the finished page
      await page.close().catch(() => {});

      // clear browser cookies if using a store proxy
      if (
        store.currentProxyIndex !== undefined &&
        store.proxyList &&
        Number(store.proxyList?.length) > 1 &&
        page
      ) {
        const client = await page.target().createCDPSession();
        await client.send('Network.clearBrowserCookies');
      }
    }
  } else {
    // close the custom context
    await context.close();
  }
}
