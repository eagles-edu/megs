// Flyout Menus behavior (vanilla JS)
// - Hover expand/collapse for ul.flyout-menu in #aside/#sidebar
// /* eslint-env browser 
(function () {
  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn)
    } else {
      fn()
    }
  }

  function bindFlyouts() {
    var menus = document.querySelectorAll("ul.flyout-menu, ul.r-flyout-menu")
    if (!menus || !menus.length) return

    menus.forEach(function (menu) {
      // Prevent duplicate binding
      if (menu.__flyoutBound) return
      menu.__flyoutBound = true

      // Navigate on click, preserving target behavior
      menu.addEventListener("click", function (e) {
        var a = e.target && e.target.closest ? e.target.closest("a") : null
        if (!a || !menu.contains(a)) return
        var href = a.getAttribute("href")
        if (!href) return
        e.preventDefault()
        if (a.getAttribute("target") === "_blank") {
          window.open(href)
        } else {
          window.location.href = href
        }
      })

      // Hover open/close of nested lists + toggle plus/minus icon
      menu.querySelectorAll("li").forEach(function (li) {
        var wrapper = li.querySelector(":scope > .ul-wrapper")
        if (!wrapper) return
        li.addEventListener("mouseenter", function () {
          li.classList.add("opened")
          wrapper.style.display = "block"
        })
        li.addEventListener("mouseleave", function () {
          li.classList.remove("opened")
          wrapper.style.display = "none"
        })
      })
    })
  }

  ready(bindFlyouts)
})()
