/* eslint-disable no-empty */
;(function () {
  "use strict"

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn)
    else fn()
  }

  function forEachNodeList(list, cb) {
    if (!list) return
    if (typeof list.forEach === "function") return void list.forEach(cb)
    for (var i = 0; i < list.length; i++) cb(list[i], i)
  }

  function closest(el, sel) {
    if (!el) return null
    if (el.closest) return el.closest(sel)
    var n = el
    while (n && n.nodeType === 1) {
      if ((n.matches || n.msMatchesSelector || n.webkitMatchesSelector).call(n, sel)) return n
      n = n.parentElement || n.parentNode
    }
    return null
  }

  function getTargetId(a) {
    var id = a.getAttribute("aria-controls") || a.getAttribute("data-id")
    if (!id) {
      var href = a.getAttribute("href") || ""
      var i = href.indexOf("#")
      if (i >= 0) id = href.slice(i + 1)
    }
    return id
  }

  function setOpen(toggle, body, open) {
    toggle.setAttribute("aria-expanded", String(open))
    if (open) {
      body.classList.add("in", "show")
      body.classList.remove("collapse", "collapsed")
      body.style.height = "auto"
      var g1 = closest(toggle, ".accordion-group")
      if (g1) g1.classList.add("active")
    } else {
      body.classList.remove("in", "show", "open", "expanded")
      body.classList.add("collapse")
      body.style.height = "0px"
      var g2 = closest(toggle, ".accordion-group")
      if (g2) g2.classList.remove("active")
    }
  }

  function closeSiblingsIfGrouped(activeToggle) {
    var parentSel = activeToggle.getAttribute("data-parent")
    if (!parentSel) return
    var parent = document.querySelector(parentSel)
    if (!parent) return
    var toggles = parent.querySelectorAll('a.accordion-toggle[data-parent="' + parentSel + '"]')
    forEachNodeList(toggles, function (t) {
      if (t === activeToggle) return
      var id = getTargetId(t)
      if (!id) return
      var p =
        document.getElementById(id) ||
        closest(t, ".accordion-group")?.querySelector(".accordion-body")
      if (p) setOpen(t, p, false)
    })
  }

  function handleToggle(ev, explicitToggle) {
    var toggle =
      explicitToggle || (ev && ev.target ? closest(ev.target, "a.accordion-toggle") : null)
    if (!toggle) return
    var content = document.getElementById("content")
    if (!content || !content.contains(toggle)) return

    var id = getTargetId(toggle)
    if (!id) return
    var body =
      document.getElementById(id) ||
      closest(toggle, ".accordion-group")?.querySelector(".accordion-body")
    if (!body) return

    var open = body.classList.contains("in") || body.classList.contains("show")
    setOpen(toggle, body, !open)
    if (!open) closeSiblingsIfGrouped(toggle)
  }

  function initQAAccordions() {
    var content = document.getElementById("content")
    if (!content) return
    if (content._qaAccordionBound) return
    content._qaAccordionBound = true

    var toggles = content.querySelectorAll("a.accordion-toggle")
    forEachNodeList(toggles, function (a) {
      var id = getTargetId(a)
      if (id) {
        a.setAttribute("href", "#" + id)
        a.setAttribute("aria-controls", id)
        a.setAttribute("role", "button")
        a.setAttribute("tabindex", "0")
      }
    })
    forEachNodeList(toggles, function (a) {
      var id = a.getAttribute("aria-controls")
      if (!id) return
      var body = document.getElementById(id)
      if (!body) return
      var isOpen = body.classList.contains("in") || body.classList.contains("show")
      a.setAttribute("aria-expanded", isOpen ? "true" : "false")
      if (!isOpen) {
        body.style.height = "0px"
        body.style.overflow = "hidden"
      }
      var g = closest(a, ".accordion-group")
      if (g) g.classList.toggle("active", isOpen)
    })

    // direct handler — mark handled & stop bubbling to avoid double toggle
    forEachNodeList(toggles, function (a) {
      a.addEventListener("click", function (ev) {
        ev.preventDefault()
        ev._qaHandled = true
        handleToggle(ev, a)
        ev.stopPropagation()
        return false
      })
    })

    // delegated safety net (for dynamic nodes)
    content.addEventListener("click", function (e) {
      if (e._qaHandled) return
      if (!closest(e.target, "a.accordion-toggle")) return
      e.preventDefault()
      handleToggle(e, null)
    })

    // keyboard
    content.addEventListener("keydown", function (e) {
      var k = e.key || e.code
      if (k !== "Enter" && k !== " " && k !== "Space") return
      var t = e.target ? closest(e.target, "a.accordion-toggle") : null
      if (!t) return
      e.preventDefault()
      handleToggle(null, t)
    })
  }

  ready(function () {
    initQAAccordions()
    try {
      window.initQAAccordions = initQAAccordions
    } catch {}
  })
})()
