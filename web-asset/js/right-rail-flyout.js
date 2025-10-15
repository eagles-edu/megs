(function () {
  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn)
    } else {
      fn()
    }
  }

  function forEach(collection, iteratee) {
    if (!collection) return
    Array.prototype.forEach.call(collection, iteratee)
  }

  function closeSiblings(menu, currentItem) {
    var openItems = menu.querySelectorAll("[data-r-flyout-item].is-open")
    forEach(openItems, function (item) {
      if (item === currentItem) return
      var toggle = item.querySelector(".r-flyout__toggle")
      var panel = item.querySelector(".r-flyout__panel")
      if (!toggle || !panel) return
      delete item.dataset.rflyoutSticky
      if (!panel.hasAttribute("hidden")) panel.setAttribute("hidden", "")
      panel.setAttribute("aria-hidden", "true")
      item.classList.remove("is-open")
      toggle.setAttribute("aria-expanded", "false")
    })
  }

  ready(function () {
    var menus = document.querySelectorAll("[data-r-flyout]")
    forEach(menus, function (menu) {
      if (menu.__rFlyoutBound) return
      menu.__rFlyoutBound = true

      var items = menu.querySelectorAll("[data-r-flyout-item]")
      forEach(items, function (item, index) {
        var toggle = item.querySelector(".r-flyout__toggle")
        var panel = item.querySelector(".r-flyout__panel")
        if (!toggle || !panel) return

        var panelId = panel.id
        if (!panelId) {
          panelId = (menu.id || "r-flyout-menu") + "-panel-" + index
          panel.id = panelId
        }
        toggle.setAttribute("aria-controls", panelId)
        toggle.setAttribute("aria-haspopup", "true")

        var shouldStartOpen =
          panel.getAttribute("aria-hidden") === "false" ||
          !panel.hasAttribute("hidden") ||
          item.dataset.rflyoutStart === "open" ||
          item.dataset.rflyoutStart === "true"

        function setSticky(enabled) {
          if (enabled) item.dataset.rflyoutSticky = "true"
          else delete item.dataset.rflyoutSticky
        }

        function isSticky() {
          return item.dataset.rflyoutSticky === "true"
        }

        function open(sticky) {
          if (!isSticky()) closeSiblings(menu, item)
          if (sticky) setSticky(true)
          if (panel.hasAttribute("hidden")) panel.removeAttribute("hidden")
          panel.setAttribute("aria-hidden", "false")
          item.classList.add("is-open")
          toggle.setAttribute("aria-expanded", "true")
        }

        function close(force) {
          if (!force && isSticky()) return
          if (!panel.hasAttribute("hidden")) panel.setAttribute("hidden", "")
          panel.setAttribute("aria-hidden", "true")
          item.classList.remove("is-open")
          toggle.setAttribute("aria-expanded", "false")
          if (force) setSticky(false)
        }

        if (shouldStartOpen) {
          open(true)
        } else {
          close(true)
        }

        toggle.addEventListener("click", function (event) {
          event.preventDefault()
          var isOpen = item.classList.contains("is-open") && !panel.hasAttribute("hidden")
          if (isOpen && isSticky()) {
            close(true)
          } else {
            open(true)
          }
        })

        item.addEventListener("mouseenter", function () {
          if (window.matchMedia && !window.matchMedia("(hover: hover)").matches) return
          if (isSticky()) return
          open(false)
        })

        item.addEventListener("mouseleave", function () {
          if (!isSticky()) close(false)
        })

        item.addEventListener("focusin", function () {
          if (!isSticky()) closeSiblings(menu, item)
          open(false)
        })

        item.addEventListener("focusout", function (event) {
          if (item.contains(event.relatedTarget)) return
          if (!isSticky()) close(false)
        })

        panel.addEventListener("keydown", function (event) {
          var key = event.key || event.keyCode
          if (key === "Escape" || key === "Esc" || key === 27) {
            close(true)
            toggle.focus()
          }
        })
      })
    })
  })
})()
