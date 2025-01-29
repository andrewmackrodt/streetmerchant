import {Store} from './store';
import {getProductLinksBuilder} from './helpers/card';

export const Currys: Store = {
  currency: '£',
  labels: {
    inStock: {
      container: '.prices-add-to-cart-actions button.add-to-cart',
      text: ['add to basket'],
    },
    maxPrice: {
      container: '.prices-add-to-cart-actions .price',
      euroFormat: false, // Note: Currys uses non-euroFromat as price seperator
    },
    outOfStock: {
      container: '.prices-add-to-cart-actions button.oos-submit-button',
      text: ['not available for delivery'],
    },
  },
  links: [
    {
      brand: 'test:brand',
      model: 'test:model',
      series: 'test:series',
      url: 'https://www.currys.co.uk/products/gigabyte-geforce-rtx-4060-8-gb-windforce-oc-graphics-card-10264619.html',
    },
    {
      brand: 'amd',
      model: '5600x',
      series: 'ryzen5600',
      url: 'https://www.currys.co.uk/gbuk/computing-accessories/components-upgrades/processors/amd-ryzen-5-5600x-processor-10216691-pdt.html',
    },
    {
      brand: 'amd',
      model: '5800x',
      series: 'ryzen5800',
      url: 'https://www.currys.co.uk/gbuk/computing-accessories/components-upgrades/processors/amd-ryzen-7-5800x-processor-10216690-pdt.html',
    },
    {
      brand: 'amd',
      model: '5900x',
      series: 'ryzen5900',
      url: 'https://www.currys.co.uk/gbuk/computing-accessories/components-upgrades/processors/amd-ryzen-9-5900x-processor-10216689-pdt.html',
    },
    {
      brand: 'amd',
      model: '5950x',
      series: 'ryzen5950',
      url: 'https://www.currys.co.uk/gbuk/computing-accessories/components-upgrades/processors/amd-ryzen-9-5950x-processor-10216688-pdt.html',
    },
    {
      brand: 'sony',
      model: 'ps5 console',
      series: 'sonyps5c',
      url: 'https://www.currys.co.uk/gbuk/gaming/console-gaming/consoles/sony-playstation-5-825-gb-10203370-pdt.html',
    },
    {
      brand: 'sony',
      model: 'ps5 digital',
      series: 'sonyps5de',
      url: 'https://www.currys.co.uk/gbuk/playstation-5-sony-1714-commercial.html',
    },
    {
      brand: 'microsoft',
      model: 'xbox series x',
      series: 'xboxsx',
      url: 'https://www.currys.co.uk/gbuk/gaming/console-gaming/consoles/microsoft-xbox-series-x-1-tb-10203371-pdt.html',
    },
    {
      brand: 'microsoft',
      model: 'xbox series s',
      series: 'xboxss',
      url: 'https://www.currys.co.uk/gbuk/gaming/console-gaming/consoles/microsoft-xbox-series-s-512-gb-ssd-10205195-pdt.html',
    },
  ],
  linksBuilder: {
    builder: getProductLinksBuilder({
      productsSelector: '.product-grid .product-item-element',
      sitePrefix: 'https://www.currys.co.uk',
      titleSelector: '.list-product-tile-name',
      urlSelector: 'a[href]',
    }),
    urls: [
      {
        series: 'rx6800',
        url: 'https://www.currys.co.uk/gbuk/radeon-rx-6800/components-upgrades/graphics-cards/324_3091_30343_xx_ba00013562-bv00313996/xx-criteria.html',
      },
      {
        series: 'rx6800xt',
        url: 'https://www.currys.co.uk/gbuk/radeon-rx-6800-xt/components-upgrades/graphics-cards/324_3091_30343_xx_ba00013562-bv00314005/xx-criteria.html',
      },
      {
        series: 'rx6900xt',
        url: 'https://www.currys.co.uk/gbuk/radeon-rx-6900-xt/components-upgrades/graphics-cards/324_3091_30343_xx_ba00013562-bv00314012/xx-criteria.html',
      },
      {
        series: '3060',
        url: 'https://www.currys.co.uk/gbuk/rtx-3060/components-upgrades/graphics-cards/324_3091_30343_xx_ba00013562-bv00314002/xx-criteria.html',
      },
      {
        series: '3060ti',
        url: 'https://www.currys.co.uk/gbuk/rtx-3060-ti/components-upgrades/graphics-cards/324_3091_30343_xx_ba00013562-bv00313952/xx-criteria.html',
      },
      {
        series: '3070',
        url: 'https://www.currys.co.uk/gbuk/rtx-3070/components-upgrades/graphics-cards/324_3091_30343_xx_ba00013562-bv00313849/xx-criteria.html',
      },
      {
        series: '3080',
        url: 'https://www.currys.co.uk/gbuk/rtx-3080/components-upgrades/graphics-cards/324_3091_30343_xx_ba00013562-bv00313767/xx-criteria.html',
      },
      {
        series: '3090',
        url: 'https://www.currys.co.uk/gbuk/rtx-3090/components-upgrades/graphics-cards/324_3091_30343_xx_ba00013562-bv00313725/xx-criteria.html',
      },
      {
        series: '5080',
        url: 'https://www.currys.co.uk/computing/components-and-upgrades/graphics-cards/rtx-5080',
      },
      {
        series: '5090',
        url: 'https://www.currys.co.uk/computing/components-and-upgrades/graphics-cards/rtx-5090',
      },
    ],
  },
  name: 'currys',
  country: 'UK',
  waitUntil: 'networkidle2',
};
