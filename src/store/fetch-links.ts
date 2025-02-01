import {Link, Series, Store} from './model';
import {Print, logger} from '../logger';
import {Browser} from 'puppeteer';
import * as cheerio from 'cheerio';
import {filterSeries} from './filter';
import {tryUsingPage} from '../util';

type StoreWithLinksBuilder = Store & Required<Pick<Store, 'linksBuilder'>>;

const linksBuilderLastRunTimes: Record<string, number> = {};

function isRefreshLinksBuilder(
  store: Store
): store is StoreWithLinksBuilder {
  if (!store.linksBuilder) {
    return false;
  }
  const lastRunTime =
    linksBuilderLastRunTimes[store.name] ?? Number.MIN_SAFE_INTEGER;
  let ttl = store.linksBuilder.ttl;
  if (typeof ttl === 'undefined') {
    const storeHasSeriesLinks = store.linksBuilder.urls.some(link =>
      filterSeries(link.series)
    );
    if (storeHasSeriesLinks) {
      ttl = Number.MAX_SAFE_INTEGER;
    } else {
      // force a refresh every 15 minutes if the store has no series links
      ttl = 15 * 60 * 1000;
    }
  }
  return Date.now() > lastRunTime + ttl;
}

export async function refreshLinksBuilder(browser: Browser, store: Store) {
  if (!isRefreshLinksBuilder(store)) {
    return;
  }
  try {
    await fetchLinks(store, browser);
    linksBuilderLastRunTimes[store.name] = Date.now();
  } catch (error: unknown) {
    logger.error(error);
  }
}

function addNewLinks(store: Store, links: Link[], series: Series) {
  if (links.length === 0) {
    logger.debug(Print.message('NO STORE LINKS FOUND', series, store, true));

    return;
  }

  const existingUrls = new Set(store.links.map(link => link.url));
  const newLinks = links.filter(link => !existingUrls.has(link.url));

  if (newLinks.length === 0) {
    logger.debug(Print.message('NO NEW LINKS FOUND', series, store, true));
    return;
  }

  logger.debug(
    Print.message(`FOUND ${newLinks.length} NEW LINKS`, series, store, true)
  );
  logger.debug(JSON.stringify(newLinks, null, 2));

  store.links = store.links.concat(newLinks);
}

async function fetchLinks(store: StoreWithLinksBuilder, browser: Browser) {
  const promises: Array<Promise<void>> = [];
  const linksBuilder = store.linksBuilder;

  logger.info(`[${store.name}] Running links builder...`);

  // eslint-disable-next-line prefer-const
  for (let {series, url} of linksBuilder.urls) {
    if (!filterSeries(series)) {
      continue;
    }

    logger.debug(Print.message('DETECTING STORE LINKS', series, store, true));

    if (!Array.isArray(url)) {
      url = [url];
    }

    url.map(x =>
      promises.push(
        tryUsingPage(browser, store, async page => {
          const waitUntil = linksBuilder.waitUntil
            ? linksBuilder.waitUntil
            : 'domcontentloaded';
          await page.goto(x, {waitUntil});

          if (linksBuilder.waitForSelector) {
            await page.waitForSelector(linksBuilder.waitForSelector);
          }

          const html = await page.content();

          if (!html) {
            logger.error(Print.message('NO RESPONSE', series, store, true));
            return;
          }

          const docElement = cheerio.load(html).root();
          const links = linksBuilder.builder(docElement, series);

          addNewLinks(store, links, series);
        })
      )
    );
  }

  await Promise.all(promises);
}
