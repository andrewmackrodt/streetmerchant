import {Store} from './store';
import {getProductLinksBuilder} from './helpers/card';

export const Box: Store = {
  backoffStatusCodes: [403, 429, 503],
  currency: '£',
  labels: {
    inStock: {
      container: '.flex-col button',
      text: ['add to basket'],
    },
    maxPrice: {
      container: '.flex-col span.heading_primary',
      euroFormat: false, // Note: Box uses non-euroFromat as price seperator
    },
    outOfStock: {
      container: '.flex-col button',
      text: ['request stock alert', 'coming soon', 'notify me'],
    },
  },
  links: [
    {
      brand: 'test:brand',
      model: 'test:model',
      series: 'test:series',
      url: 'https://box.co.uk/gv-n406teagle-8gd-gigabyte-geforce-rtx-4060-ti-eagle',
    },
    {
      brand: 'sony',
      model: 'ps5 console',
      series: 'sonyps5c',
      url: 'https://www.box.co.uk/CFI-1015A-Sony-Playstation-5-Console_3199689.html',
    },
    {
      brand: 'sony',
      model: 'ps5 digital',
      series: 'sonyps5de',
      url: 'https://www.box.co.uk/CFI-1015B-Sony-PlayStation-5-Digital-Edition-Conso_3199692.html',
    },
    {
      brand: 'microsoft',
      model: 'xbox series x',
      series: 'xboxsx',
      url: 'https://www.box.co.uk/RRT-00007-Xbox-Series-X-Console_3201195.html',
    },
    {
      brand: 'microsoft',
      model: 'xbox series s',
      series: 'xboxss',
      url: 'https://www.box.co.uk/RRS-00007-Xbox-Series-S-Console_3201197.html',
    },
    {
      brand: 'amd',
      model: 'tuf oc',
      series: 'rx6900xt',
      url: 'https://www.box.co.uk/90YV0GE0-M0NM00-ASUS-Radeon-RX-X6900XT-16GB-OC-Gaming-Gr_3561243.html',
    },
  ],
  linksBuilder: {
    builder: getProductLinksBuilder({
      productsSelector: 'app-product-list-view-card',
      sitePrefix: 'https://www.box.co.uk',
      titleSelector: 'a:not(.flex)',
    }),
    urls: [
      {
        series: '3060',
        url: 'https://www.box.co.uk/rtx-3060-graphics-cards',
      },
      {
        series: '3060ti',
        url: 'https://www.box.co.uk/rtx-3060-ti-graphics-cards',
      },
      {
        series: '3070',
        url: 'https://www.box.co.uk/rtx-3070-graphics-cards',
      },
      {
        series: '3080',
        url: 'https://www.box.co.uk/rtx-3080-graphics-cards',
      },
      {
        series: '3090',
        url: 'https://www.box.co.uk/rtx-3090-graphics-cards',
      },
      {
        series: '5070',
        url: 'https://www.box.co.uk/rtx-5070-graphics-cards',
      },
      {
        series: '5070ti',
        url: 'https://www.box.co.uk/rtx-5070-ti-graphics-cards',
      },
      {
        series: '5080',
        url: 'https://www.box.co.uk/rtx-5080-graphics-cards',
      },
      {
        series: '5090',
        url: 'https://www.box.co.uk/rtx-5090-graphics-cards',
      },
    ],
  },
  name: 'box',
  country: 'UK',
  waitUntil: 'domcontentloaded',
};
