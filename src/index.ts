import {Stores} from './store/model';
import {getBrowser} from './puppeteer';
import {getSleepTime} from './util';
import {logger} from './logger';
import {tryLookupAndLoop} from './store';

/**
 * Starts the bot.
 */
async function main() {
	if (Stores.length === 0) {
		logger.error('✖ no stores selected', Stores);
		return;
	}

	const browser = await getBrowser();

	for (const store of Stores) {
		logger.debug('store links', {meta: {links: store.links}});
		if (store.setupAction !== undefined) {
			store.setupAction(browser);
		}

		setTimeout(tryLookupAndLoop, getSleepTime(), browser, store);
	}
}

/**
 * Will continually run until user interferes.
 */
try {
	void main();
} catch (error) {
	logger.error('✖ something bad happened, resetting nvidia-snatcher', error);
	void main();
}
