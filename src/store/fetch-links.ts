import {Link, Series, Store} from './model';
import {Print, logger} from '../logger';
import {Browser} from 'puppeteer';
import * as cheerio from 'cheerio';
import {filterSeries} from './filter';
import {isStatusCodeInRange, tryUsingPage} from '../util';

type StoreWithLinksBuilder = Store & Required<Pick<Store, 'linksBuilder'>>;

const nextRunTimes: Record<string, number> = {};

function getRefreshKey(store: Store, series: Series, url: string) {
  return [store.name, series, url].join(':');
}

export async function refreshLinksBuilder(browser: Browser, store: Store) {
  const seriesUrlList =
    store.linksBuilder?.urls.filter(({series}) => filterSeries(series)) ?? [];

  if (seriesUrlList.length === 0) {
    return;
  }

  try {
    const promises: Array<Promise<void>> = [];

    for (const {series, url} of seriesUrlList) {
      logger.debug(
        Print.message('finding product links', series, store, true, true)
      );

      const urls = Array.isArray(url) ? url : [url];

      urls.map(url =>
        promises.push(
          refreshLink(browser, store as StoreWithLinksBuilder, series, url)
        )
      );
    }

    await Promise.all(promises);
  } catch (error: unknown) {
    logger.error(error);
  }
}

async function refreshLink(
  browser: Browser,
  store: StoreWithLinksBuilder,
  series: Series,
  url: string
) {
  const linksBuilder = store.linksBuilder;
  const refreshKey = getRefreshKey(store, series, url);

  if (refreshKey in nextRunTimes && nextRunTimes[refreshKey] > Date.now()) {
    return;
  }

  logger.debug(
    Print.message(`refreshing links: ${url}`, series, store, true, true)
  );

  const waitUntil = linksBuilder.waitUntil
    ? linksBuilder.waitUntil
    : 'domcontentloaded';

  const waitForSelector =
    linksBuilder.waitForSelector ??
    (linksBuilder.builder.options
      ? `${linksBuilder.builder.options.productsSelector} > *`
      : undefined);

  await tryUsingPage(browser, store, async page => {
    let response = await page.goto(url, {waitUntil});
    let status = response?.status() ?? 0;

    if ([0, 403].includes(status) && response?.headers()['cf-ray']) {
      const pageHostname = new URL(url).hostname;

      // wait upto 15 seconds for verification to redirect to the main page
      response = await page
        .waitForResponse(
          response =>
            response.request().isNavigationRequest() &&
            new URL(response.url()).hostname === pageHostname &&
            isStatusCodeInRange(response.status(), [200, 299]),
          {timeout: 15000}
        )
        .catch(() => null);

      status = response?.status() ?? 0;

      if (isStatusCodeInRange(status, [200, 299])) {
        await page
          .waitForNetworkIdle({concurrency: 2, timeout: 10000})
          .catch(() => null);
      }
    }

    if (waitForSelector) {
      await page.waitForSelector(waitForSelector);
    }

    const html = await page.content();

    // default next refresh in 15 minutes
    let ttl = 15 * 60 * 1000;

    if (html) {
      const docElement = cheerio.load(html).root();
      const links = linksBuilder.builder(docElement, series);

      addNewLinks(store, links, series);

      // if links were discovered, respect ttl set by the linksBuilder object
      // or default to INF (do not refresh); otherwise refresh in 15m when
      // no links were discovered
      ttl =
        linksBuilder.ttl ?? links.length === 0 ? ttl : Number.POSITIVE_INFINITY;
    } else {
      logger.error(Print.message('NO RESPONSE', series, store, true));
    }

    logger.debug(
      Print.message(
        `next refresh in ${ttl / 1000} seconds: ${url}`,
        series,
        store,
        true,
        true
      )
    );

    nextRunTimes[refreshKey] = Date.now() + ttl;
  });
}

function addNewLinks(store: Store, links: Link[], series: Series) {
  if (links.length === 0) {
    logger.warn(
      Print.message(`found ${links.length} product links`, series, store, true)
    );

    return;
  }

  const existingUrls = new Set(store.links.map(link => link.url));
  const newLinks = links.filter(link => !existingUrls.has(link.url));

  if (newLinks.length === 0) {
    logger.debug(Print.message('NO NEW LINKS FOUND', series, store, true));
    return;
  }

  logger.info(
    Print.message(
      `found ${newLinks.length} new product links`,
      series,
      store,
      true,
      true
    )
  );

  logger.debug(JSON.stringify(newLinks, null, 2));

  store.links = store.links.concat(newLinks);
}
