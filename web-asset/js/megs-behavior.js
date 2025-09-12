// Deprecated: moved to left-menu.js. Keep as stub for compatibility.
(function(){
  try {
    var d = document; var s = d.createElement('script');
    var cs = d.currentScript; // current <script src=".../megs-behavior.js">
    var base = '';
    if (cs && cs.src) {
      var i = cs.src.lastIndexOf('/')
      base = i >= 0 ? cs.src.slice(0, i + 1) : ''
    }
    s.src = base + 'left-menu.js';
    s.defer = true; d.head.appendChild(s);
    if (typeof window !== 'undefined' && window.console && typeof window.console.info === 'function') {
      window.console.info('megs-behavior.js is deprecated; loading left-menu.js')
    }
  } catch { void 0 }
})();
