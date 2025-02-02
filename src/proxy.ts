import {logger} from './logger';
import {config} from './config';
import type {Store} from './store/model';

export interface Proxy {
  server: string;
  credentials?: {
    username: string;
    password: string;
  };
  toString(): string;
}

export function parseProxy(raw: string): Proxy {
  const match =
    /^(?:(?<protocol>[a-z0-9]+):\/\/)?(?:(?<auth>.+?)@)?(?<host>[^@:]+)(?::(?<port>[0-9]+))?$/i.exec(
      raw
    );

  if (match?.groups) {
    const protocol = match.groups.protocol ?? config.proxy.protocol;
    const host = match.groups.host;
    const port = match.groups.port
      ? Number(match.groups.port)
      : config.proxy.port;
    let credentials: Proxy['credentials'] | undefined;
    if (match.groups.auth) {
      const [username, password] = match.groups.auth.split(':', 2);
      credentials = {username, password};
    } else if (config.proxy.username && config.proxy.password) {
      credentials = {
        username: config.proxy.username,
        password: config.proxy.password,
      };
    }
    return {
      server: `${protocol}://${host}:${port}`,
      credentials,
      toString() {
        const segments = [`${protocol}://`];
        if (credentials) {
          segments.push(`${credentials.username}:${credentials.password}@`);
        }
        segments.push(`${host}:${port}`);
        return segments.join('');
      },
    };
  } else {
    return {
      server: raw,
      toString() {
        return raw;
      },
    };
  }
}

const parsedProxyList = new Map<string, Proxy>();

export function nextStoreProxy(store: Store): Proxy | undefined {
  if (!store.proxyList) {
    return;
  }

  if (store.currentProxyIndex === undefined) {
    store.currentProxyIndex = 0;
  } else {
    store.currentProxyIndex++;
  }

  if (store.currentProxyIndex >= store.proxyList.length) {
    store.currentProxyIndex = 0;
  }

  logger.debug(
    `ℹ [${store.name}] Next proxy index: ${store.currentProxyIndex} / Count: ${
      store.proxyList.length
    } (${store.proxyList[store.currentProxyIndex]})`
  );

  const cacheKey = [store.name, store.currentProxyIndex].join(':');
  const raw = store.proxyList[store.currentProxyIndex];
  let proxy = parsedProxyList.get(cacheKey);

  if (!proxy) {
    proxy = parseProxy(raw);
    parsedProxyList.set(cacheKey, proxy);
  }

  return proxy;
}
