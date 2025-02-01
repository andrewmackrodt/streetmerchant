import Puppeteer, {Browser} from 'puppeteer';
import {config} from './config';
import {logger} from './logger';
import {parseProxy} from './proxy';

export async function launchBrowser(): Promise<Browser> {
  const args: string[] = [];

  // Skip Chromium Linux Sandbox
  // https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md#setting-up-chrome-linux-sandbox
  if (config.browser.isTrusted) {
    args.push('--no-sandbox');
    args.push('--disable-setuid-sandbox');
  }

  // https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md#tips
  // https://stackoverflow.com/questions/48230901/docker-alpine-with-node-js-and-chromium-headless-puppeter-failed-to-launch-c
  if (config.docker) {
    args.push('--disable-dev-shm-usage');
    args.push('--no-sandbox');
    args.push('--disable-setuid-sandbox');
    if (!config.browser.isHeadless) {
      args.push('--headless=new');
    }
    args.push('--disable-gpu');
    config.browser.open = false;
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
    logger.info('ℹ puppeteer config: ', args);
  }

  const browser = await Puppeteer.launch({
    args,
    defaultViewport: {
      height: config.page.height,
      width: config.page.width,
    },
    handleSIGHUP: false,
    handleSIGINT: false,
    handleSIGTERM: false,
    headless: config.browser.isHeadless,
  });

  const userAgent = await browser.userAgent();
  config.browser.userAgent = userAgent.replaceAll(/Headless/gi, '');

  return browser;
}
