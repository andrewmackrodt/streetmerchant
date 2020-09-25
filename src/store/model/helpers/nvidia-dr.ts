import {NvidiaRegionInfo, regionInfos} from '../nvidia-api';
import {Series} from '../store';
import {cardLandingPageUrl} from './nvidia';
import cheerio from 'cheerio';
import {config} from '../../../config';
import {get} from 'request';
import {logger} from '../../../logger';
import {promisify} from 'util';

interface LookupResult {
	fe2060SuperId: number | null;
	fe2060SuperIdConflict: boolean;
	fe2060SuperIdExisting: number | null;
	fe3080Id: number | null;
	fe3080IdConflict: boolean;
	fe3080IdExisting: number | null;
	fe3090Id: number | null;
	fe3090IdConflict: boolean;
	fe3090IdExisting: number | null;
}

export async function lookup(country: string, regionInfo?: NvidiaRegionInfo): Promise<LookupResult> {
	if (!regionInfo) {
		regionInfo = regionInfos.get(country);
	}

	if (!regionInfo) {
		throw new Error(`Unknown country ${country}`);
	}

	const result: LookupResult = {
		fe2060SuperId: null,
		fe2060SuperIdConflict: false,
		fe2060SuperIdExisting: regionInfo.fe2060SuperId,
		fe3080Id: null,
		fe3080IdConflict: false,
		fe3080IdExisting: regionInfo.fe3080Id,
		fe3090Id: null,
		fe3090IdConflict: false,
		fe3090IdExisting: regionInfo.fe3080Id
	};

	if (!regionInfo.siteLocale) {
		logger.warn(`Skipping country ${country}, siteLocale is not defined`);
		return result;
	}

	const elements = await Promise.all([
		getSeriesDocumentElement('test:series', country, regionInfo.siteLocale),
		getSeriesDocumentElement('3080', country, regionInfo.siteLocale),
		getSeriesDocumentElement('3090', country, regionInfo.siteLocale)
	]);

	const productIds = elements.map(element => {
		const productId = element?.find('div[data-digital-river-id]').attr()?.['data-digital-river-id']?.trim();
		if (productId) {
			const asNumber = Number.parseInt(productId, 10);
			if (asNumber > 0) {
				return asNumber;
			}
		}

		return null;
	});

	result.fe2060SuperId = productIds[0];
	result.fe2060SuperIdConflict = (regionInfo.fe2060SuperId ?? result.fe2060SuperId) !== result.fe2060SuperId;
	result.fe3080Id = productIds[1];
	result.fe3080IdConflict = (regionInfo.fe3080Id ?? result.fe3080Id) !== result.fe3080Id;
	result.fe3090Id = productIds[2];
	result.fe3090IdConflict = (regionInfo.fe3090Id ?? result.fe3090Id) !== result.fe3090Id;

	return result;
}

export async function lookupAll(print = false): Promise<Record<string, LookupResult>> {
	const result: Record<string, LookupResult> = {};

	/* eslint-disable no-await-in-loop */
	for (const regionInfoItem of Array.from(regionInfos)) {
		const [country, regionInfo] = regionInfoItem;
		const countryResult = await lookup(country, regionInfo);
		const {fe2060SuperId, fe3080Id, fe3090Id} = countryResult;

		result[country] = countryResult;

		/* eslint-disable @typescript-eslint/restrict-template-expressions */
		if (print) {
			logger.info(`country=${country}\ttest:series=${fe2060SuperId}\t3080=${fe3080Id}\t3090=${fe3090Id}`);
			if (countryResult.fe2060SuperIdConflict) {
				logger.error(`id mismatch series=test:series country=${country} actual=${fe2060SuperId} expected=${regionInfo.fe2060SuperId}`);
			}

			if (countryResult.fe3080IdConflict) {
				logger.error(`id mismatch series=3080 country=${country} actual=${fe3080Id} expected=${regionInfo.fe3080Id}`);
			}

			if (countryResult.fe3090IdConflict) {
				logger.error(`id mismatch series=3090 country=${country} actual=${fe3090Id} expected=${regionInfo.fe3090Id}`);
			}
		}
		/* eslint-enable @typescript-eslint/restrict-template-expressions */
	}
	/* eslint-enable no-await-in-loop */

	return result;
}

async function getSeriesDocumentElement(series: Series, country: string, siteLocale: string): Promise<cheerio.Cheerio | null> {
	let [language, region] = siteLocale.split('-');
	region = region.toUpperCase();
	const langLocaleProperCase = `${language}-${region}`;

	const originalCountry = config.store.country;

	try {
		config.store.country = country;

		const response = await promisify(get)({
			headers: {
				'accept-language': `${langLocaleProperCase}, ${language};q=0.9, en;q=0.8, *;q=0.5`,
				cookie: `nvuserpreflang=${siteLocale}`,
				'user-agent': config.page.userAgent
			},
			url: cardLandingPageUrl(series)
		});

		if (typeof response.body !== 'string' || response.body.length === 0) {
			throw new Error('Unreadable response');
		}

		return cheerio.load(response.body).root();
	} catch (error) {
		console.error(`Failed to retrieve product page for country ${country}`);
		console.error(error.message);
		return null;
	} finally {
		config.store.country = originalCountry;
	}
}
