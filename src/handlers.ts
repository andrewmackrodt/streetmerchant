import type {HTTPRequest, Page} from 'puppeteer';
import {proxyRequest} from 'puppeteer-proxy';
import {config} from './config';
import {logger} from './logger';
import type {Proxy} from './proxy';

const LOW_BANDWIDTH_REJECTED_RESOURCE_TYPES = ['font', 'image'];

export async function onRequest(
  page: Page,
  request: HTTPRequest,
  isDefaultContext = !config.browser.isIncognito,
  proxy?: Proxy
) {
  if (
    request.isInterceptResolutionHandled() ||
    (await isHandleLowBandwidth(request)) ||
    (await isHandleProxy(page, request, isDefaultContext, proxy))
  ) {
    return;
  }

  try {
    await request.continue();
  } catch (err) {
    logger.debug('Failed to continue request.', err);
  }
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
    !LOW_BANDWIDTH_REJECTED_RESOURCE_TYPES.includes(request.resourceType())
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
 * Determines whether a specific request should be handled via a proxy.
 *
 * @param {Page} page - The page instance associated with the request.
 * @param {HTTPRequest} request - The HTTP request that needs evaluation.
 * @param {boolean} isDefaultContext - A flag indicating whether the current browsing context is the default context.
 * @param {Proxy} [proxy] - An optional proxy instance used to handle the request. If not provided, the request will not be proxied.
 *
 * @return {Promise<boolean>} A promise that resolves to `true` if the request is handled via the proxy and `false` otherwise.
 */
async function isHandleProxy(
  page: Page,
  request: HTTPRequest,
  isDefaultContext: boolean,
  proxy?: Proxy
): Promise<boolean> {
  // proxy middleware is required if using the default context and a store specific proxy
  // as puppeteer is unable to apply page specific proxies natively
  if (
    request.isInterceptResolutionHandled() ||
    request.url().startsWith('data:') ||
    !isDefaultContext ||
    !proxy
  ) {
    return false;
  }

  logger.silly(`proxying request [${proxy.server}]: ${request.url()}`);

  await handleProxyRequest(page, request, proxy.toString());

  return true;
}

/**
 * Handles a proxy request or aborts the request if there's an error.
 *
 * @param {Page} page - The page instance associated with the request.
 * @param {HTTPRequest} request - The HTTP request to handle.
 * @param {string} proxyUrl - The URL of the proxy.
 * @returns {Promise<void>} A promise that resolves when the proxy request completes or error is handled.
 */
async function handleProxyRequest(
  page: Page,
  request: HTTPRequest,
  proxyUrl: string
): Promise<void> {
  try {
    await proxyRequest({page, proxyUrl, request});
  } catch (err) {
    logger.error('✖ handleProxyRequest failed', err);
    await tryAbortRequest(request);
  }
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
