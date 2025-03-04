import {Store} from './store';
import {getProductLinksBuilder} from './helpers/card';

export const Overclockers: Store = {
  currency: '£',
  labels: {
    inStock: {
      container: 'ck-addto-cart-wrapper',
      text: ['add to basket', 'in stock'],
    },
    maxPrice: {
      container: 'ck-product-cta-box .price__amount',
      euroFormat: false, // Note: Overclockers uses non-euroFromat as price seperator
    },
    outOfStock: {
      container: 'ck-addto-cart-wrapper',
      text: ['out of stock', 'pre order', 'bought to order'],
    },
  },
  links: [
    {
      brand: 'test:brand',
      model: 'test:model',
      series: 'test:series',
      url: 'https://www.overclockers.co.uk/gigabyte-geforce-rtx-4060-windforce-oc-8gb-gddr6-pci-express-graphics-card-gx-1g8-gi.html',
    },
    {
      brand: 'amd',
      model: '5600x',
      series: 'ryzen5600',
      url: 'https://www.overclockers.co.uk/amd-ryzen-5-5600x-six-core-4.6ghz-socket-am4-processor-retail-cp-3cc-am.html',
    },
    {
      brand: 'amd',
      model: '5800x',
      series: 'ryzen5800',
      url: 'https://www.overclockers.co.uk/amd-ryzen-7-5800x-eight-core-4.7ghz-socket-am4-processor-retail-cp-3cb-am.html',
    },
    {
      brand: 'amd',
      model: '5900x',
      series: 'ryzen5900',
      url: 'https://www.overclockers.co.uk/amd-ryzen-9-5900x-twelve-core-4.8ghz-socket-am4-processor-retail-cp-3ca-am.html',
    },
    {
      brand: 'amd',
      model: '5950x',
      series: 'ryzen5950',
      url: 'https://www.overclockers.co.uk/amd-ryzen-9-5950x-sixteen-core-4.9ghz-socket-am4-processor-retail-cp-3c9-am.html',
    },
  ],
  linksBuilder: {
    builder: getProductLinksBuilder({
      sitePrefix: 'https://www.overclockers.co.uk',
      productsSelector: 'ck-product-box',
      titleSelector:
        '[data-qa="ck-product-box-product-name"] a[href].js-gtm-product-link',
    }),
    urls: [
      {
        series: 'rx6800',
        url: 'https://www.overclockers.co.uk/pc-components/graphics-cards/amd/radeon-rx-6800-series',
      },
      {
        series: 'rx6800xt',
        url: 'https://www.overclockers.co.uk/pc-components/graphics-cards/amd/radeon-rx-6800-xt-series',
      },
      {
        series: 'rx6900xt',
        url: 'https://www.overclockers.co.uk/pc-components/graphics-cards/amd/radeon-rx-6900-xt-series',
      },
      {
        series: 'rx9070',
        url: 'https://www.overclockers.co.uk/pc-components/graphics-cards/amd-graphics-cards/amd-radeon-rx-9070-graphics-cards',
      },
      {
        series: 'rx9070xt',
        url: 'https://www.overclockers.co.uk/pc-components/graphics-cards/amd-graphics-cards/amd-radeon-rx-9070-xt-graphics-cards',
      },
      {
        series: '3060',
        url: 'https://www.overclockers.co.uk/pc-components/graphics-cards/nvidia/geforce-rtx-3060',
      },
      {
        series: '3060ti',
        url: 'https://www.overclockers.co.uk/pc-components/graphics-cards/nvidia/geforce-rtx-3060-ti',
      },
      {
        series: '3070',
        url: 'https://www.overclockers.co.uk/pc-components/graphics-cards/nvidia/geforce-rtx-3070',
      },
      {
        series: '3080',
        // Need to add support to detect pagination so this can be dynamically detected
        url: [
          'https://www.overclockers.co.uk/pc-components/graphics-cards/nvidia/geforce-rtx-3080',
          'https://www.overclockers.co.uk/pc-components/graphics-cards/nvidia/geforce-rtx-3080?p=2',
        ],
      },
      {
        series: '3090',
        url: 'https://www.overclockers.co.uk/pc-components/graphics-cards/nvidia/geforce-rtx-3090',
      },
      {
        series: '5070',
        url: 'https://www.overclockers.co.uk/pc-components/graphics-cards/nvidia-graphics-cards/nvidia-geforce-rtx-5070-graphics-cards',
      },
      {
        series: '5070ti',
        url: 'https://www.overclockers.co.uk/pc-components/graphics-cards/nvidia-graphics-cards/nvidia-geforce-rtx-5070-ti-graphics-cards',
      },
      {
        series: '5080',
        url: 'https://www.overclockers.co.uk/pc-components/graphics-cards/nvidia-graphics-cards/nvidia-geforce-rtx-5080-graphics-cards',
      },
      {
        series: '5090',
        url: 'https://www.overclockers.co.uk/pc-components/graphics-cards/nvidia-graphics-cards/nvidia-geforce-rtx-5090-graphics-cards',
      },
    ],
  },
  name: 'overclockers',
  country: 'UK',
  waitUntil: 'domcontentloaded',
};
