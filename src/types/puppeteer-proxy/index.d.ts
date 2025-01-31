declare module 'puppeteer-proxy' {
  import type {HTTPRequest} from 'puppeteer';

  interface ProxyRequestConfigurationType {
    agent?: HttpAgent | HttpsAgent
    page: Page
    proxyUrl?: string | { http: string, https: string }
    request: HTTPRequest
  }

  export function proxyRequest(configuration: ProxyRequestConfigurationType);
}
