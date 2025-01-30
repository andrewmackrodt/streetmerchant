import {Store} from './store';
import {getProductLinksBuilder} from './helpers/card';

export const Novatech: Store = {
  currency: '£',
  labels: {
    inStock: {
      container: '.newspec-specprice',
      text: ['add to basket'],
    },
    maxPrice: {
      container: 'p[class="newspec-price"]',
      euroFormat: false, // Note: Novatech uses non-euroFromat as price seperator
    },
    outOfStock: {
      container: '.newspec-pricesection',
      text: [
        'very short supply, no confirmed date',
        'this product is only available to buy when in stock',
        'ordered upon request',
        'price to be confirmed',
      ],
    },
  },
  links: [
    {
      brand: 'test:brand',
      model: 'test:model',
      series: 'test:series',
      url: 'https://www.novatech.co.uk/products/asus-nvidia-geforce-rtx-4060-ti-dual-oc-evo-16gb-gddr6-graphics-card/90yv0jh8-m0na00.html',
    },
    {
      brand: 'amd',
      model: '5600x',
      series: 'ryzen5600',
      url: 'https://www.novatech.co.uk/products/amd-ryzen-5-5600x-six-core-processorcpu-with-stealth-cooler-/100-000000065box.html',
    },
    {
      brand: 'amd',
      model: '5800x',
      series: 'ryzen5800',
      url: 'https://www.novatech.co.uk/products/amd-ryzen-7-5800x-eight-core-processorcpu-without-cooler-/100-000000063wof.html',
    },
    {
      brand: 'amd',
      model: '5900x',
      series: 'ryzen5900',
      url: 'https://www.novatech.co.uk/products/amd-ryzen-9-5900x-twelve-core-processorcpu-without-cooler-/100-100000061wof.html',
    },
    {
      brand: 'amd',
      model: '5950x',
      series: 'ryzen5950',
      url: 'https://www.novatech.co.uk/products/amd-ryzen-9-5950x-sixteen-core-processorcpu-without-cooler-/100-100000059wof.html',
    },
  ],
  linksBuilder: {
    builder: getProductLinksBuilder({
      productsSelector: '.seo-container .search-box-results',
      sitePrefix: 'https://www.novatech.co.uk',
      titleSelector: '.search-box-title',
      urlSelector: 'a[href]',
    }),
    urls: [
      {
        series: '3060',
        url: 'https://www.novatech.co.uk/products/components/nvidiageforcegraphicscards/nvidiartxseries/nvidiartx3060/?i=200',
      },
      {
        series: '3060ti',
        url: 'https://www.novatech.co.uk/products/components/nvidiageforcegraphicscards/nvidiartxseries/nvidiartx3060ti/?i=200',
      },
      {
        series: '3080',
        url: 'https://www.novatech.co.uk/products/components/nvidiageforcegraphicscards/nvidiartxseries/nvidiartx3080/?i=200',
      },
      {
        series: '3090',
        url: 'https://www.novatech.co.uk/products/components/nvidiageforcegraphicscards/nvidiartxseries/nvidiartx3090/?i=200',
      },
      {
        series: '3060ti',
        url: 'https://www.novatech.co.uk/products/components/nvidiageforcegraphicscards/nvidiartxseries/nvidiartx3060ti/',
      },
      {
        series: '5080',
        url: 'https://www.novatech.co.uk/products/components/nvidiageforcegraphicscards/nvidiartxseries/nvidiartx5080/',
      },
      {
        series: '5090',
        url: 'https://www.novatech.co.uk/products/components/nvidiageforcegraphicscards/nvidiartxseries/nvidiartx5090/',
      },
    ],
  },
  name: 'novatech',
  country: 'UK',
  waitUntil: 'domcontentloaded',
};
