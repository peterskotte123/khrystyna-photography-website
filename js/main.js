/**
 * Khrystyna Photography - Main JavaScript
 */

(function() {
  'use strict';

  // DOM Elements
  const header = document.getElementById('header');
  const menuToggle = document.getElementById('menuToggle');
  const mobileMenu = document.getElementById('mobileMenu');
  const mobileOverlay = document.getElementById('mobileOverlay');

  // Pages without a dark hero (portfolio, about, services) have a light
  // header area, so the transparent/white-logo treatment would vanish.
  // Keep those headers solid at all times.
  const hasHero = !!document.querySelector('.hero');

  // Header scroll behavior
  function handleScroll() {
    if (!hasHero || window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }

    // Mobile booking bar appears once the hero has scrolled away
    const bookBar = document.getElementById('mobileBookBar');
    if (bookBar) {
      const hero = document.querySelector('.hero');
      const trigger = hero ? hero.offsetHeight * 0.8 : 400;
      // Once the on-page inquiry form is in view the bar would only cover it.
      const form = document.getElementById('inquire');
      const atForm = form && form.getBoundingClientRect().top < window.innerHeight * 0.6;
      bookBar.classList.toggle('visible', window.scrollY > trigger && !atForm);
    }
  }

  // Mobile menu toggle
  function toggleMobileMenu() {
    menuToggle.classList.toggle('active');
    mobileMenu.classList.toggle('active');
    mobileOverlay.classList.toggle('active');
    document.body.style.overflow = mobileMenu.classList.contains('active') ? 'hidden' : '';
  }

  function closeMobileMenu() {
    menuToggle.classList.remove('active');
    mobileMenu.classList.remove('active');
    mobileOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  // Scroll animations with Intersection Observer
  function initScrollAnimations() {
    const fadeElements = document.querySelectorAll('.fade-in');

    if (!fadeElements.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });

    fadeElements.forEach(el => observer.observe(el));
  }

  // Lazy loading images
  function initLazyLoading() {
    const lazyImages = document.querySelectorAll('img[loading="lazy"]');

    if ('loading' in HTMLImageElement.prototype) {
      // Browser supports native lazy loading
      return;
    }

    // Fallback for browsers that don't support native lazy loading
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src || img.src;
          imageObserver.unobserve(img);
        }
      });
    });

    lazyImages.forEach(img => imageObserver.observe(img));
  }

  // Portfolio filtering
  function initPortfolioFilter() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    const galleryItems = document.querySelectorAll('.gallery-item');

    if (!filterButtons.length) return;

    function applyFilter(filter) {
      galleryItems.forEach(item => {
        if (filter === 'all' || (item.dataset.category || '').split(/\s+/).includes(filter)) {
          item.style.display = '';
          setTimeout(() => item.style.opacity = '1', 10);
        } else {
          item.style.opacity = '0';
          setTimeout(() => item.style.display = 'none', 300);
        }
      });
    }

    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        // Update active button
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        applyFilter(btn.dataset.filter);
      });
    });

    // Honor whichever filter is marked active in the markup on first paint
    const initialBtn = document.querySelector('.filter-btn.active');
    if (initialBtn) applyFilter(initialBtn.dataset.filter);
  }

  // Lightbox for gallery
  function initLightbox() {
    const galleryItems = document.querySelectorAll('.gallery-item');
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightboxImg');
    const lightboxClose = document.getElementById('lightboxClose');

    if (!galleryItems.length || !lightbox) return;

    galleryItems.forEach(item => {
      const img = item.querySelector('img');
      if (!img) return; // video items play inline with native controls, no lightbox
      item.addEventListener('click', () => {
        lightboxImg.src = img.src;
        lightboxImg.alt = img.alt;
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
      });
    });

    function closeLightbox() {
      lightbox.classList.remove('active');
      document.body.style.overflow = '';
    }

    if (lightboxClose) {
      lightboxClose.addEventListener('click', closeLightbox);
    }

    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) {
        closeLightbox();
      }
    });

    // Close on escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && lightbox.classList.contains('active')) {
        closeLightbox();
      }
    });
  }

  // Smooth scroll for anchor links
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        if (href === '#') return;

        e.preventDefault();
        const target = document.querySelector(href);

        if (target) {
          const go = () => window.scrollTo({
            top: target.getBoundingClientRect().top + window.pageYOffset - header.offsetHeight,
            behavior: 'smooth'
          });
          go();
          // Lazy images above the target load during the scroll and push it down; aim again until it lands.
          let tries = 0;
          const settle = setInterval(() => {
            const off = target.getBoundingClientRect().top - header.offsetHeight;
            if (Math.abs(off) < 4 || ++tries > 8) return clearInterval(settle);
            go();
          }, 700);
        }
      });
    });
  }

  // Video play/pause on visibility
  function initVideoObserver() {
    const videos = document.querySelectorAll('video.hero-video');

    if (!videos.length) return;

    const videoObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.play();
        } else {
          entry.target.pause();
        }
      });
    }, { threshold: 0.25 });

    videos.forEach(video => videoObserver.observe(video));
  }

  // Google Ads: persist the click ID so the inquiry form can attach it to the lead email.
  // 90-day lifetime matches the conversion window.
  function initGclidCapture() {
    try {
      const params = new URLSearchParams(window.location.search);
      // iOS clicks from Google apps send wbraid/gbraid instead of gclid, so
      // capture whichever arrives; without this those leads lose attribution.
      let id = null;
      for (const key of ['gclid', 'wbraid', 'gbraid']) {
        const v = params.get(key);
        if (v) { id = { value: v, kind: key, ts: Date.now() }; break; }
      }
      if (id) {
        localStorage.setItem('ks_gclid', JSON.stringify(id));
      } else {
        const stored = JSON.parse(localStorage.getItem('ks_gclid') || 'null');
        if (stored && Date.now() - stored.ts > 90 * 24 * 60 * 60 * 1000) {
          localStorage.removeItem('ks_gclid');
        }
      }
    } catch (e) {}
  }

  // Traffic source memory for the inquiry form. First touch persists 90 days,
  // session touch resets per tab, so a lead can be attributed even when the
  // inquiry happens on a later visit.
  function initTouchCapture() {
    try {
      var params = new URLSearchParams(window.location.search);
      var touch = {
        ref: document.referrer || '',
        landing: window.location.pathname + window.location.search,
        utm_source: params.get('utm_source') || '',
        utm_medium: params.get('utm_medium') || '',
        utm_campaign: params.get('utm_campaign') || '',
        ts: Date.now()
      };
      if (!sessionStorage.getItem('ks_session_touch')) sessionStorage.setItem('ks_session_touch', JSON.stringify(touch));
      var first = JSON.parse(localStorage.getItem('ks_first_touch') || 'null');
      if (!first || Date.now() - first.ts > 90 * 24 * 60 * 60 * 1000) localStorage.setItem('ks_first_touch', JSON.stringify(touch));
    } catch (e) {}
  }

  function initConversionTracking() {
    if (typeof gtag !== 'function') return;

    // Events flow through the Google tag (GA4). The Google Ads conversion is
    // event-based, so no AW- send_to is needed; mark these as key events in
    // GA4 or import them in Google Ads to count them as conversions.
    const VALUES = { contact_phone: 30, contact_text: 30, contact_email: 15, book_appointment: 40 };

    function fire(eventName) {
      gtag('event', eventName, { value: VALUES[eventName], currency: 'USD' });
    }

    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href]');
      if (!link) return;
      const href = link.getAttribute('href');

      if (href.indexOf('tel:') === 0) fire('contact_phone');
      else if (href.indexOf('sms:') === 0) fire('contact_text');
      else if (href.indexOf('mailto:') === 0) fire('contact_email');
      else if (href.indexOf('calendly.com') > -1) fire('book_appointment');
    }, true);
  }

  // Inquiry forms call this from their submit handler once the fields are
  // prepared. It locks the button, posts the form to Formspree in the
  // background, and moves to the thanks page as soon as Formspree confirms.
  // The visitor never waits longer than SEND_WAIT: the database copy has the
  // lead by then, and the monitor catches anything Formspree missed.
  const SEND_WAIT = 8000;
  window.ksSend = function (form) {
    if (form.dataset.sending) return;
    form.dataset.sending = '1';
    const btn = form.querySelector('[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
    const next = form.querySelector('[name="_next"]');
    let gone = false;
    const go = () => {
      if (gone) return;
      gone = true;
      window.location.href = next && next.value ? next.value : '/thanks';
    };
    const body = new FormData(form);
    body.delete('_honey');
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = setTimeout(() => { if (ctrl) ctrl.abort(); go(); }, SEND_WAIT);
    const done = () => { clearTimeout(timer); go(); };
    try {
      fetch(form.action, {
        method: 'POST', body, headers: { Accept: 'application/json' },
        signal: ctrl ? ctrl.signal : undefined
      }).then(done, done);
    } catch (e) { done(); }
  };

  // The shared inquiry form stamped at the foot of landing pages by
  // sync_partials.py (partials/inquiry-form.html). Same fields and the same
  // send path as contact.html: a copy to our database, then ksSend to
  // Formspree. The page's preset type (hidden #inq-preset) or ?type= in the
  // URL picks the inquiry type, and the wedding-only fields hide for the
  // smaller shoots.
  function initInquiryForm() {
    const form = document.querySelector('form[data-shared-inquiry]');
    if (!form) return;
    const $ = (id) => document.getElementById(id);
    const sel = $('inq-type');
    const preset = new URLSearchParams(window.location.search).get('type') || ($('inq-preset') || {}).value || '';
    if (sel && preset) {
      for (let i = 0; i < sel.options.length; i++) if (sel.options[i].text === preset) { sel.selectedIndex = i; break; }
    }

    function shape() {
      const opt = sel && sel.options[sel.selectedIndex];
      const type = opt ? opt.text : '';
      const isProposal = type === 'Surprise Proposal';
      const small = ['Surprise Proposal', 'Elopement', 'Engagement Session', 'Portraits, Family, or Maternity'].includes(type);
      const wrap = (el) => el && (el.closest('.form-group') || el.parentElement);
      if (wrap($('inq-planner'))) wrap($('inq-planner')).style.display = small ? 'none' : '';
      const guests = $('inq-guests');
      if (guests) {
        wrap(guests).style.display = isProposal ? 'none' : '';
        const gLabel = document.querySelector('label[for="inq-guests"]');
        if (gLabel) gLabel.textContent = type === 'Elopement' ? 'How many guests, if any?' : 'Estimated Guest Count';
        guests.placeholder = type === 'Elopement' ? 'e.g. just us, or 8' : 'e.g. 80 (skip for proposals and sessions)';
      }
      const venue = $('inq-venue');
      if (venue) venue.placeholder = isProposal ? 'e.g. Sunset Cliffs, La Jolla, or "help me pick"'
        : type === 'Elopement' ? 'e.g. Sunset Cliffs, Torrey Pines, or "help me pick"'
        : 'e.g. Rancho Santa Fe estate, Hotel del Coronado, Sunset Cliffs';
      // With the type already chosen, the contact page's cross-type hedges are noise.
      const plannerLabel = document.querySelector('label[for="inq-planner"]');
      if (plannerLabel) plannerLabel.textContent = type && type !== 'Choose one' ? 'Planner or Coordinator' : 'Planner or Coordinator (weddings only)';
      if (guests && type === 'Wedding') guests.placeholder = 'e.g. 80';
      const msgLabel = document.querySelector('label[for="inq-message"]');
      if (msgLabel) msgLabel.textContent = isProposal ? 'Tell me about the plan *' : 'Tell me about your day *';
      const date = $('inq-date'), dateLabel = document.querySelector('label[for="inq-date"]');
      if (date && dateLabel) {
        date.type = isProposal ? 'text' : 'date';
        date.placeholder = isProposal ? 'e.g. in town Nov 6 to 9, flexible on which evening' : '';
        dateLabel.textContent = isProposal ? 'Your date, or your travel window' : (type && type !== 'Choose one' ? 'Date' : 'Date (or target proposal date)');
      }
      const next = $('inq-next');
      if (next) next.value = 'https://www.khrystynaskotte.com/thanks' + (isProposal ? '?type=proposal' : '');
    }
    if (sel) sel.addEventListener('change', shape);
    shape();
    // Buttons that name a type (data-type) set it as they scroll to the form.
    document.querySelectorAll('a[href="#inquire"][data-type]').forEach((a) => {
      a.addEventListener('click', () => {
        if (!sel) return;
        for (let i = 0; i < sel.options.length; i++) if (sel.options[i].text === a.dataset.type) { sel.selectedIndex = i; break; }
        shape();
      });
    });

    // Phone: any formatting, but a real 10 digit US number or an international one starting with +.
    const phone = $('inq-phone');
    if (phone) {
      const checkPhone = () => {
        const digits = phone.value.replace(/\D/g, '');
        const intl = phone.value.trim().charAt(0) === '+' && digits.length >= 8 && digits.length <= 15;
        const ok = digits.length === 10 || (digits.length === 11 && digits.charAt(0) === '1') || intl;
        phone.setCustomValidity(!phone.value || ok ? '' : 'Enter a 10-digit US number like (619) 555-0123, or an international number starting with +');
      };
      phone.addEventListener('input', checkPhone);
      checkPhone();
    }

    form.addEventListener('submit', function (e) {
      if (window.ksSend) e.preventDefault();
      const get = (n) => { const el = form.querySelector('[name="' + n + '"]'); return el && el.value ? el.value.trim() : ''; };
      const email = get('email').toLowerCase();
      const digits = get('phone').replace(/\D/g, '');
      const typeTxt = sel && sel.selectedIndex > -1 ? sel.options[sel.selectedIndex].text : '';

      const rt = $('inq-replyto');
      if (rt && email) rt.value = email;
      const honey = form.querySelector('[name="_honey"]');
      if (honey) honey.value = '';
      const subj = $('inq-subject');
      if (subj) subj.value = (typeTxt && typeTxt !== 'Choose one' ? typeTxt : 'Inquiry') + ' - ' + (get('name') || 'website') + ' - khrystynaskotte.com';
      ['inq-planner', 'inq-guests'].forEach((id) => {
        const el = $(id);
        const wrap = el && (el.closest('.form-group') || el.parentElement);
        if (wrap && wrap.style.display === 'none') el.disabled = true;
      });
      const msgEl = $('inq-message'), trav = get('traveling_from');
      if (msgEl && trav && msgEl.value.indexOf('Traveling from: ') !== 0) msgEl.value = 'Traveling from: ' + trav + '.\n\n' + msgEl.value;

      let stored = null;
      try { stored = JSON.parse(localStorage.getItem('ks_gclid') || 'null'); } catch (err) {}
      const g = $('inq-gclid');
      if (g) {
        if (stored && stored.value) { g.value = stored.value; if (stored.kind && stored.kind !== 'gclid') g.name = stored.kind; }
        else g.disabled = true;
      }

      const ud = {};
      if (email) ud.email = email;
      if (digits.length === 10) ud.phone_number = '+1' + digits;
      else if (digits.length === 11 && digits[0] === '1') ud.phone_number = '+' + digits;
      try {
        sessionStorage.setItem('inq_ud', JSON.stringify(ud));
        sessionStorage.setItem('inq_type', typeTxt || '');
        sessionStorage.setItem('inq_submitted', '1');
        sessionStorage.removeItem('inq_fired');
      } catch (err) {}

      try {
        const fields = {};
        new FormData(form).forEach((v, k) => { if (k.indexOf('_') !== 0 || k === '_honey') fields[k] = typeof v === 'string' ? v : ''; });
        fetch('https://wurikcpajrkvmnohungl.supabase.co/functions/v1/site-inquiry', {
          method: 'POST', mode: 'cors', keepalive: true,
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({
            fields,
            click_id: stored && stored.value ? stored.value : '',
            click_id_kind: stored && stored.kind ? stored.kind : '',
            first_touch: JSON.parse(localStorage.getItem('ks_first_touch') || 'null'),
            session_touch: JSON.parse(sessionStorage.getItem('ks_session_touch') || 'null'),
            page: window.location.pathname + window.location.search
          })
        }).catch(() => {});
      } catch (err) {}

      if (window.ksSend) window.ksSend(form);
    });
  }

  // Initialize everything
  function initHashLanding() {
    // Ad final URLs land on anchors (#courthouse, #estimator). The browser
    // scrolls before lazy images resolve their heights, so the target drifts
    // down and the visitor lands short. Re-scroll once everything has loaded.
    if (!window.location.hash) return;
    window.addEventListener('load', () => {
      const target = document.querySelector(window.location.hash);
      if (target) target.scrollIntoView();
    });
  }

  function init() {
    // Event listeners
    window.addEventListener('scroll', handleScroll, { passive: true });

    if (menuToggle) {
      menuToggle.addEventListener('click', toggleMobileMenu);
    }

    if (mobileOverlay) {
      mobileOverlay.addEventListener('click', closeMobileMenu);
    }

    // Close mobile menu on link click
    document.querySelectorAll('.mobile-nav-link').forEach(link => {
      link.addEventListener('click', closeMobileMenu);
    });

    // Close mobile menu on escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mobileMenu.classList.contains('active')) {
        closeMobileMenu();
      }
    });

    // Initialize features
    handleScroll();
    initScrollAnimations();
    initLazyLoading();
    initPortfolioFilter();
    initLightbox();
    initSmoothScroll();
    initVideoObserver();
    initGclidCapture();
    initTouchCapture();
    initConversionTracking();
    initInquiryForm();
    initHashLanding();
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
