/* FILE: analytics.js - Lightweight sitewide analytics (restored) */
(function() {
  if (window.__NoonchiAnalyticsLoaded) return; // guard
  window.__NoonchiAnalyticsLoaded = true;

  class NoonchiAnalytics {
    constructor() {
      this.sessionId = this.getOrCreate('noonchi_session_id', 'session_');
      this.userId = this.getOrCreate('noonchi_user_id', 'user_');
      this.startTime = Date.now();
      this.sectionTimers = {};
      this.init();
    }

    init() {
      this.trackPageView();
      this.trackClicks();
      this.trackVisibility();
      this.trackScrollDepth();
      this.observeSections();
      window.addEventListener('beforeunload', () => this.flush('page_unload', {duration_ms: Date.now() - this.startTime}));
    }

    getOrCreate(key, prefix) {
      let val = (key.includes('session') ? sessionStorage : localStorage).getItem(key);
      if (!val) {
        val = prefix + Date.now() + '_' + Math.random().toString(36).slice(2,9);
        (key.includes('session') ? sessionStorage : localStorage).setItem(key, val);
      }
      return val;
    }

    trackPageView() {
      this.flush('page_view', {
        page_title: document.title,
        page_url: location.href,
        referrer: document.referrer
      });
    }

    trackClicks() {
      document.addEventListener('click', (e) => {
        const a = e.target.closest('a, button');
        if (!a) return;
        const data = {
          tag: a.tagName.toLowerCase(),
          text: (a.textContent || '').trim().slice(0,120),
          href: a.getAttribute('href') || null
        };
        this.flush('click', data);
      });
    }

    trackVisibility() {
      document.addEventListener('visibilitychange', () => {
        this.flush('visibility_change', {state: document.visibilityState});
      });
    }

    trackScrollDepth() {
      let maxDepth = 0;
      window.addEventListener('scroll', () => {
        const depth = Math.round((window.scrollY / (document.body.scrollHeight - innerHeight)) * 100);
        if (depth > maxDepth) {
          maxDepth = depth;
          if (depth % 25 === 0) this.flush('scroll_milestone', {percent: depth});
        }
      });
      window.addEventListener('beforeunload', () => this.flush('scroll_depth_final', {percent: maxDepth}));
    }

    observeSections() {
      const sections = document.querySelectorAll('section[id]');
      if (!('IntersectionObserver' in window) || sections.length === 0) return;
      const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          const id = entry.target.id;
          if (entry.isIntersecting) {
            this.sectionTimers[id] = Date.now();
            this.flush('section_view', {section_id: id});
          } else if (this.sectionTimers[id]) {
            const dur = Date.now() - this.sectionTimers[id];
            delete this.sectionTimers[id];
            this.flush('section_engagement', {section_id: id, duration_ms: dur});
          }
        });
      }, {root: null, threshold: 0.5});
      sections.forEach(s => io.observe(s));
    }

    flush(event_type, data = {}) {
      const payload = {
        event_type,
        session_id: this.sessionId,
        user_id: this.userId,
        ts: new Date().toISOString(),
        url: location.pathname,
        ...data
      };
      // Send to custom endpoint if available; always log for debugging.
      try { fetch('/api/analytics', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)}); } catch (_) {}
      if (typeof gtag !== 'undefined') { try { gtag('event', event_type, payload); } catch (_) {} }
      console.log('[analytics]', payload);
    }
  }

  document.addEventListener('DOMContentLoaded', () => new NoonchiAnalytics());
})();


