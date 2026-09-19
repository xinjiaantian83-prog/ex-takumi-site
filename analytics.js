(function () {
  'use strict';

  const MEASUREMENT_ID = 'G-4MR1TG0NJK';
  const META_PIXEL_ID = '1880670813316341';
  const debugMode = new URLSearchParams(window.location.search).get('ga_debug') === '1';

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () {
    window.dataLayer.push(arguments);
  };

  window.gtag('js', new Date());
  window.gtag('config', MEASUREMENT_ID, { send_page_view: true, debug_mode: debugMode });

  if (!document.querySelector(`script[src*="googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}"]`)) {
    const tag = document.createElement('script');
    tag.async = true;
    tag.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
    document.head.appendChild(tag);
  }

  // Meta Pixel is initialized once from this shared analytics file so it can
  // coexist with GA4 without adding duplicate listeners to individual pages.
  window.fbq = window.fbq || function () {
    if (window.fbq.callMethod) window.fbq.callMethod.apply(window.fbq, arguments);
    else window.fbq.queue.push(arguments);
  };
  if (!window.fbq.loaded) {
    window.fbq.loaded = true;
    window.fbq.version = '2.0';
    window.fbq.queue = [];
  }
  if (!document.querySelector('script[src="https://connect.facebook.net/en_US/fbevents.js"]')) {
    const metaTag = document.createElement('script');
    metaTag.async = true;
    metaTag.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(metaTag);
  }
  window.fbq('init', META_PIXEL_ID);
  window.fbq('track', 'PageView');

  const pageName = (() => {
    if (document.body?.dataset.pageName) return document.body.dataset.pageName;
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

  function trackMeta(eventName, params) {
    window.fbq('track', eventName, params || {});
  }

  window.exTakumiAnalytics = Object.freeze({
    track,
    trackMeta,
    pageName,
    measurementId: MEASUREMENT_ID,
    metaPixelId: META_PIXEL_ID
  });

  function trackPageContent() {
    const file = window.location.pathname.split('/').pop() || 'index.html';
    if (file === 'works.html') track('works_view');
    if (file === 'materials.html') track('materials_view');
    if (file === 'diy.html') track('diy_view');
    if (/^diy-tool-.+\.html$/.test(file)) {
      const productName = document.querySelector('#toolDetail h1, h1.title')?.textContent?.trim();
      track('diy_tool_view', productName ? { product_name: productName } : {});
    }
    if (document.body?.dataset.pageName === 'matsuyama_carport_lp') {
      const search = new URLSearchParams(window.location.search);
      track('carport_lp_view', {
        campaign: search.get('utm_campaign') || undefined,
        keyword: search.get('utm_term') || undefined,
        has_gclid: search.has('gclid')
      });
    }
  }

  const priceTarget = document.querySelector('[data-ga-view-event]');
  if (priceTarget && 'IntersectionObserver' in window) {
    let viewed = false;
    new IntersectionObserver((entries, observer) => {
      if (!viewed && entries.some(entry => entry.isIntersecting)) {
        viewed = true;
        track(priceTarget.dataset.gaViewEvent, { section_id: priceTarget.id || 'price' });
        observer.disconnect();
      }
    }, { threshold: 0.25 }).observe(priceTarget);
  }

  const trackedForm = document.querySelector('#contactForm');
  if (trackedForm) {
    let started = false;
    trackedForm.addEventListener('focusin', () => {
      if (!started) { started = true; track('form_start', { form_id: 'contactForm' }); }
    });
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

    // This runs independently of the GA4 event routing below. Each user click
    // reaches this branch only once, including links with data-ga-event.
    if (absoluteHref.includes('line.me/')) {
      trackMeta('Contact', {
        content_name: 'LINE inquiry',
        content_category: pageName
      });
    }

    const declaredEvent = link.dataset.gaEvent;
    if (declaredEvent && declaredEvent !== 'customer_phone_click' && declaredEvent !== 'sales_phone_click') {
      track(declaredEvent, Object.assign(common, {
        work_type: link.dataset.workType || undefined
      }));
      return;
    }

    const phoneEvent = link.dataset.gaEvent;
    if (phoneEvent === 'customer_phone_click' || phoneEvent === 'sales_phone_click') {
      track(phoneEvent, common);
      return;
    }

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
    if (app) track(app.name, Object.assign(common, { store: app.store }));
  });
})();
