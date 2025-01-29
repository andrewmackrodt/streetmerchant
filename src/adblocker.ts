import {Page} from 'puppeteer';
import {PuppeteerBlocker} from '@ghostery/adblocker-puppeteer';

let adBlocker: PuppeteerBlocker | undefined;

async function initAdBlocker() {
  if (!adBlocker) {
    adBlocker = await PuppeteerBlocker.fromPrebuiltAdsAndTracking();
  }
  return adBlocker;
}

export async function enableBlockerInPage(page: Page) {
  const blockerObject = await initAdBlocker();
  if (blockerObject.isBlockingEnabled(page)) {
    return;
  }

  await blockerObject.enableBlockingInPage(page);
}

export async function disableBlockerInPage(page: Page) {
  const blockerObject = await initAdBlocker();
  if (!blockerObject.isBlockingEnabled(page)) {
    return;
  }

  await blockerObject.disableBlockingInPage(page);
}
