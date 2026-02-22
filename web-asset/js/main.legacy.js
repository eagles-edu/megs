/**
 * Main Bundle (Legacy ES5) - Eagles Club
 * Fallback for older browsers without ES6 module support
 * Combines: template592f.js + left-menu.js + flyout-menu.js + qa-accordion.js
 */
;(function () {
  ;("use strict")

  // Utilities
  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn)
    } else {
      fn()
    }
  }

  function forEachNodeList(list, cb) {
    if (!list) return
    if (typeof list.forEach === "function") {
      list.forEach(cb)
      return
    }
    for (var i = 0; i < list.length; i++) cb(list[i], i)
  }

  function closest(el, selector) {
    if (!el) return null
    if (el.closest) return el.closest(selector)
    var node = el
    while (node && node.nodeType === 1) {
      if (matches(node, selector)) return node
      node = node.parentElement || node.parentNode
    }
    return null
  }

  function matches(el, selector) {
    if (!el) return false
    var fn = el.matches || el.msMatchesSelector || el.webkitMatchesSelector
    if (fn) return fn.call(el, selector)
    var scope =
      el.parentElement || el.parentNode || (typeof document !== "undefined" ? document : null)
    if (!scope || !scope.querySelectorAll) return false
    var nodelist = scope.querySelectorAll(selector)
    for (var i = 0; i < nodelist.length; i++) if (nodelist[i] === el) return true
    return false
  }

  // Ensure pager labels truncate consistently, even on legacy pages without .pager-label markup.
  function normalizePagerLabels() {
    var pagerLinks = document.querySelectorAll(".pager > li > a")
    if (!pagerLinks || !pagerLinks.length) return

    Array.prototype.forEach.call(pagerLinks, function (link) {
      if (link.querySelector(".pager-label")) return

      var labelSources = []
      var removableNodes = []

      Array.prototype.forEach.call(link.childNodes, function (node) {
        if (node.nodeType === 3) {
          if (node.textContent && node.textContent.trim()) labelSources.push(node.textContent)
          removableNodes.push(node)
          return
        }

        if (node.nodeType !== 1) return
        var tag = (node.tagName || "").toLowerCase()
        if (tag === "svg" || tag === "img") return
        labelSources.push(node.textContent || "")
        removableNodes.push(node)
      })

      var labelText = labelSources.join(" ").replace(/\s+/g, " ").trim()
      if (!labelText || !removableNodes.length) return

      var label = document.createElement("span")
      label.className = "pager-label"
      label.textContent = labelText
      link.insertBefore(label, removableNodes[0])
      Array.prototype.forEach.call(removableNodes, function (node) {
        if (node && node.parentNode) node.parentNode.removeChild(node)
      })
    })
  }

  function resolveTableWrapLegacySrc() {
    var scripts = document.getElementsByTagName("script")
    for (var i = scripts.length - 1; i >= 0; i--) {
      var srcAttr = scripts[i].getAttribute("src") || ""
      if (!srcAttr) continue
      if (srcAttr.indexOf("main.legacy.js") === -1) continue
      var absolute = scripts[i].src || srcAttr
      return absolute.replace(/main\.legacy\.js(?:\?.*)?$/, "tablewrap.legacy.js")
    }
    return ""
  }

  function resolveTableWrapCssSrc() {
    var legacySrc = resolveTableWrapLegacySrc()
    if (!legacySrc) return ""
    return legacySrc.replace(/\/js\/tablewrap\.legacy\.js(?:\?.*)?$/, "/css/tablewrap.css")
  }

  function hasTableWrapCandidates() {
    var scope = document.querySelector("main#content, #content") || document
    var tables = scope.querySelectorAll("table")
    return Boolean(tables && tables.length)
  }

  function ensureTableWrapStylesheet(done) {
    var callback = typeof done === "function" ? done : function () {}
    var href = resolveTableWrapCssSrc()
    if (!href) {
      callback()
      return
    }

    if (window.__tableWrapStylesLoaded) {
      callback()
      return
    }

    var existing = document.querySelector('link[data-tablewrap-styles="true"]')
    if (existing) {
      callback()
      return
    }

    var link = document.createElement("link")
    link.rel = "stylesheet"
    link.href = href
    link.setAttribute("data-tablewrap-styles", "true")
    link.onload = function () {
      window.__tableWrapStylesLoaded = true
      callback()
    }
    link.onerror = function () {
      callback()
    }
    document.head.appendChild(link)
  }

  function loadTableWrapLegacy() {
    if (window.__tableWrapLegacyLoading || window.__tableWrapLegacyLoaded) return
    var src = resolveTableWrapLegacySrc()
    if (!src) return

    window.__tableWrapLegacyLoading = true
    ensureTableWrapStylesheet(function () {
      var script = document.createElement("script")
      script.src = src
      script.async = true
      script.defer = true
      script.onload = function () {
        window.__tableWrapLegacyLoaded = true
        window.__tableWrapLegacyLoading = false
      }
      script.onerror = function () {
        window.__tableWrapLegacyLoading = false
      }
      document.head.appendChild(script)
    })
  }

  function scheduleTableWrapLegacy() {
    if (!hasTableWrapCandidates()) return
    loadTableWrapLegacy()
  }
  function normalizePathname(value) {
    if (!value) return "/"
    var normalized = String(value)
    try {
      normalized = decodeURIComponent(normalized)
      // eslint-disable-next-line no-empty
    } catch (_) {}
    normalized = normalized.replace(/\\/g, "/").replace(/\/{2,}/g, "/").toLowerCase()
    if (normalized.length > 1 && normalized.charAt(normalized.length - 1) === "/") {
      normalized = normalized.slice(0, -1)
    }
    return normalized || "/"
  }

  function resolveHrefPathname(hrefValue) {
    if (!hrefValue) return null
    var href = String(hrefValue).trim()
    if (!href || href.charAt(0) === "#") return null
    if (/^(mailto:|tel:|javascript:|data:)/i.test(href)) return null
    try {
      return normalizePathname(new URL(href, window.location.href).pathname)
      // eslint-disable-next-line no-empty
    } catch (_) {}
    return null
  }

  function buildCurrentPathAliases() {
    var current = normalizePathname(window.location.pathname || "/")
    var aliases = {}
    aliases[current] = true

    var parts = current.split("/")
    var basename = parts.length ? parts[parts.length - 1] : ""
    if (basename) aliases["/" + basename] = true

    var sectionMatch = current.match(/(?:^|\/)((exercise|lesson|list)-\d+-[^/]+)(?:\/|\.html$)/i)
    if (sectionMatch) {
      var sectionSlug = String(sectionMatch[1] || "").toLowerCase()
      var sectionType = String(sectionMatch[2] || "").toLowerCase()
      aliases["/" + sectionSlug + ".html"] = true
      if (sectionType === "exercise") aliases["/grammar-exercises.html"] = true
      if (sectionType === "lesson") aliases["/grammar-lessons.html"] = true
      if (sectionType === "list") aliases["/lists.html"] = true
    }

    if (/(?:^|\/)lists2(?:\/|$)/i.test(current)) aliases["/lists.html"] = true
    return aliases
  }

  function pathMatchesCurrentAliases(targetPath, aliases) {
    if (!targetPath || !aliases) return false
    for (var alias in aliases) {
      if (!Object.prototype.hasOwnProperty.call(aliases, alias) || !aliases[alias]) continue
      if (targetPath === alias || targetPath.slice(-alias.length) === alias) return true
    }
    return false
  }

  function markCurrentFromAnchor(anchor) {
    if (!anchor) return
    anchor.setAttribute("aria-current", "page")
    var listItem = closest(anchor, "li")
    while (listItem) {
      listItem.classList.add("current")
      listItem.classList.add("active")
      listItem = closest(listItem.parentElement, "li")
    }
  }

  function applyGlobalCurrentMenuState() {
    var aliases = buildCurrentPathAliases()
    var selectors = [
      "#sidebar .accordion-menu a[href]",
      "#sidebar-menu-mount .accordion-menu a[href]",
      ".r-flyout-menu a[href]",
    ]
    var links = document.querySelectorAll(selectors.join(","))
    if (!links || !links.length) return

    Array.prototype.forEach.call(links, function (link) {
      var targetPath = resolveHrefPathname(link.getAttribute("href"))
      if (!targetPath) return
      if (!pathMatchesCurrentAliases(targetPath, aliases)) return
      markCurrentFromAnchor(link)
    })
  }

  function normalizeLinkLabelText(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .replace(/^\s+|\s+$/g, "")
  }

  function isSectionRootPath(pathname) {
    return Boolean(pathname && /^\/(?:exercise|lesson|list)-\d+[^/]*\.html$/i.test(pathname))
  }

  function getSectionSlugFromRootPath(rootPath) {
    var match = String(rootPath || "").match(/^\/((?:exercise|lesson|list)-\d+[^/]*)\.html$/i)
    return match && match[1] ? String(match[1]).toLowerCase() : null
  }

  function getSectionTypeFromSlug(sectionSlug) {
    var match = String(sectionSlug || "").match(/^(exercise|lesson|list)-/i)
    return match && match[1] ? String(match[1]).toLowerCase() : ""
  }

  function isPathInSection(targetPath, sectionSlug) {
    if (!targetPath || !sectionSlug) return false
    return targetPath === "/" + sectionSlug + ".html" || targetPath.indexOf("/" + sectionSlug + "/") === 0
  }

  function toRelativeHref(targetPath) {
    var target = normalizePathname(targetPath)
    var current = normalizePathname(window.location.pathname || "/")
    var fromParts = current.split("/")
    var toParts = target.split("/")
    fromParts = fromParts.filter(Boolean)
    toParts = toParts.filter(Boolean)
    if (fromParts.length) fromParts.pop()
    var shared = 0
    while (
      shared < fromParts.length &&
      shared < toParts.length &&
      fromParts[shared] === toParts[shared]
    ) {
      shared += 1
    }
    var parts = []
    for (var up = shared; up < fromParts.length; up++) parts.push("..")
    for (var idx = shared; idx < toParts.length; idx++) parts.push(toParts[idx])
    return parts.join("/") || "./"
  }

  function collectSectionGroupsFromFlyout() {
    var groups = []
    var items = document.querySelectorAll(".r-flyout-menu > li[data-r-flyout-item]")
    if (!items || !items.length) return groups

    Array.prototype.forEach.call(items, function (item) {
      var header = null
      var children = item.children || []
      for (var i = 0; i < children.length; i++) {
        if (children[i].classList && children[i].classList.contains("item-wrapper")) {
          header = children[i]
          break
        }
      }
      if (!header) header = item.querySelector(".item-wrapper")
      if (!header) return

      var rootAnchor = header.querySelector(".r-flyout__link-wrap > a[href], .menu-link > a[href], a[href]")
      if (!rootAnchor) return
      var rootPath = resolveHrefPathname(rootAnchor.getAttribute("href"))
      if (!isSectionRootPath(rootPath)) return

      var sectionSlug = getSectionSlugFromRootPath(rootPath)
      var subPages = []
      var subAnchors = item.querySelectorAll(".r-flyout__sublist a[href], .ul-wrapper a[href]")
      Array.prototype.forEach.call(subAnchors, function (anchor) {
        var pagePath = resolveHrefPathname(anchor.getAttribute("href"))
        if (!pagePath || pagePath === rootPath || isSectionRootPath(pagePath)) return
        subPages.push({
          path: pagePath,
          label: normalizeLinkLabelText(anchor.textContent),
        })
      })

      groups.push({
        rootPath: rootPath,
        rootLabel: normalizeLinkLabelText(rootAnchor.textContent),
        sectionSlug: sectionSlug,
        sectionType: getSectionTypeFromSlug(sectionSlug),
        subPages: subPages,
      })
    })

    return groups
  }

  function collectSectionGroupsFromSidebar() {
    var groups = []
    var items = document.querySelectorAll(
      "#sidebar .accordion-menu > li, #sidebar-menu-mount .accordion-menu > li"
    )
    if (!items || !items.length) return groups

    Array.prototype.forEach.call(items, function (item) {
      var header = null
      var children = item.children || []
      for (var i = 0; i < children.length; i++) {
        if (children[i].classList && children[i].classList.contains("item-wrapper")) {
          header = children[i]
          break
        }
      }
      if (!header) header = item.querySelector(".item-wrapper")
      if (!header) return

      var rootAnchor = header.querySelector(".menu-link > a[href], a[href]")
      if (!rootAnchor) return
      var rootPath = resolveHrefPathname(rootAnchor.getAttribute("href"))
      if (!isSectionRootPath(rootPath)) return

      var sectionSlug = getSectionSlugFromRootPath(rootPath)
      var subPages = []
      var subAnchors = item.querySelectorAll(".ul-wrapper a[href]")
      Array.prototype.forEach.call(subAnchors, function (anchor) {
        var pagePath = resolveHrefPathname(anchor.getAttribute("href"))
        if (!pagePath || pagePath === rootPath || isSectionRootPath(pagePath)) return
        subPages.push({
          path: pagePath,
          label: normalizeLinkLabelText(anchor.textContent),
        })
      })

      groups.push({
        rootPath: rootPath,
        rootLabel: normalizeLinkLabelText(rootAnchor.textContent),
        sectionSlug: sectionSlug,
        sectionType: getSectionTypeFromSlug(sectionSlug),
        subPages: subPages,
      })
    })

    return groups
  }

  function dedupeSectionGroups(groups) {
    var deduped = []
    var seenRoots = {}
    Array.prototype.forEach.call(groups || [], function (group) {
      if (!group || !group.rootPath || seenRoots[group.rootPath]) return
      seenRoots[group.rootPath] = true
      var seenSubPaths = {}
      var subPages = []
      Array.prototype.forEach.call(group.subPages || [], function (page) {
        if (!page || !page.path || seenSubPaths[page.path]) return
        seenSubPaths[page.path] = true
        subPages.push(page)
      })
      deduped.push({
        rootPath: group.rootPath,
        rootLabel: group.rootLabel || "",
        sectionSlug: group.sectionSlug || getSectionSlugFromRootPath(group.rootPath),
        sectionType: group.sectionType || getSectionTypeFromSlug(group.sectionSlug || group.rootPath || ""),
        subPages: subPages,
      })
    })
    return deduped
  }

  function collectSectionGroups() {
    var fromFlyout = dedupeSectionGroups(collectSectionGroupsFromFlyout())
    if (fromFlyout.length) return fromFlyout
    return dedupeSectionGroups(collectSectionGroupsFromSidebar())
  }

  function updatePagerLinksByRel(rel, targetPath, targetLabel, replaceLabel) {
    if (!targetPath) return
    var href = toRelativeHref(targetPath)
    var links = document.querySelectorAll('.pager a[rel="' + rel + '"]')
    if (!links || !links.length) return
    Array.prototype.forEach.call(links, function (link) {
      link.setAttribute("href", href)
      if (!replaceLabel || !targetLabel) return
      var labelNode = link.querySelector(".pager-label")
      if (labelNode) labelNode.textContent = targetLabel
    })
  }

  function normalizeSectionPagerNavigation() {
    var currentPath = normalizePathname(window.location.pathname || "/")
    if (!/(?:^|\/)(exercise|lesson|list)-\d+/i.test(currentPath)) return

    var groups = collectSectionGroups()
    if (!groups.length) return

    var pathLabels = {}
    Array.prototype.forEach.call(groups, function (group) {
      if (group.rootPath && group.rootLabel) pathLabels[group.rootPath] = group.rootLabel
      Array.prototype.forEach.call(group.subPages || [], function (page) {
        if (page.path && page.label) pathLabels[page.path] = page.label
      })
    })
    if (!pathLabels["/grammar-exercises.html"]) pathLabels["/grammar-exercises.html"] = "Grammar Exercises"
    if (!pathLabels["/grammar-lessons.html"]) pathLabels["/grammar-lessons.html"] = "Grammar Lessons"
    if (!pathLabels["/lists.html"]) pathLabels["/lists.html"] = "Lists"

    var match = null
    var prefixFallback = null
    for (var groupIndex = 0; groupIndex < groups.length; groupIndex++) {
      var group = groups[groupIndex]
      if (!group || !group.rootPath) continue
      if (group.rootPath === currentPath) {
        match = { group: group, groupIndex: groupIndex, isRoot: true, subIndex: -1 }
        break
      }
      for (var subIndex = 0; subIndex < group.subPages.length; subIndex++) {
        if (group.subPages[subIndex].path !== currentPath) continue
        match = { group: group, groupIndex: groupIndex, isRoot: false, subIndex: subIndex }
        break
      }
      if (match) break
      if (!prefixFallback && isPathInSection(currentPath, group.sectionSlug)) {
        prefixFallback = {
          group: group,
          groupIndex: groupIndex,
          isRoot: false,
          subIndex: -1,
          byPrefixOnly: true,
        }
      }
    }

    if (!match) match = prefixFallback
    if (!match || !match.group) return

    var prevPath = null
    var nextPath = null
    var forcePrevLabel = false
    var forceNextLabel = false
    if (match.isRoot) {
      var prevGroup = match.groupIndex > 0 ? groups[match.groupIndex - 1] : null
      var nextGroup = match.groupIndex + 1 < groups.length ? groups[match.groupIndex + 1] : null
      var sectionHomePath =
        match.group.sectionType === "exercise"
          ? "/grammar-exercises.html"
          : match.group.sectionType === "lesson"
            ? "/grammar-lessons.html"
            : match.group.sectionType === "list"
              ? "/lists.html"
              : null
      if (prevGroup && prevGroup.rootPath) prevPath = prevGroup.rootPath
      else if (sectionHomePath) prevPath = sectionHomePath
      if (nextGroup && nextGroup.rootPath) nextPath = nextGroup.rootPath
      else if (sectionHomePath) nextPath = sectionHomePath
      forcePrevLabel = false
      forceNextLabel = false
    } else if (match.byPrefixOnly) {
      var prevLink = document.querySelector('.pager a[rel="prev"]')
      var nextLink = document.querySelector('.pager a[rel="next"]')
      var prevCurrent = prevLink ? resolveHrefPathname(prevLink.getAttribute("href")) : null
      var nextCurrent = nextLink ? resolveHrefPathname(nextLink.getAttribute("href")) : null
      var knownPaths = {}
      knownPaths[match.group.rootPath] = true
      Array.prototype.forEach.call(match.group.subPages || [], function (page) {
        if (page && page.path) knownPaths[page.path] = true
      })
      if (prevCurrent && !isPathInSection(prevCurrent, match.group.sectionSlug)) {
        prevPath = match.group.rootPath
        forcePrevLabel = true
      }
      if (nextCurrent && !isPathInSection(nextCurrent, match.group.sectionSlug)) {
        nextPath = match.group.rootPath
        forceNextLabel = true
      }
      var strictUnknownTargets = match.group.sectionType && match.group.sectionType !== "list"
      if (
        strictUnknownTargets &&
        prevCurrent &&
        isPathInSection(prevCurrent, match.group.sectionSlug) &&
        prevCurrent !== match.group.rootPath &&
        !knownPaths[prevCurrent]
      ) {
        prevPath = match.group.rootPath
        forcePrevLabel = true
      }
      if (
        strictUnknownTargets &&
        nextCurrent &&
        isPathInSection(nextCurrent, match.group.sectionSlug) &&
        nextCurrent !== match.group.rootPath &&
        !knownPaths[nextCurrent]
      ) {
        nextPath = match.group.rootPath
        forceNextLabel = true
      }
    } else {
      var pages = match.group.subPages
      if (!pages || !pages.length) return
      prevPath = match.subIndex > 0 ? pages[match.subIndex - 1].path : match.group.rootPath
      nextPath = match.subIndex + 1 < pages.length ? pages[match.subIndex + 1].path : match.group.rootPath
    }

    if (prevPath) updatePagerLinksByRel("prev", prevPath, pathLabels[prevPath] || "", forcePrevLabel)
    if (nextPath) updatePagerLinksByRel("next", nextPath, pathLabels[nextPath] || "", forceNextLabel)
  }

  // Left Menu Module
  function initLeftMenu() {
    var menu = document.getElementById("accordion_menu_90")
    if (!menu) return

    var items = menu.children
    Array.prototype.forEach.call(items, function (li) {
      if (!(li && li.tagName === "LI")) return
      var wrapper = li.querySelector(".ul-wrapper")
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
  }

  // Flyout Menu Module
  function initFlyoutMenu() {
    var menus = document.querySelectorAll("ul.flyout-menu")
    if (!menus || !menus.length) return

    Array.prototype.forEach.call(menus, function (menu) {
      if (menu.__flyoutBound) return
      menu.__flyoutBound = true

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

      var lis = menu.querySelectorAll("li")
      Array.prototype.forEach.call(lis, function (li) {
        var wrapper = li.querySelector(".ul-wrapper")
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

  // QA Accordion Module system
  function initQAAccordion() {
    var content = document.getElementById("content")
    if (!content) return

    var allToggles = content.querySelectorAll("a.accordion-toggle")
    forEachNodeList(allToggles, function (a) {
      var tid = a.getAttribute("data-id")
      if (!tid) {
        var href = a.getAttribute("href") || ""
        var i = href.indexOf("#")
        if (i >= 0) tid = href.slice(i + 1)
      }
      if (tid) {
        a.setAttribute("href", "#" + tid)
        a.setAttribute("aria-controls", tid)
        a.setAttribute("role", "button")
        a.setAttribute("tabindex", "0")
      }
    })

    forEachNodeList(allToggles, function (a) {
      var tid = a.getAttribute("aria-controls")
      if (!tid) return
      var body = document.getElementById(tid)
      if (!body) return
      var isOpen = body.classList.contains("in") || body.classList.contains("show")
      a.setAttribute("aria-expanded", isOpen ? "true" : "false")
      var group = closest(a, ".accordion-group")
      if (group) {
        if (isOpen) group.classList.add("active")
        else group.classList.remove("active")
      }
      if (!isOpen) {
        body.style.height = "0px"
        body.style.overflow = "hidden"
      }
    })

    function handleToggleClick(ev, explicitToggle) {
      var toggle =
        explicitToggle || (ev && ev.target ? closest(ev.target, "a.accordion-toggle") : null)
      if (!toggle || !content.contains(toggle)) return
      if (ev) ev.preventDefault()

      var targetId = toggle.getAttribute("data-id")
      if (!targetId) {
        var href = toggle.getAttribute("href") || ""
        var idx = href.indexOf("#")
        if (idx >= 0) targetId = href.slice(idx + 1)
      }
      if (!targetId) return

      var body = document.getElementById(targetId)
      if (!body) {
        var groupFallback = closest(toggle, ".accordion-group")
        if (groupFallback) body = groupFallback.querySelector(".accordion-body")
      }
      if (!body) return

      var group = closest(toggle, ".accordion-group")
      var parentSelector = toggle.getAttribute("data-parent")
      var isOpen = body.classList.contains("in") || body.classList.contains("show")

      if (parentSelector) {
        try {
          var parent = document.querySelector(parentSelector)
          if (parent) {
            var openBodies = parent.querySelectorAll(".accordion-body.in, .accordion-body.show")
            forEachNodeList(openBodies, function (ob) {
              if (ob === body) return
              ob.classList.remove("in")
              ob.classList.remove("show")
              ob.style.height = "0px"
              var og = closest(ob, ".accordion-group")
              if (og) og.classList.remove("active")
              var tgl = og ? og.querySelector(".accordion-heading .accordion-toggle") : null
              if (tgl) tgl.setAttribute("aria-expanded", "false")
            })
          }
          // eslint-disable-next-line no-empty, no-unused-vars
        } catch (_) {}
      }

      if (isOpen) {
        body.classList.remove("in")
        body.classList.remove("show")
        body.style.height = "0px"
        toggle.setAttribute("aria-expanded", "false")
        if (group) group.classList.remove("active")
      } else {
        body.classList.add("in")
        body.classList.add("show")
        body.style.height = "auto"
        toggle.setAttribute("aria-expanded", "true")
        if (group) group.classList.add("active")
      }
    }

    forEachNodeList(allToggles, function (a) {
      a.addEventListener("click", function (ev) {
        handleToggleClick(ev, a)
      })
    })

    content.addEventListener("click", function (e) {
      handleToggleClick(e, null)
    })

    content.addEventListener("keydown", function (e) {
      var key = e.key || e.code
      if (key !== "Enter" && key !== " " && key !== "Space") return
      var toggle = e.target ? closest(e.target, "a.accordion-toggle") : null
      if (!toggle || !content.contains(toggle)) return
      e.preventDefault()
      toggle.click()
    })
  }

  // Mobile Navigation (ES5 compatible)
  function MobileNavigation() {
    this.sidebar = null
    this.toggleButton = null
    this.overlay = null
    this.menuTemplate = null
    this.menuMount = null
    this.isOpen = false
    this.mediaQuery = window.matchMedia("(max-width: 766px)")
    this.init()
  }

  MobileNavigation.prototype.init = function () {
    this.createMobileElements()
    if (!this.sidebar || !this.toggleButton || !this.overlay) return
    document.body.classList.add("mobile-nav-enabled")
    this.bindEvents()
    this.handleResize()
    var self = this
    var onChange = function () {
      self.handleResize()
    }
    if (this.mediaQuery.addEventListener) {
      this.mediaQuery.addEventListener("change", onChange)
    } else if (this.mediaQuery.addListener) {
      this.mediaQuery.addListener(onChange)
    }
    if (!this.mediaQuery.matches) this.mountMenuIfNeeded()
  }

  MobileNavigation.prototype.createMobileElements = function () {
    this.sidebar = document.getElementById("sidebar")
    if (!this.sidebar) return
    this.sidebar.setAttribute("role", "navigation")
    this.sidebar.setAttribute("aria-label", "Main menu")

    this.menuTemplate = document.getElementById("sidebar-menu-template")
    this.menuMount = document.getElementById("sidebar-menu-mount")

    this.toggleButton = document.querySelector(".mobile-menu-toggle")
    this.overlay = document.querySelector(".mobile-nav-overlay")

    if (!this.toggleButton) {
      this.toggleButton = document.createElement("button")
      this.toggleButton.className = "mobile-menu-toggle"
      this.toggleButton.setAttribute("aria-label", "Main menu")
      this.toggleButton.setAttribute("aria-expanded", "false")
      this.toggleButton.setAttribute("aria-controls", "sidebar")
      this.toggleButton.setAttribute("aria-haspopup", "true")
      this.toggleButton.type = "button"
      document.body.appendChild(this.toggleButton)
    }

    if (!this.overlay) {
      this.overlay = document.createElement("div")
      this.overlay.className = "mobile-nav-overlay"
      this.overlay.setAttribute("aria-hidden", "true")
      document.body.appendChild(this.overlay)
    }
  }

  MobileNavigation.prototype.bindEvents = function () {
    var self = this
    this.toggleButton.addEventListener("click", function (e) {
      e.preventDefault()
      self.toggleMenu()
    })

    this.overlay.addEventListener("click", function () {
      self.closeMenu()
    })

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && self.isOpen) {
        self.closeMenu()
        self.toggleButton.focus()
      }
    })

    this.sidebar.addEventListener("click", function (e) {
      if (self.mediaQuery.matches && e.target.tagName === "A") {
        window.setTimeout(function () {
          self.closeMenu()
        }, 150)
      }
    })

    window.addEventListener("resize", function () {
      if (!self.mediaQuery.matches && self.isOpen) self.closeMenu()
    })
  }

  MobileNavigation.prototype.toggleMenu = function () {
    this.isOpen ? this.closeMenu() : this.openMenu()
  }

  MobileNavigation.prototype.openMenu = function () {
    if (!this.mediaQuery.matches) return
    this.mountMenuIfNeeded()
    this.isOpen = true
    document.body.classList.add("mobile-nav-open")
    this.sidebar.classList.add("mobile-nav-open")
    this.overlay.style.display = "block"
    this.overlay.classList.add("active")
    this.toggleButton.classList.add("open")
    this.toggleButton.setAttribute("aria-expanded", "true")
    this.overlay.setAttribute("aria-hidden", "false")
    var firstLink = this.sidebar.querySelector(".accordion-menu a, .flyout-menu a")
    if (firstLink) firstLink.focus()
  }

  MobileNavigation.prototype.closeMenu = function () {
    this.isOpen = false
    document.body.classList.remove("mobile-nav-open")
    this.sidebar.classList.remove("mobile-nav-open")
    this.overlay.classList.remove("active")
    this.overlay.style.display = "none"
    this.toggleButton.classList.remove("open")
    this.toggleButton.setAttribute("aria-expanded", "false")
    this.overlay.setAttribute("aria-hidden", "true")
  }

  MobileNavigation.prototype.handleResize = function () {
    if (!this.mediaQuery.matches && this.isOpen) this.closeMenu()
    if (!this.mediaQuery.matches) this.mountMenuIfNeeded()
  }

  MobileNavigation.prototype.mountMenuIfNeeded = function () {
    if (!this.menuTemplate || !this.menuMount) return
    if (this.menuMount.childNodes && this.menuMount.childNodes.length) return
    try {
      var frag = this.menuTemplate.content
        ? this.menuTemplate.content.cloneNode(true)
        : function () {
            var t = document.createElement("div")
            t.innerHTML = this.menuTemplate.innerHTML
            return t
          }.call(this)
      this.menuMount.appendChild(frag)
      this.menuMount.removeAttribute("aria-hidden")

      var menu = this.menuMount.querySelector("#accordion_menu_90")
      if (menu) {
        Array.prototype.forEach.call(menu.children, function (li) {
          if (!(li && li.tagName === "LI")) return
          var wrapper = li.querySelector(".ul-wrapper")
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
      }
      applyGlobalCurrentMenuState()
      // eslint-disable-next-line no-unused-vars
    } catch (e) {
      // no-op
    }
  }

  // jQuery compatibility
  function initJQueryCompat() {
    if (!window.jQuery) return

    var $ = window.jQuery

    $(document)
      .on("click", ".btn-group label:not(.active)", function () {
        var $label = $(this)
        var $input = $("#" + $label.attr("for"))

        if ($input.prop("checked")) return

        $label
          .closest(".btn-group")
          .find("label")
          .removeClass("active btn-success btn-danger btn-primary")

        var btnClass = "primary"
        if ($input.val() != "") {
          var reversed = $label.closest(".btn-group").hasClass("btn-group-reversed")
          btnClass = ($input.val() == 0 ? !reversed : reversed) ? "danger" : "success"
        }

        $label.addClass("active btn-" + btnClass)
        $input.prop("checked", true).trigger("change")
      })
      .on("click", "#back-top", function (e) {
        e.preventDefault()
        $("html, body").animate({ scrollTop: 0 }, 1000)
      })
  }

  // Initialize everything
  function initApp() {
    try {
      normalizePagerLabels()
      normalizeSectionPagerNavigation()
      scheduleTableWrapLegacy()
      initLeftMenu()
      initFlyoutMenu()
      initQAAccordion()
      new MobileNavigation()
      applyGlobalCurrentMenuState()
      initJQueryCompat()
      window._qaAccordionBound = true
    } catch (e) {
      if (console && console.warn) console.warn("Bundle init error:", e)
    }
  }

  // Run on DOM ready
  ready(initApp)
})()
