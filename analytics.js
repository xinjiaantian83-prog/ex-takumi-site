(function () {
  'use strict';

  const MEASUREMENT_ID = 'G-NNF34M8570';
  const debugMode = new URLSearchParams(window.location.search).get('ga_debug') === '1';

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () {
    window.dataLayer.push(arguments);
  };

  window.gtag('js', new Date());
  window.gtag('config', MEASUREMENT_ID, {
    send_page_view: true,
    debug_mode: debugMode
  });

  if (!document.querySelector(`script[src*="googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}"]`)) {
    const tag = document.createElement('script');
    tag.async = true;
    tag.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
    document.head.appendChild(tag);
  }

  const pageName = (() => {
    const file = window.location.pathname.split('/').pop() || 'index.html';
    if (file === 'index.html') return 'home';
    return file.replace(/\.html$/, '').replace(/[^a-z0-9-]/gi, '_');
  })();

  function cleanDestination(rawHref) {
    try {
      const url = new URL(rawHref, window.location.href);
      return `${url.hostname}${url.pathname}`;
    } catch (_) {
      return String(rawHref || '').split('?')[0].split('#')[0];
    }
  }

  function linkLocation(element) {
    const section = element.closest('section[id], header, footer, nav, .fixed-contact');
    if (!section) return 'content';
    if (section.id) return section.id;
    return section.tagName.toLowerCase();
  }

  function track(eventName, params) {
    window.gtag('event', eventName, Object.assign({ page_name: pageName }, params || {}));
  }

  window.exTakumiAnalytics = Object.freeze({ track, pageName, measurementId: MEASUREMENT_ID });

  function trackPageContent() {
    const file = window.location.pathname.split('/').pop() || 'index.html';
    if (file === 'works.html') track('works_view');
    if (file === 'materials.html') track('materials_view');
    if (file === 'diy.html') track('diy_view');
    if (/^diy-tool-.+\.html$/.test(file)) {
      const productName = document.querySelector('#toolDetail h1, h1.title')?.textContent?.trim();
      track('diy_tool_view', productName ? { product_name: productName } : {});
    }
  }

  function appEvent(link) {
    const card = link.closest('.app-card');
    const name = card?.querySelector('.app-card-title')?.textContent?.trim().toLowerCase() || '';
    const href = link.href.toLowerCase();
    const store = href.includes('play.google.com') ? 'google_play' : href.includes('apps.apple.com') ? 'app_store' : 'other';
    if (name.includes('現場電卓')) return { name: 'genba_tool_click', store };
    if (name.includes('life map')) return { name: 'lifemap_click', store };
    if (name.includes('わんわんコイン')) return { name: 'wanwan_coin_click', store };
    return null;
  }

  document.addEventListener('DOMContentLoaded', trackPageContent, { once: true });

  document.addEventListener('click', function (event) {
    const workPhoto = event.target.closest('.work-photo');
    if (workPhoto) {
      const card = workPhoto.closest('.work-card');
      const productName = card?.querySelector('.work-summary-title')?.textContent?.trim();
      const area = card?.querySelector('.work-summary-area')?.textContent?.trim();
      track('works_detail_view', {
        product_name: productName || '施工事例',
        category: '施工事例',
        ...(area ? { area } : {})
      });
      return;
    }

    const link = event.target.closest('a[href]');
    if (!link) return;

    const href = link.getAttribute('href') || '';
    const absoluteHref = link.href || href;
    const common = {
      link_location: linkLocation(link),
      destination: cleanDestination(absoluteHref)
    };

    if (absoluteHref.includes('line.me/')) {
      track('line_inquiry_click', common);
      return;
    }

    if (href === '#contact' || /(?:^|\/)index\.html#contact$/.test(href)) {
      track('contact_form_click', common);
      return;
    }

    if (/^https?:\/\/(?:www\.)?gardenliving-ex\.net(?:\/|$)/i.test(absoluteHref)) {
      track('garden_living_click', common);
      return;
    }

    const app = appEvent(link);
    if (app) {
      track(app.name, Object.assign(common, { store: app.store }));
    }
  });
})();
