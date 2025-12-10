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

  function closest(element, selector) {
    if (!element) return null
    if (element.closest) return element.closest(selector)
    var node = element
    while (node) {
      if (node.matches && node.matches(selector)) return node
      node = node.parentElement
    }
    return null
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

  function normalizePathname(pathname) {
    if (!pathname) return ""
    var normalized = pathname
    try {
      normalized = decodeURIComponent(normalized)
    } catch {
      /* ignore decode errors */
    }
    normalized = normalized.replace(/\\/g, "/")
    normalized = normalized.replace(/[#?].*$/, "")
    normalized = normalized.replace(/\/index\.html?$/i, "/")
    if (normalized.length > 1) normalized = normalized.replace(/\/+$/, "/")
    return normalized.toLowerCase()
  }

  function findActiveAnchor(menu, currentPath) {
    var anchors = menu.querySelectorAll("a[href]")
    var active = null
    forEach(anchors, function (anchor) {
      if (active) return
      var href = anchor.getAttribute("href")
      if (!href || href.charAt(0) === "#") return
      var url
      try {
        url = new URL(href, window.location.href)
      } catch {
        return
      }
      var anchorPath = normalizePathname(url.pathname)
      if (!anchorPath) return
      if (anchorPath === currentPath || currentPath === anchorPath + "/") {
        active = anchor
      }
    })
    return active
  }

  function applyActiveState(menu) {
    var currentPath = normalizePathname(window.location && window.location.pathname)
    if (!currentPath) return

    var activeAnchor = findActiveAnchor(menu, currentPath)
    if (!activeAnchor) return

    var currentItems = menu.querySelectorAll(
      "[data-r-flyout-item].current, .r-flyout__sublist li.current, .r-flyout__sublist li.active"
    )
    forEach(currentItems, function (item) {
      item.classList.remove("current")
      item.classList.remove("active")
    })

    var subItem = closest(activeAnchor, ".r-flyout__sublist li")
    if (subItem) {
      subItem.classList.add("current")
      subItem.classList.add("active")
    }

    var parentItem = closest(activeAnchor, "[data-r-flyout-item]")
    if (parentItem) {
      parentItem.classList.add("current")
    }
  }

  ready(function () {
    var menus = document.querySelectorAll("[data-r-flyout]")
    forEach(menus, function (menu) {
      if (menu.__rFlyoutBound) return
      menu.__rFlyoutBound = true

      applyActiveState(menu)

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
