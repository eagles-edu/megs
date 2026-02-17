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

  function normalizeLabelText(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .replace(/^\s+|\s+$/g, "")
  }

  function isListSectionPage() {
    var body = document.body
    if (body && body.classList && body.classList.contains("list")) return true
    var path = String((window.location && window.location.pathname) || "").toLowerCase()
    return /(?:^|\/)(list-\d+|list-\d+-|lists2\/|lists\.html$)/.test(path)
  }

  function expandRowCells(row) {
    if (!row || !row.cells) return []
    var expanded = []
    for (var i = 0; i < row.cells.length; i++) {
      var cell = row.cells[i]
      var span = parseInt(cell.getAttribute("colspan") || "1", 10)
      if (!span || span < 1) span = 1
      for (var step = 0; step < span; step++) expanded.push(cell)
    }
    return expanded
  }

  function getTableColumnCount(table) {
    if (!table || !table.rows) return 0
    var maxColumns = 0
    for (var i = 0; i < table.rows.length; i++) {
      var row = table.rows[i]
      var columns = 0
      for (var j = 0; j < row.cells.length; j++) {
        var span = parseInt(row.cells[j].getAttribute("colspan") || "1", 10)
        if (!span || span < 1) span = 1
        columns += span
      }
      if (columns > maxColumns) maxColumns = columns
    }
    return maxColumns
  }

  function getColumnLabels(table, columnCount) {
    var labels = []
    var headRows = table && table.tHead ? table.tHead.rows : null
    if (headRows && headRows.length) {
      for (var i = headRows.length - 1; i >= 0; i--) {
        var rowCells = headRows[i].cells || []
        if (rowCells.length === 1) {
          var span = parseInt(rowCells[0].getAttribute("colspan") || "1", 10)
          if (!span || span < 1) span = 1
          if (span >= columnCount) {
            if (headRows.length === 1) {
              for (var empty = 0; empty < columnCount; empty++) labels.push("Column " + (empty + 1))
              return labels
            }
            continue
          }
        }

        var expanded = expandRowCells(headRows[i])
        if (!expanded.length) continue
        for (var col = 0; col < columnCount; col++) {
          var raw = expanded[col] ? normalizeLabelText(expanded[col].textContent) : ""
          labels.push(raw || "Column " + (col + 1))
        }
        return labels
      }
    }
    for (var fallback = 0; fallback < columnCount; fallback++) {
      labels.push("Column " + (fallback + 1))
    }
    return labels
  }

  function hasRepeatedPairHeaders(table) {
    if (!table || !table.tHead || !table.tHead.rows || !table.tHead.rows.length) return false
    for (var i = table.tHead.rows.length - 1; i >= 0; i--) {
      var expanded = expandRowCells(table.tHead.rows[i])
      if (expanded.length < 4) continue
      if (
        expanded[0] === expanded[1] ||
        expanded[0] === expanded[2] ||
        expanded[0] === expanded[3] ||
        expanded[1] === expanded[2] ||
        expanded[1] === expanded[3] ||
        expanded[2] === expanded[3]
      ) {
        return false
      }
      var leftA = normalizeLabelText(expanded[0] ? expanded[0].textContent : "").toLowerCase()
      var leftB = normalizeLabelText(expanded[1] ? expanded[1].textContent : "").toLowerCase()
      var rightA = normalizeLabelText(expanded[2] ? expanded[2].textContent : "").toLowerCase()
      var rightB = normalizeLabelText(expanded[3] ? expanded[3].textContent : "").toLowerCase()
      return Boolean(leftA && leftB && leftA === rightA && leftB === rightB)
    }
    return false
  }

  function isPairLayoutTable(table, columnCount, explicitMode) {
    if (explicitMode === "pairs") return true
    if (columnCount !== 4 && columnCount !== 5) return false
    if (columnCount === 4 && !hasRepeatedPairHeaders(table)) return false

    var rowGroups = []
    if (table.tBodies && table.tBodies.length) {
      for (var i = 0; i < table.tBodies.length; i++) rowGroups.push(table.tBodies[i])
    } else {
      rowGroups.push(table)
    }

    var sampleRows = 0
    var spacerRows = 0
    for (var g = 0; g < rowGroups.length; g++) {
      var rows = rowGroups[g].rows || []
      for (var r = 0; r < rows.length; r++) {
        var row = rows[r]
        if (row.querySelector && row.querySelector("th")) continue
        var expanded = expandRowCells(row)
        if (expanded.length < columnCount) continue
        sampleRows += 1
        if (columnCount === 5) {
          var spacer = normalizeLabelText(expanded[2] ? expanded[2].textContent : "")
          if (!spacer) spacerRows += 1
        } else {
          spacerRows += 1
        }
      }
    }
    return sampleRows > 0 && spacerRows === sampleRows
  }

  function hasTitleOnlyHeader(table, columnCount) {
    var headRows = table && table.tHead ? table.tHead.rows : null
    if (!headRows || headRows.length !== 1) return false
    var cells = headRows[0].cells || []
    if (cells.length !== 1) return false
    var span = parseInt(cells[0].getAttribute("colspan") || "1", 10)
    if (!span || span < 1) span = 1
    return span >= columnCount
  }

  function isDatumListTable(table, columnCount, explicitMode) {
    if (explicitMode === "list") return true
    if (columnCount < 2 || columnCount > 6) return false
    if (!hasTitleOnlyHeader(table, columnCount)) return false

    var rowGroups = []
    if (table.tBodies && table.tBodies.length) {
      for (var i = 0; i < table.tBodies.length; i++) rowGroups.push(table.tBodies[i])
    }

    var filledCells = 0
    for (var g = 0; g < rowGroups.length; g++) {
      var rows = rowGroups[g].rows || []
      for (var r = 0; r < rows.length; r++) {
        var cells = rows[r].cells || []
        for (var c = 0; c < cells.length; c++) {
          if (normalizeLabelText(cells[c].textContent)) filledCells += 1
        }
      }
    }
    return filledCells > 0
  }

  function isSimpleTable(columnCount, explicitMode) {
    if (explicitMode === "simple") return true
    return columnCount >= 1 && columnCount <= 2
  }

  function createPairRow(keyCell, valueCell) {
    var keyText = normalizeLabelText(keyCell ? keyCell.textContent : "")
    var valueText = normalizeLabelText(valueCell ? valueCell.textContent : "")
    if (!keyText && !valueText) return null

    var row = document.createElement("tr")
    row.className = "table-pairs-mobile-row"

    var key = document.createElement("td")
    key.className = "table-pairs-key"
    key.innerHTML = keyCell ? keyCell.innerHTML : ""

    var value = document.createElement("td")
    value.className = "table-pairs-value"
    value.innerHTML = valueCell ? valueCell.innerHTML : ""

    row.appendChild(key)
    row.appendChild(value)
    return row
  }

  function rebuildPairRowsForMobile(table, columnCount) {
    if (!table || columnCount < 4) return
    if (table.querySelector("tbody.table-pairs-mobile-body")) {
      table.classList.add("table-pairs-rebuilt")
      return
    }

    var sourceBodies = []
    if (table.tBodies && table.tBodies.length) {
      for (var i = 0; i < table.tBodies.length; i++) sourceBodies.push(table.tBodies[i])
    }
    if (!sourceBodies.length) return

    var leftRows = []
    var rightRows = []
    for (var g = 0; g < sourceBodies.length; g++) {
      var body = sourceBodies[g]
      var rows = body.rows || []
      body.classList.add("table-pairs-source-body")
      for (var r = 0; r < rows.length; r++) {
        var row = rows[r]
        if (row.querySelector && row.querySelector("th")) continue
        var expanded = expandRowCells(row)
        if (expanded.length < columnCount) continue

        var leftRow = createPairRow(expanded[0], expanded[1])
        if (leftRow) leftRows.push(leftRow)

        var rightStart = columnCount - 2
        var rightRow = createPairRow(expanded[rightStart], expanded[rightStart + 1])
        if (rightRow) rightRows.push(rightRow)
      }
    }

    if (!leftRows.length && !rightRows.length) return

    var mobileBody = document.createElement("tbody")
    mobileBody.className = "table-pairs-mobile-body"
    for (var l = 0; l < leftRows.length; l++) mobileBody.appendChild(leftRows[l])
    for (var t = 0; t < rightRows.length; t++) mobileBody.appendChild(rightRows[t])

    table.appendChild(mobileBody)
    table.classList.add("table-pairs-rebuilt")
  }

  function rebuildDatumListForMobile(table) {
    if (!table) return
    if (table.querySelector("tbody.table-list-mobile-body")) {
      table.classList.add("table-list-rebuilt")
      return
    }

    var sourceBodies = []
    if (table.tBodies && table.tBodies.length) {
      for (var i = 0; i < table.tBodies.length; i++) sourceBodies.push(table.tBodies[i])
    }
    if (!sourceBodies.length) return

    var items = []
    for (var g = 0; g < sourceBodies.length; g++) {
      var body = sourceBodies[g]
      body.classList.add("table-list-source-body")
      var rows = body.rows || []
      for (var r = 0; r < rows.length; r++) {
        var cells = rows[r].cells || []
        for (var c = 0; c < cells.length; c++) {
          if (!normalizeLabelText(cells[c].textContent)) continue
          items.push(cells[c])
        }
      }
    }

    if (!items.length) return

    var mobileBody = document.createElement("tbody")
    mobileBody.className = "table-list-mobile-body"

    for (var idx = 0; idx < items.length; idx++) {
      var row = document.createElement("tr")
      row.className = "table-list-mobile-row"

      var item = document.createElement("td")
      item.className = "table-list-item"
      item.innerHTML = items[idx] ? items[idx].innerHTML : ""
      row.appendChild(item)

      mobileBody.appendChild(row)
    }

    table.appendChild(mobileBody)
    table.classList.add("table-list-rebuilt")
  }

  function applyStackLabels(table, labels) {
    function ensureStackValueWrapper(cell) {
      if (!cell) return
      var children = cell.children || []
      for (var i = 0; i < children.length; i++) {
        if (children[i] && children[i].classList && children[i].classList.contains("stack-cell-value")) return
      }

      var wrapper = document.createElement("span")
      wrapper.className = "stack-cell-value"
      while (cell.firstChild) wrapper.appendChild(cell.firstChild)
      cell.appendChild(wrapper)
    }

    var rowGroups = []
    if (table.tBodies && table.tBodies.length) {
      for (var i = 0; i < table.tBodies.length; i++) rowGroups.push(table.tBodies[i])
    } else {
      rowGroups.push(table)
    }

    for (var g = 0; g < rowGroups.length; g++) {
      var rows = rowGroups[g].rows || []
      for (var r = 0; r < rows.length; r++) {
        var row = rows[r]
        var columnIndex = 0
        for (var c = 0; c < row.cells.length; c++) {
          var cell = row.cells[c]
          var span = parseInt(cell.getAttribute("colspan") || "1", 10)
          if (!span || span < 1) span = 1
          var parts = labels.slice(columnIndex, columnIndex + span)
          var filtered = []
          for (var p = 0; p < parts.length; p++) {
            if (parts[p]) filtered.push(parts[p])
          }
          var label = filtered.length
            ? filtered.join(" / ")
            : labels[columnIndex] || "Column " + (columnIndex + 1)
          cell.setAttribute("data-stack-label", label)
          ensureStackValueWrapper(cell)
          columnIndex += span
        }
      }
    }
  }

  function initListTableStack() {
    if (!isListSectionPage()) return
    var scope = document.querySelector("main#content, #content") || document
    var tables = scope.querySelectorAll("table")
    if (!tables || !tables.length) return

    forEachNodeList(tables, function (table) {
      if (!table || table.getAttribute("data-stack-ready") === "true") return
      var mode = normalizeLabelText(table.getAttribute("data-stack")).toLowerCase()
      if (mode === "off") return

      var columnCount = getTableColumnCount(table)
      if (isPairLayoutTable(table, columnCount, mode)) {
        table.classList.add("table-pairs-ready")
        rebuildPairRowsForMobile(table, columnCount)
        table.setAttribute("data-stack-ready", "true")
        return
      }

      if (isDatumListTable(table, columnCount, mode)) {
        table.classList.add("table-list-ready")
        rebuildDatumListForMobile(table)
        table.setAttribute("data-stack-ready", "true")
        return
      }

      if (isSimpleTable(columnCount, mode)) {
        table.classList.add("table-simple-ready")
        table.classList.add(columnCount === 1 ? "table-simple-1col" : "table-simple-2col")
        if (columnCount === 2) {
          var simpleLabels = getColumnLabels(table, columnCount)
          var hasSimpleLabels = false
          for (var simpleIdx = 0; simpleIdx < simpleLabels.length; simpleIdx++) {
            if (simpleLabels[simpleIdx]) {
              hasSimpleLabels = true
              break
            }
          }
          if (hasSimpleLabels) applyStackLabels(table, simpleLabels)
        }
        table.setAttribute("data-stack-ready", "true")
        return
      }

      if (columnCount < 3 || columnCount > 6) return

      var labels = getColumnLabels(table, columnCount)
      var hasUsableLabels = false
      for (var idx = 0; idx < labels.length; idx++) {
        if (labels[idx]) {
          hasUsableLabels = true
          break
        }
      }
      if (hasUsableLabels) applyStackLabels(table, labels)
      table.classList.add("table-stack-ready")
      table.setAttribute("data-stack-ready", "true")
    })
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
      if (prevGroup && prevGroup.rootPath) prevPath = prevGroup.rootPath
      if (nextGroup && nextGroup.rootPath) nextPath = nextGroup.rootPath
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
      initListTableStack()
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
