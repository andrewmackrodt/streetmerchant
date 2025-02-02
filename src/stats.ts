import type {HTTPResponse, Page} from 'puppeteer';
import {logger} from './logger';

let rxCacheTotal = 0;
let rxWanTotal = 0;
let rxCacheLast1m = 0;
let rxWanLast1m = 0;

export function logTransferStats() {
  logger.info(`ℹ stats: est. rx cache total: ${formatBytes(rxCacheTotal)}`);
  logger.info(`ℹ stats: est. rx wan total: ${formatBytes(rxWanTotal)}`);
  logger.info(`ℹ stats: est. rx cache 1m: ${formatBytes(rxCacheLast1m)}`);
  logger.info(`ℹ stats: est. rx wan 1m: ${formatBytes(rxWanLast1m)}`);
  rxWanLast1m = 0;
  rxCacheLast1m = 0;
}

/**
 * Gathers and updates statistics related to HTTP response data.
 *
 * @param {Page} page - The current browser page instance.
 * @param {HTTPResponse} response - The HTTP response object.
 */
export async function gatherResponseStats(
  page: Page,
  response: HTTPResponse
): Promise<void> {
  if (
    response.url().startsWith('about:') ||
    response.url().startsWith('data:')
  ) {
    return;
  }

  const headers = response.headers();

  let contentLength = headers['content-length']
    ? parseInt(headers['content-length'], 10)
    : NaN;

  if (isNaN(contentLength)) {
    // fallback to detecting content-length from the body contents,
    // this will throw an error a lot of the time as the page may
    // have been navigated away from or closed
    contentLength = await response
      .content()
      .then(content => content.length)
      .catch(() => NaN);

    // assume a compression ratio of 2/3 if content-encoding header found
    if (!isNaN(contentLength) && headers['content-encoding']) {
      contentLength = Math.round(contentLength * 0.33);
    }
  }

  if (isNaN(contentLength)) {
    return;
  }

  if (response.fromCache()) {
    rxCacheTotal += contentLength;
    rxCacheLast1m += contentLength;
  } else {
    rxWanTotal += contentLength;
    rxWanLast1m += contentLength;
  }
}

/**
 * Converts a size in bytes to a human-readable string with appropriate unit (e.g., B, KiB, MiB, etc.).
 *
 * @param {number} bytes - The size in bytes to be formatted.
 * @return {string} A string representation of the size in the most appropriate unit, rounded to three decimal places.
 */
function formatBytes(bytes: number): string {
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let unitIndex = 0;

  // Continuously divide the bytes until it fits within the current unit.
  while (bytes >= 1024 && unitIndex < units.length - 1) {
    bytes /= 1024;
    unitIndex++;
  }

  return `${bytes.toFixed(3)} ${units[unitIndex]}`;
}
