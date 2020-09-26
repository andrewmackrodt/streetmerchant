import {Browser, Page, Response} from 'puppeteer';
import {adBlocker} from './adblocker';
import {closePage} from './util';
import {config} from './config';
import {logger} from './logger';
import puppeteer from 'puppeteer-extra';
import resourceBlock from 'puppeteer-extra-plugin-block-resources';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(stealthPlugin());

if (config.browser.lowBandwidth) {
	puppeteer.use(resourceBlock({
		blockedTypes: new Set(['image', 'font'] as const)
	}));
} else {
	puppeteer.use(adBlocker);
}

let browser: Browser;

export async function getBrowser(): Promise<Browser> {
	if (browser) {
		return browser;
	}

	const args: string[] = [];

	// Skip Chromium Linux Sandbox
	// https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md#setting-up-chrome-linux-sandbox
	if (config.browser.isTrusted) {
		args.push('--no-sandbox');
		args.push('--disable-setuid-sandbox');
	}

	// https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md#tips
	if (config.docker) {
		args.push('--disable-dev-shm-usage');
	}

	// Add the address of the proxy server if defined
	if (config.proxy.address) {
		args.push(`--proxy-server=http://${config.proxy.address}:${config.proxy.port}`);
	}

	browser = await puppeteer.launch({
		args,
		defaultViewport: {
			height: config.page.height,
			width: config.page.width
		},
		headless: config.browser.isHeadless
	});

	return browser;
}

export async function usingResponse<T>(
	browser: Browser,
	url: string,
	cb: (response: (Response | null), page: Page, browser: Browser) => Promise<T>
): Promise<T> {
	return usingPage(browser, async (page, browser) => {
		const response = await page.goto(url, {waitUntil: 'domcontentloaded'});

		return cb(response, page, browser);
	});
}

export async function usingPage<T>(browser: Browser, cb: (page: Page, browser: Browser) => Promise<T>): Promise<T> {
	const page = await browser.newPage();
	page.setDefaultNavigationTimeout(config.page.timeout);
	await page.setUserAgent(config.page.userAgent);

	try {
		return await cb(page, browser);
	} finally {
		try {
			await closePage(page);
		} catch (error) {
			logger.error(error);
		}
	}
}
