import {unlinkSync} from 'fs';
import {AsyncContextError} from './abortctl';
import {StatusCodeRangeArray, Store} from './store/model';
import {logger} from './logger';
import {addTimeout} from './timers';

// must be a require call unless converting project to use esm
const topUserAgents: string[] = require('top-user-agents/desktop');

export function getSleepTime(store: Store) {
  const minSleep = store.minPageSleep as number;
  return minSleep + Math.random() * ((store.maxPageSleep as number) - minSleep);
}

export async function delay(ms: number) {
  return new Promise<void>(resolve => {
    addTimeout(resolve, ms);
  });
}

export function isStatusCodeInRange(
  statusCode: number,
  range: StatusCodeRangeArray
) {
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

export function getRandomUserAgent(): string | undefined {
  const deprecatedUserAgent = (
    process.env.USER_AGENT
      ? process.env.USER_AGENT.includes('\n')
        ? process.env.USER_AGENT.split('\n')
        : process.env.USER_AGENT.split(',')
      : []
  ).map(s => s.trim());

  if (deprecatedUserAgent.length > 0) {
    return deprecatedUserAgent[
      Math.floor(Math.random() * deprecatedUserAgent.length)
    ];
  }

  const userAgent =
    topUserAgents[Math.floor(Math.random() * topUserAgents.length)];
  logger.debug('user agent', {userAgent});
  return userAgent;
}

export function deleteFile(path: string) {
  try {
    unlinkSync(path);
  } catch (error: unknown) {
    logger.error('unable to delete file', error);
  }
}

// the main application loop does not have a way to abort async tasks, e.g.
// store lookup or browser close during a restart which leads to errors being
// thrown during routine application tasks; do not log the following errors:
const IGNORE_ERRORS_REGEXP = new RegExp(
  [
    'Connection closed',
    'Navigating frame was detached',
    'Requesting main frame too early',
    'Target\\.(attachToTarget|createTarget|(create|dispose)BrowserContext)',
    'TargetCloseError',
  ].join('|')
);

export function logUnexpectedError(err: unknown) {
  if (err instanceof AsyncContextError) {
    return;
  }
  if (err?.toString().match(IGNORE_ERRORS_REGEXP)) {
    logger.silly(err?.toString());
  } else {
    logger.error(err?.toString());
  }
}
