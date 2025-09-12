/* eslint-disable no-empty */
// QA Accordion (codex variant)
// Single Source of Truth for Q&A expand/collapse behavior in #content.
// No jQuery/Bootstrap dependencies; works with legacy NN sliders markup.

(function () {
  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  function forEachNodeList(list, cb) {
    if (!list) return;
    if (typeof list.forEach === 'function') {
      list.forEach(cb);
      return;
    }
    for (var i = 0; i < list.length; i++) cb(list[i], i);
  }

  function closest(el, selector) {
    if (!el) return null;
    if (el.closest) return el.closest(selector);
    var node = el;
    while (node && node.nodeType === 1) {
      if (matches(node, selector)) return node;
      node = node.parentElement || node.parentNode;
    }
    return null;
  }

  function matches(el, selector) {
    if (!el) return false;
    var fn = el.matches || el.msMatchesSelector || el.webkitMatchesSelector;
    if (fn) return fn.call(el, selector);
    var scope = el.parentElement || el.parentNode || (typeof document !== 'undefined' ? document : null);
    if (!scope || !scope.querySelectorAll) return false;
    var nodelist = scope.querySelectorAll(selector);
    for (var i = 0; i < nodelist.length; i++) if (nodelist[i] === el) return true;
    return false;
  }

  function initQAAccordions() {
    var content = document.getElementById('content');
    if (!content) return;

    // Normalize toggle links to current-page hashes so accidental navigation doesn't occur
    var allToggles = content.querySelectorAll('a.accordion-toggle');
    forEachNodeList(allToggles, function (a) {
      var tid = a.getAttribute('data-id');
      if (!tid) {
        var href = a.getAttribute('href') || '';
        var i = href.indexOf('#');
        if (i >= 0) tid = href.slice(i + 1);
      }
      if (tid) {
        a.setAttribute('href', '#' + tid);
        a.setAttribute('aria-controls', tid);
        a.setAttribute('role', 'button');
        a.setAttribute('tabindex', '0');
      }
    });

    // Initialize current state for aria and active styles
    forEachNodeList(allToggles, function (a) {
      var tid = a.getAttribute('aria-controls');
      if (!tid) return;
      var body = document.getElementById(tid);
      if (!body) return;
      var isOpen = body.classList.contains('in') || body.classList.contains('show');
      a.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      var group = closest(a, '.accordion-group');
      if (group) {
        if (isOpen) group.classList.add('active');
        else group.classList.remove('active');
      }
      if (!isOpen) {
        body.style.height = '0px';
        body.style.overflow = 'hidden';
      }
    });

    function handleToggleClick(ev, explicitToggle) {
      var toggle = explicitToggle || (ev && ev.target ? closest(ev.target, 'a.accordion-toggle') : null);
      if (!toggle || !content.contains(toggle)) return;
      if (ev) ev.preventDefault();
      var targetId = toggle.getAttribute('data-id');
      if (!targetId) {
        var href = toggle.getAttribute('href') || '';
        var idx = href.indexOf('#');
        if (idx >= 0) targetId = href.slice(idx + 1);
      }
      if (!targetId) return;
      var body = document.getElementById(targetId);
      if (!body) {
        var groupFallback = closest(toggle, '.accordion-group');
        if (groupFallback) body = groupFallback.querySelector('.accordion-body');
      }
      if (!body) return;
      var group = closest(toggle, '.accordion-group');
      var parentSelector = toggle.getAttribute('data-parent');
      var isOpen = body.classList.contains('in') || body.classList.contains('show');
      if (parentSelector) {
        try {
          var parent = document.querySelector(parentSelector);
          if (parent) {
            var openBodies = parent.querySelectorAll('.accordion-body.in, .accordion-body.show');
            forEachNodeList(openBodies, function (ob) {
              if (ob === body) return;
              ob.classList.remove('in');
              ob.classList.remove('show');
              ob.style.height = '0px';
              var og = closest(ob, '.accordion-group');
              if (og) og.classList.remove('active');
              var tgl = og ? og.querySelector('.accordion-heading .accordion-toggle') : null;
              if (tgl) tgl.setAttribute('aria-expanded', 'false');
            });
          }
        } catch (_) {}
      }
      if (isOpen) {
        body.classList.remove('in');
        body.classList.remove('show');
        body.style.height = '0px';
        toggle.setAttribute('aria-expanded', 'false');
        if (group) group.classList.remove('active');
      } else {
        body.classList.add('in');
        body.classList.add('show');
        body.style.height = 'auto';
        toggle.setAttribute('aria-expanded', 'true');
        if (group) group.classList.add('active');
      }
    }

    // Direct listeners on each toggle to avoid delegation pitfalls
    forEachNodeList(allToggles, function (a) {
      a.addEventListener('click', function (ev) { handleToggleClick(ev, a) })
    })

    // Keep delegated handler as a safety net
    content.addEventListener('click', function (e) { handleToggleClick(e, null) })

    // Keyboard support for toggles
    content.addEventListener('keydown', function (e) {
      var key = e.key || e.code;
      if (key !== 'Enter' && key !== ' ' && key !== 'Space') return;
      var toggle = e.target ? closest(e.target, 'a.accordion-toggle') : null;
      if (!toggle || !content.contains(toggle)) return;
      e.preventDefault();
      toggle.click();
    });
  }

  ready(function () {
    initQAAccordions();
    try { window._qaAccordionBound = true } catch (_) {}
  });
})();
