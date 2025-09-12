// Left Menu behavior (vanilla JS)
// - Hover expand for #accordion_menu_90

(function () {
  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  // (helpers removed; left-menu only needs simple hover handlers)

  function initLeftMenuHover() {
    var menu = document.getElementById('accordion_menu_90');
    if (!menu) return;

    var items = menu.children; // direct children <li>
    Array.prototype.forEach.call(items, function (li) {
      if (!(li && li.tagName === 'LI')) return;
      var wrapper = li.querySelector('.ul-wrapper');
      var btnImg = li.querySelector('.item-wrapper > .menu-button > img');
      if (!wrapper) return;

      li.addEventListener('mouseenter', function () {
        li.classList.add('opened');
        wrapper.style.display = 'block';
        if (btnImg) btnImg.src = '../modules/mod_cinch_menu/tmpl/images/minus.png';
      });
      li.addEventListener('mouseleave', function () {
        li.classList.remove('opened');
        wrapper.style.display = 'none';
        if (btnImg) btnImg.src = '../modules/mod_cinch_menu/tmpl/images/plus.png';
      });
    });
  }

  ready(function () {
    initLeftMenuHover();
  });
})();
