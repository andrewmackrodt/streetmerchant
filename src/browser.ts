import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {sync as deleteSync} from 'del';
import type {Browser, CDPSession, LaunchOptions} from 'puppeteer';
import {Page} from 'puppeteer';
import Puppeteer from 'puppeteer';
import * as abortctl from './abortctl';
import {disableBlockerInPage, enableBlockerInPage} from './adblocker';
import {config} from './config';
import {logger} from './logger';
import {onRequest, onResponse} from './handlers';
import {nextStoreProxy, parseProxy, Proxy} from './proxy';
import type {Link, Store} from './store/model';
import {getRandomUserAgent, logUnexpectedError} from './util';

enum CookiePolicy {
  DEFAULT = 'default',
  KEEP_WHILE_200 = 'keep_while_200',
}

interface BrowserInstance {
  browser: Promise<Browser>;
  proxy?: Proxy;
  userDataDir: string;
}

const instances = new Map<Store, BrowserInstance>();
const cookiePolicy = getCookiePolicy();
const defaultProxy = parseProxy(config.proxy.address);

export async function usingBrowser<T>(
  store: Store,
  cb: (browser: Browser, store: Store) => Promise<T>
) {
  const instance = instances.get(store);
  const proxy = nextStoreProxy(store) ?? defaultProxy;
  let browser: Browser | undefined;

  if (instance) {
    browser = await instance.browser;
    if (proxy !== instance.proxy) {
      logger.debug(
        `ℹ [${store.name}] restarting browser instance with proxy: ${proxy.server}`
      );
      await browser.close();
      browser = undefined;
      instances.delete(store);
    } else {
      logger.debug(`ℹ [${store.name}] reusing browser instance`);
    }
  } else {
    logger.debug(`ℹ [${store.name}] creating new browser instance`);
  }

  abortctl.assert('browser');

  if (!browser) {
    const userDataDir = path.join(config.browser.profileParentDir, store.name);
    // delete everything in the Default profile directory except Cache;
    // this helps prevent a chrome/puppeteer issue where proxy authentication
    // will cause the error ERR_INVALID_AUTH_CREDENTIALS when the browser
    // is re-opened with a new proxy, even if the credentials are the same
    const userDataDelGlobs = [
      userDataDir.replaceAll('\\', '/') + '/Default/*',
      '!' + userDataDir.replaceAll('\\', '/') + '/Default/Cache',
    ];
    deleteSync(userDataDelGlobs, {force: true});
    const userAgent = await getDefaultUserAgent();
    const browserPromise = launchBrowser({userDataDir}, proxy, userAgent);
    instances.set(store, {browser: browserPromise, proxy, userDataDir});
    browser = await browserPromise;
  }

  abortctl.assert('browser');

  return await cb(browser, store);
}

export async function abortBrowserContexts() {
  abortctl.destroy('browser');

  await Promise.all(
    [...instances.entries()].map(async ([store, {browser: browserPromise}]) => {
      try {
        const browser = await browserPromise;
        await browser.close();
      } catch (error) {
        logger.error('✖ failed to close browser', error);
      } finally {
        instances.delete(store);
      }
    })
  );
}

export function enableBrowserContexts() {
  abortctl.create('browser');
}

export async function launchBrowser(
  options?: LaunchOptions,
  proxy?: Proxy,
  userAgent?: string
): Promise<Browser> {
  const args: string[] = [
    '--disable-blink-features=AutomationControlled',
    `--window-size=${config.page.width},${config.page.height}`,
  ];

  if (userAgent) {
    args.push(`--user-agent=${userAgent}`);
  }

  // Skip Chromium Linux Sandbox (links possibly outdated)
  // - https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md#setting-up-chrome-linux-sandbox
  // - https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md#tips
  // - https://stackoverflow.com/questions/48230901/docker-alpine-with-node-js-and-chromium-headless-puppeter-failed-to-launch-c
  if (config.browser.isTrusted || config.docker) {
    args.push('--no-sandbox');
  }

  if (config.docker) {
    config.browser.open = false;
  }

  // Enable headless (force if docker)
  if (config.browser.isHeadless || config.docker || options?.headless) {
    if (options && 'headless' in options) {
      options = Object.assign({}, options);
      delete options.headless;
    }

    args.push(
      '--headless=new',
      '--ozone-platform-hint=auto',
      `--ozone-override-screen-size=${config.page.width},${config.page.height}`
    );

    // TODO add a feature flag to make GPU enablement opt-in
    let gpuAcceleration = false;

    // using a GPU may help reduce system load and potentially reduce anti-bot
    // detection, although is unconfirmed; it does however help pass
    // https://deviceandbrowserinfo.com/are_you_a_bot
    switch (os.platform()) {
      // is metal renderer always available on mac? only tested with m1
      case 'darwin':
        // mac uses `--angle=` versus `--use-angle=` on linux
        args.push('--angle=metal');
        gpuAcceleration = true;
        break;

      case 'linux':
        // only enable if /dev/dri/renderD128 exists; this is a primitive check
        if (fs.existsSync('/dev/dri/renderD128')) {
          // enable only one of GL or Vulkan, Vulkan takes precedence if both set
          args.push(
            // enable GL (default on Linux)
            // only passes are_you_a_bot when `--use-angle=gl` but not available for nvidia gpu)
            //'--use-angle=gl-egl'

            // enable Vulkan (non-default on Linux)
            // https://github.com/jasonmayes/headless-chrome-nvidia-t4-gpu-support/blob/main/README.md#4-run-nodejs-code-to-use-and-automate-headless-chrome
            '--disable-vulkan-surface',
            '--enable-features=Vulkan',
            '--enable-unsafe-webgpu',
            '--use-angle=vulkan',

            // enable Accelerated Video Encoder (non-default on Linux)
            // https://source.chromium.org/chromium/chromium/src/+/main:media/base/media_switches.cc;l=694?q=AcceleratedVideoDecodeLinuxGL&ss=chromium
            '--enable-features=AcceleratedVideoEncoder'
          );
          gpuAcceleration = true;
        }
        break;
    }

    if (!gpuAcceleration) {
      args.push('--disable-gpu');
    }
  }

  // Add the address of the proxy server if defined
  if (proxy) {
    args.push(`--proxy-server=${proxy.server}`);
  }

  if (args.length > 0) {
    logger.debug('ℹ puppeteer config: ', args.toSorted());
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

  // delete cookies when the browser is started to clean up any lingering
  // cookies which may have been created between the last run, clearing
  // cookies and closing the browser context
  await withCdpSession(browser, async client =>
    client.send('Network.clearBrowserCookies')
  );

  const openPages = new Map<Page, Promise<void>>();

  // monkey patch newPage method to ensure that certain options are always set
  await setNewPageDefaultOptions(openPages, browser, proxy);

  return browser;
}

export async function usingPage<T>(
  browser: Browser,
  store: Store,
  cb: (page: Page, browser: Browser) => Promise<T>
) {
  const page = await browser.newPage();
  try {
    if (store.disableAdBlocker) {
      await disableBlockerInPage(page);
    }
    return await cb(page, browser);
  } finally {
    await doUsingPageCleanup(store, browser, page).catch(logUnexpectedError);
  }
}

type UsingPageCallback<T> = (
  page: Page,
  browser: Browser
) => Promise<T | undefined>;

export async function tryUsingPage<T>(
  browser: Browser,
  store: Store,
  cb: (page: Page, browser: Browser) => Promise<T | undefined>
): Promise<T>;

export async function tryUsingPage<T>(
  store: Store,
  cb: (page: Page, browser: Browser) => Promise<T | undefined>
): Promise<T>;

export async function tryUsingPage<T>(
  p1: Browser | Store,
  p2: Store | UsingPageCallback<T>,
  p3?: UsingPageCallback<T>
): Promise<T | undefined> {
  let result: T | undefined;
  try {
    if (arguments.length === 3) {
      result = await usingPage(
        p1 as Browser,
        p2 as Store,
        p3 as UsingPageCallback<T>
      );
    } else {
      result = await usingBrowser(
        p1 as Store,
        async (browser, store) =>
          await usingPage(browser, store, p2 as UsingPageCallback<T>)
      );
    }
  } catch (error) {
    logUnexpectedError(error);
  }
  return result;
}

export async function processCookieHandling(
  browser: Browser,
  store: Store,
  link: Link,
  statusCode: number
) {
  let deleteCookies = false;
  switch (cookiePolicy) {
    case CookiePolicy.KEEP_WHILE_200:
      if (statusCode !== 200) {
        logger.debug(
          `ℹ [${store.name}] clearing browser cookies due to non-200 status code: ${statusCode}`
        );
        deleteCookies = true;
      }
      break;
  }
  if (deleteCookies) {
    await withCdpSession(browser, async client =>
      client.send('Network.clearBrowserCookies')
    );
  }
}

/**
 * Sets default options for new pages created by the browser, such as navigation timeout, request interception,
 * user agent, and proxy authentication.
 *
 * @param {Set<Page>} pages - A set to track and manage pages in the browser instance.
 * @param {Browser} browser - The browser instance to monitor and customize.
 * @param {Proxy} [proxy] - Optional proxy settings to be applied to the pages, including authentication credentials.
 * @param {string} [userAgent] - Optional user agent string to override the default. Defaults to a random user agent if not specified.
 *
 * @return {Promise<void>} Resolves when the default options are set, and appropriate listeners are attached.
 */
async function setNewPageDefaultOptions(
  pages: Map<Page, Promise<void>>,
  browser: Browser,
  proxy?: Proxy
): Promise<void> {
  const targetCreated = async (page: Page) => {
    let promise = pages.get(page);

    if (promise) {
      return promise;
    }

    // eslint-disable-next-line no-async-promise-executor
    promise = new Promise<void>(async resolve => {
      try {
        page.setDefaultNavigationTimeout(config.page.timeout);

        const promises: Promise<void>[] = [
          page.setRequestInterception(true),
          enableBlockerInPage(page),
        ];

        if (proxy?.credentials) {
          promises.push(page.authenticate(proxy.credentials));
        }

        if (!config.browser.userAgentKeepDefault) {
          const userAgent = getRandomUserAgent();
          promises.push(page.setUserAgent(userAgent));
        }

        await Promise.all(promises);

        // custom handlers must be registered after the above setup,
        // e.g. so that the ad blocker runs first
        page.on('request', request => onRequest(page, request));
        page.on('response', response => onResponse(page, response));

        resolve();
      } catch (err) {
        if (!abortctl.available('app.running')) {
          logger.error(`✖ error registering new page defaults: ${err}`);
        }
        resolve();
      }
    });

    pages.set(page, promise);
  };

  await Promise.all([...(await browser.pages()).values()].map(targetCreated));

  browser.on('targetcreated', async target => {
    const maybePage = await target.page();
    if (maybePage) {
      await targetCreated(maybePage);
    }
  });

  browser.on('targetdestroyed', async target => {
    const maybePage = await target.page();
    if (maybePage) {
      pages.delete(maybePage);
    }
  });

  const _newPage = browser.newPage;

  browser.newPage = async () => {
    const page = await _newPage.bind(browser)();
    await targetCreated(page);
    return page;
  };
}

async function doUsingPageCleanup(store: Store, browser: Browser, page: Page) {
  await page.close({runBeforeUnload: false});

  if (cookiePolicy === CookiePolicy.DEFAULT) {
    await withCdpSession(browser, async client =>
      client.send('Network.clearBrowserCookies')
    );
  }
}

let defaultUserAgent: string | undefined;

async function getDefaultUserAgent(): Promise<string | undefined> {
  if (defaultUserAgent || !config.browser.userAgentKeepDefault) {
    return defaultUserAgent;
  }

  let browser: Browser | undefined;

  try {
    browser = await launchBrowser({
      headless: true,
      userDataDir: path.join(config.browser.profileParentDir, 'default'),
    });

    defaultUserAgent = await browser.userAgent();

    // remove headless from the default user agent
    if (defaultUserAgent.includes('Headless')) {
      defaultUserAgent = defaultUserAgent.replaceAll(/headless/gi, '');
    }
  } catch {
    // noop
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        // noop
      }
    }
  }

  return defaultUserAgent;
}

async function withCdpSession<T>(
  browserOrPage: Browser | Page,
  cb: (client: CDPSession) => Promise<T>
) {
  let isNewPage: boolean;
  let page: Page;
  if (browserOrPage instanceof Page) {
    page = browserOrPage;
    isNewPage = false;
  } else {
    const pages = await browserOrPage.pages();
    // pages should always be at least 0 or the browser would be closed
    // but keep the type checker happy
    isNewPage = pages.length === 0;
    if (isNewPage) {
      page = await browserOrPage.newPage();
    } else {
      page = pages[0];
    }
  }
  const client = await page.createCDPSession();
  try {
    return await cb(client);
  } finally {
    if (isNewPage) {
      await page.close({runBeforeUnload: false}).catch(() => {});
    }
  }
}

function getCookiePolicy(): CookiePolicy {
  let cookiePolicy: CookiePolicy;
  if (
    (Object.values(CookiePolicy) as string[]).includes(
      config.browser.cookiePolicy.toLowerCase()
    )
  ) {
    cookiePolicy = config.browser.cookiePolicy as CookiePolicy;
  } else if (config.browser.cookiePolicy === '') {
    cookiePolicy = CookiePolicy.DEFAULT;
  } else {
    logger.warn(
      `✖ invalid value COOKIE_POLICY=${config.browser.cookiePolicy} defaulting to: ${CookiePolicy.DEFAULT}`
    );
    cookiePolicy = CookiePolicy.DEFAULT;
  }
  logger.debug(`ℹ using cookie policy: ${cookiePolicy}`);
  return cookiePolicy;
}
