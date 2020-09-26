import {Page} from 'puppeteer';
import {StatusCodeRangeArray} from './store/model';
import {config} from './config';
import {disableBlockerInPage} from './adblocker';

export function getSleepTime() {
	return config.browser.minSleep + (Math.random() * (config.browser.maxSleep - config.browser.minSleep));
}

export async function delay(ms: number) {
	return new Promise(resolve => {
		setTimeout(resolve, ms);
	});
}

export function isStatusCodeInRange(statusCode: number, range: StatusCodeRangeArray) {
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

export async function closePage(page: Page) {
	if (!config.browser.lowBandwidth) {
		await disableBlockerInPage(page);
	}

	await page.close();
}
