# Application

| Environment variable | Description |
|:---:|---|
| `AUTO_ADD_TO_CART` | Enable auto add to cart on supported stores, default: `true` if not `DOCKER` |
| `BROWSER_TRUSTED` | Skip Chromium Sandbox. Useful for containerized environments, default: `false` |
| `HEADLESS` | Puppeteer to run headless or not. Debugging related, default: `true` |
| `IN_STOCK_WAIT_TIME` | Time to wait between requests to the same link if it has that card in stock. In seconds, default: `0` |
| `LOG_LEVEL` | [Logging levels](https://github.com/winstonjs/winston#logging-levels). Debugging related, default: `info` |
| `LOW_BANDWIDTH` | Blocks images/fonts to reduce traffic. Disables ad blocker, default: `false` |
| `NVIDIA_ADD_TO_CART_ATTEMPTS` | Maximum number of attempts add an item to card in the Nvidia storefront, default: `10` |
| `NVIDIA_SESSION_TTL` | Maximum session length on the Nvidia storefront in ms, default: `60000` |
| `OPEN_BROWSER` | Toggle for whether or not the browser should open when item is found, default: `true` if not `DOCKER` |
| `PAGE_BACKOFF_MIN` | Minimum backoff time between retrying requests for the same store when a forbidden response is received, default: `10000` |
| `PAGE_BACKOFF_MAX` | Maximum backoff time between retrying requests for the same store when a forbidden response is received, default: `3600000` |
| `PAGE_SLEEP_MIN` | Minimum sleep time between queries of the same product page. In milliseconds, default: `5000` |
| `PAGE_SLEEP_MAX` | Maximum sleep time between queries of the same product page. In milliseconds, default: `10000` |
| `PAGE_TIMEOUT` | Navigation Timeout in milliseconds. `0` for infinite, default: `30000` |
| `PROXY_PROTOCOL` | Protocol of proxy server, such as `socks5`, default: `http` |
| `PROXY_ADDRESS` | IP Address or fqdn of proxy server |
| `PROXY_PORT` | TCP Port number on which the proxy is listening for connections, default: `80` |
| `RESTART_TIME` | Restarts chrome after defined milliseconds. `0` for never, default: `0` |
| `SCREENSHOT` | Capture screenshot of page if a card is found, default: `true` |
| `SCREENSHOT_DIR` | The directory for saving the screenshots, default: `screenshots` |
| `USER_AGENT` | Custom user agent used for requests |
| `WEB_PORT` | Starts a webserver to be able to control the bot while it is running. Setting this value starts this service. |

???+ info
    There is more information on proxy settings in the [Proxy documentation](proxy.md).

???+ tip
    - You can also have a list of proxies that are rotated while searching stores. Proxies can be read from a file named `STORENAME.proxies` in the format of `socks5://username:password@ip`; one per line.
    - Data usage is [known to be high](https://github.com/jef/streetmerchant/issues?q=is%3Aissue+sort%3Aupdated-desc+bandwidth). This is expected as the program scrapes many websites in parallel 24/7. To help reduce this, use `LOW_BANDWIDTH="true"`. We are looking into other solutions as well, but is low priority.
