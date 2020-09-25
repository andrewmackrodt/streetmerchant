import {NvidiaRegionInfo, regionInfos} from '../store/model/nvidia-api';
import {Print, logger} from '../logger';
import {Series, Store} from '../store/model';
import {config} from '../config';
import {get} from 'request';
import {nvidiaStockUrl} from '../store/model/helpers/nvidia';
import {promisify} from 'util';

const store: Store = {
	labels: {},
	links: [],
	name: 'nvidia-debug'
};

export async function getProductData(productId: number, country: string, regionInfo: NvidiaRegionInfo) {
	let productData: Record<string, any> | undefined;

	try {
		const response = await promisify(get)({
			headers: {
				'user-agent': config.page.userAgent
			},
			url: nvidiaStockUrl(productId, regionInfo.drLocale, regionInfo.currency)
		});

		productData = JSON.parse(response.body);

		if (typeof productData !== 'object' || productData === null) {
			throw new Error('Not a JSON object');
		}

		return productData;
	} catch (error) {
		logger.error(`Failed to retrieve product information for ${country}`);
		logger.error(error.message);
	}
}

async function verify() {
	for (const regionInfo of Array.from(regionInfos)) {
		const [country, data] = regionInfo;

		const verifyProductId = async (productId: number, series: Series) => {
			const productData = await getProductData(productId, country, data);
			const product = productData?.products?.product[0];

			if (!product) {
				logger.error(Print.message(`no product data ${productId}`, series, store, true));

				return;
			}

			let expectedSeriesDisplayName: string = series;

			if (series === 'test:series') {
				expectedSeriesDisplayName = '2060 SUPER';
			}

			const expectedDisplayName = `NVIDIA GEFORCE RTX ${expectedSeriesDisplayName}`;
			const displayName: string = product.displayName;
			const sku: string = product.sku;
			const price = product?.pricing?.listPrice;
			const serialized = JSON.stringify({country, displayName, price, series, sku});

			if (displayName === expectedDisplayName) {
				logger.info(Print.message(`product match: ${serialized}`, series, store, true));
			} else {
				logger.error(Print.message(`incorrect product: ${serialized}`, series, store, true));
			}
		};

		/* eslint-disable no-await-in-loop */
		if (data.fe2060SuperId) {
			await verifyProductId(data.fe2060SuperId, 'test:series');
		}

		if (data.fe3080Id) {
			await verifyProductId(data.fe3080Id, '3080');
		}

		if (data.fe3090Id) {
			await verifyProductId(data.fe3090Id, '3090');
		}
		/* eslint-enable no-await-in-loop */
	}
}

void verify();
