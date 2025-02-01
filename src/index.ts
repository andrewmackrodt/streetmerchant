/* eslint-disable no-process-exit */
import fs from 'node:fs';
import type {Browser} from 'puppeteer';
import {directory as temporaryDirectory} from 'tempy';
import {config} from './config'; // must be loaded before other application code
import {AsyncContextError} from './abortctl';
import * as abortctl from './abortctl';
import {launchBrowser} from './browser';
import {logger} from './logger';
import {tryLookupAndLoop} from './store';
import {getStores, Store} from './store/model';
import type {Timer} from './timers';
import * as timers from './timers';
import {startAPIServer, stopAPIServer} from './web';

class StreetMerchantApplication {
  readonly #processListeners: Map<NodeJS.Signals, () => void>;

  readonly #errorListeners: Map<
    NodeJS.UncaughtExceptionOrigin,
    (error: unknown) => void
  >;

  #browser?: Browser;
  #checkForNewStoresTimer?: Timer;
  #errorRestartTimer?: Timer;
  #running = false;
  #stores: Store[] = [];
  #shutdownStartTime?: number;
  #tempDirectory?: string;

  constructor() {
    this.#processListeners = new Map([
      ['SIGINT', this.#sigIntHandler.bind(this)],
      ['SIGTERM', this.kill.bind(this)],
      ['SIGQUIT', this.kill.bind(this)],
    ]);

    this.#errorListeners = new Map([
      ['uncaughtException', this.#errorHandler.bind(this)],
      ['unhandledRejection', this.#errorHandler.bind(this)],
    ]);
  }

  async start(): Promise<void> {
    if (this.#running) {
      return;
    }

    this.#running = true;

    this.#registerListeners();

    abortctl.create('app.running');
    timers.enable();

    // register restart handler
    if (config.restartTime > 0) {
      timers.addTimeout(this.restart.bind(this), config.restartTime);
    }

    await startAPIServer();

    this.#tempDirectory = temporaryDirectory({prefix: 'streetmerchant-'});
    this.#browser = await launchBrowser({userDataDir: this.#tempDirectory});
    this.#stores = [];

    this.#lookupEnabledStores(this.#browser);

    // check for stores enabled via the web interface every second
    // todo refactor this to use event emitter
    this.#checkForNewStoresTimer = timers.addInterval(
      this.#lookupEnabledStores.bind(this),
      1000,
      this.#browser
    );
  }

  /**
   * Stops the application and performs necessary cleanup operations including
   * clearing timers, closing browser instances, stopping API server, and
   * removing process event listeners. This method returns early and async tasks
   * may be left running until they finish. Use `kill()` to force exiting the
   * process.
   */
  async stop(): Promise<void> {
    if (!this.#running) {
      return;
    }

    this.#errorListeners.forEach((listener, signal) =>
      process.removeListener(signal, listener)
    );

    if (this.#checkForNewStoresTimer) {
      timers.removeInterval(this.#checkForNewStoresTimer);
      this.#checkForNewStoresTimer = undefined;
    }

    if (this.#errorRestartTimer) {
      timers.removeTimeout(this.#errorRestartTimer);
      this.#errorRestartTimer = undefined;
    }

    abortctl.destroy('app.running');
    timers.abort();

    await stopAPIServer().catch(() => {});

    this.#stores = [];

    if (this.#browser) {
      await this.#browser.close().catch(() => {});
      this.#browser = undefined;
    }

    if (this.#tempDirectory) {
      logger.debug(`cleaning up temp directory: file://${this.#tempDirectory}`);
      await fs.promises
        .rm(this.#tempDirectory, {recursive: true, force: true})
        .catch(error =>
          logger.warn('✖ error cleaning up temp directory', error)
        );
      this.#tempDirectory = undefined;
    }

    this.#running = false;

    this.#processListeners.forEach((listener, signal) =>
      process.removeListener(signal, listener)
    );
  }

  async restart(): Promise<void> {
    logger.info('ℹ restarting...');
    await this.stop();
    await this.start();
  }

  async kill(): Promise<void> {
    await this.stop().catch(() => {});
    // eslint-disable-next-line no-process-exit
    process.exit(1);
  }

  #lookupEnabledStores(browser: Browser) {
    const pending = [...getStores().values()].filter(
      store => !this.#stores.includes(store)
    );

    for (const store of pending) {
      tryLookupAndLoop(browser, store).finally(() => {
        const i = this.#stores.indexOf(store);
        if (i >= 0) {
          this.#stores.splice(i, 1);
        }
      });
      this.#stores.push(store);
    }
  }

  /**
   * Handles the SIGINT signal for graceful shutdown of the application.
   * This method ensures that the application stops all operations and exits
   * appropriately. If the application is already in the shutting down state,
   * it forces the process to exit with status code 1.
   */
  async #sigIntHandler() {
    if (this.#shutdownStartTime) {
      if (Date.now() - this.#shutdownStartTime < 100) {
        // noop if sigint received more than once in 100 ms span
        // workaround for (p)npm sending sigint too many times
        return;
      } else {
        logger.warn('✖ forcing shutdown...');
        process.exit(1);
      }
    }

    logger.info('ℹ shutdown requested...');
    this.#shutdownStartTime = Date.now();
    await this.stop();
  }

  async #errorHandler(error: unknown) {
    if (
      this.#shutdownStartTime ||
      this.#errorRestartTimer ||
      error instanceof AsyncContextError
    ) {
      return;
    }

    logger.error(
      '✖ something bad happened, resetting streetmerchant in 5 seconds',
      error
    );

    this.#errorRestartTimer = timers.addTimeout(this.restart.bind(this), 5000);
  }

  #registerListeners() {
    this.#processListeners.forEach((listener, signal) =>
      process.addListener(signal, listener)
    );

    this.#errorListeners.forEach((listener, signal) =>
      process.addListener(signal as 'uncaughtException', listener)
    );
  }
}

export const app = new StreetMerchantApplication();

void app.start();
