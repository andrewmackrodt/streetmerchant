import {Store} from './store';

export const Fingerprint: Store = {
  currency: '$',
  labels: {
    inStock: {
      container: 'body',
      text: ['a'],
    },
  },
  links: [
    'chrome://gpu',
    'https://deviceandbrowserinfo.com/are_you_a_bot',
    'https://deviceandbrowserinfo.com/info_device',
    'https://www.browserscan.net/bot-detection',
    'https://bot-detector.rebrowser.net/', // todo implement callbacks
  ].map(url => ({
    brand: 'test:brand',
    model: 'test:model',
    series: 'test:series',
    url,
  })),
  name: 'fingerprint',
  country: 'US',
};
