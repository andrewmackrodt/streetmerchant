import type {HTTPRequest, HTTPResponse, Page} from 'puppeteer';
import {config} from './config';
import {logger} from './logger';
import {gatherResponseStats} from './stats';

const LOW_BANDWIDTH_MODES = [
  ['font', 'image'],
  ['font', 'image', 'media', 'other', 'stylesheet'],
];

const rejectedResourceTypes = getLowBandwidthRejectedResourceTypes();

export async function onRequest(page: Page, request: HTTPRequest) {
  if (
    request.isInterceptResolutionHandled() ||
    (await isHandleLowBandwidth(request))
  ) {
    return;
  }

  try {
    await request.continue();
  } catch (err) {
    logger.debug('Failed to continue request.', err);
  }
}

export function onResponse(page: Page, response: HTTPResponse) {
  void gatherResponseStats(page, response);
}

/**
 * Determines whether the given HTTP request should be aborted due to not being deemed essential to page load.
 *
 * @param {HTTPRequest} request - The HTTP request to evaluate.
 * @return {Promise<boolean>} Returns a promise that resolves to true if the request is handled as low bandwidth, otherwise false.
 */
async function isHandleLowBandwidth(request: HTTPRequest): Promise<boolean> {
  if (
    request.isInterceptResolutionHandled() ||
    !config.browser.lowBandwidth ||
    request.url().startsWith('data:') ||
    request.url().includes('://challenges.cloudflare.com') ||
    !rejectedResourceTypes.includes(request.resourceType())
  ) {
    return false;
  }

  logger.silly(
    `aborting low bandwidth request [${request.resourceType()}]: ${request.url()}`
  );

  await tryAbortRequest(request);

  return true;
}

/**
 * Helper function to safely abort an HTTP request.
 *
 * @param {HTTPRequest} request - The HTTP request to abort.
 * @return {Promise<void>} Resolves when abort is either successful or handled.
 */
export async function tryAbortRequest(request: HTTPRequest): Promise<void> {
  try {
    await request.abort();
  } catch (err) {
    logger.debug(`✖ failed to abort request: ${request.url()}`, err);
  }
}

function getLowBandwidthRejectedResourceTypes(): string[] {
  if (
    config.browser.lowBandwidthMode >= 0 &&
    config.browser.lowBandwidthMode < LOW_BANDWIDTH_MODES.length
  ) {
    const rejected = LOW_BANDWIDTH_MODES[config.browser.lowBandwidthMode];
    logger.debug(
      `ℹ low bandwidth mode is enabled, the following requests will be blocked: ${rejected.join(
        ', '
      )}`
    );
    return rejected;
  } else {
    const rejected = LOW_BANDWIDTH_MODES[0];
    logger.warn(
      `✖ invalid value LOW_BANDWIDTH_MODE=${
        config.browser.lowBandwidthMode
      } expected value between 0..${
        LOW_BANDWIDTH_MODES.length - 1
      }, defaulting to: ${rejected.join(', ')}`
    );
    return rejected;
  }
}
