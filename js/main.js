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
      bookBar.classList.toggle('visible', window.scrollY > trigger);
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
    initHashLanding();
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
