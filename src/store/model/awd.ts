import {Store} from './store';
import {getProductLinksBuilder} from './helpers/card';

export const Awd: Store = {
  currency: '£',
  labels: {
    inStock: {
      container: '.product-info-stock-sku .stock-status',
      text: ['in stock'],
    },
    maxPrice: {
      container: '.product-info-details .price',
      euroFormat: false, // Note: Awd uses non-euroFromat as price seperator
    },
    outOfStock: {
      container: '.product-info-stock-sku .stock-status',
      text: ['out of stock', 'coming soon'],
    },
  },
  links: [
    {
      brand: 'test:brand',
      model: 'test:model',
      series: 'test:series',
      url: 'https://www.awd-it.co.uk/gigabyte-geforce-rtx-4060-windforce-oc-8gb-graphics-card-gv-n4060wf2oc-8gd-2.html',
    },
    {
      brand: 'amd',
      model: '5600x',
      series: 'ryzen5600',
      url: 'https://www.awd-it.co.uk/amd-ryzen-5-5600x-cpu-six-core-3.7ghz-processor-socket-am4-retail.html',
    },
    {
      brand: 'amd',
      model: '5800x',
      series: 'ryzen5800',
      url: 'https://www.awd-it.co.uk/amd-ryzen-7-5800x-cpu-eight-core-3.8ghz-processor-socket-am4-retail.html',
    },
    {
      brand: 'amd',
      model: '5900x',
      series: 'ryzen5900',
      url: 'https://www.awd-it.co.uk/amd-ryzen-9-5900x-cpu-twelve-core-3.7ghz-processor-socket-am4-retail.html',
    },
    {
      brand: 'amd',
      model: '5950x',
      series: 'ryzen5950',
      url: 'https://www.awd-it.co.uk/amd-ryzen-9-5950x-sixteen-core-socket-am4-3.4ghz-processor.html',
    },
  ],
  linksBuilder: {
    builder: getProductLinksBuilder({
      productsSelector: '#maincontent li.product-item .product-item-info',
      sitePrefix: 'https://www.awd-it.co.uk',
      titleSelector: '.product-item-link',
    }),
    urls: [
      {
        series: 'rx6800',
        url: 'https://www.awd-it.co.uk/components/graphics-cards/ati/amd-radeon-6800-6800xt.html',
      },
      {
        series: '3060ti',
        url: 'https://www.awd-it.co.uk/components/graphics-cards/nvidia/nvidia-geforce-rtx-3060ti.html',
      },
      {
        series: '3070',
        url: 'https://www.awd-it.co.uk/components/graphics-cards/nvidia/nvidia-geforce-rtx-3070.html',
      },
      {
        series: '3080',
        url: 'https://www.awd-it.co.uk/components/graphics-cards/nvidia/nvidia-geforce-rtx-3080.html',
      },
      {
        series: '3090',
        url: 'https://www.awd-it.co.uk/components/graphics-cards/nvidia/nvidia-geforce-rtx-3090.html',
      },
      {
        series: '5070',
        url: 'https://www.awd-it.co.uk/components/graphics-cards/nvidia/nvidia-geforce-rtx-5070.html?product_list_limit=64',
      },
      {
        series: '5070ti',
        url: 'https://www.awd-it.co.uk/components/graphics-cards/nvidia/nvidia-geforce-rtx-5070ti.html?product_list_limit=64',
      },
      {
        series: '5080',
        url: 'https://www.awd-it.co.uk/components/graphics-cards/nvidia/nvidia-geforce-rtx-5080.html?product_list_limit=64',
      },
      {
        series: '5090',
        url: 'https://www.awd-it.co.uk/components/graphics-cards/nvidia/nvidia-geforce-rtx-5090.html?product_list_limit=64',
      },
    ],
  },
  name: 'awd',
  country: 'UK',
  waitUntil: 'domcontentloaded',
};
