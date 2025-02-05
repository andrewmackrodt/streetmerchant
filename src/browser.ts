import type {Browser, LaunchOptions} from 'puppeteer';
import Puppeteer from 'puppeteer';
import {config} from './config';
import {logger} from './logger';
import {parseProxy} from './proxy';

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

  const userAgent = await browser.userAgent();
  config.browser.userAgent = userAgent.replaceAll(/Headless/gi, '');

  return browser;
}
