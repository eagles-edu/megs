/**
 * Table Wrap Runtime (Legacy ES5) - Eagles Club
 * Responsive table classification + mobile wrap transformations.
 */
;(function () {
  ;("use strict")

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

  function normalizeLabelText(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .replace(/^\s+|\s+$/g, "")
  }

  var TABLE_WRAP_VARIANT_MAP = {
    pairs: {
      classToken: "table-variant-pairs",
      defaultHeaderMode: "auto",
      defaultHeaderSpan: 2,
      mobileColumns: 2,
    },
    list: {
      classToken: "table-variant-list",
      defaultHeaderMode: "auto",
      defaultHeaderSpan: 1,
      mobileColumns: 1,
    },
    columns: {
      classToken: "table-variant-columns",
      defaultHeaderMode: "auto",
      defaultHeaderSpan: 1,
      mobileColumns: 1,
    },
    simple: {
      classToken: "table-variant-simple",
      defaultHeaderMode: "auto",
      defaultHeaderSpan: 1,
      mobileColumns: 1,
    },
    stack: {
      classToken: "table-variant-stack",
      defaultHeaderMode: "auto",
      defaultHeaderSpan: 1,
      mobileColumns: 1,
    },
  }

  var STACK_BREAKPOINT_CLASS_PATTERN = /^table-stack-break-(\d+)$/
  var stackBreakpointBindings = []
  var stackBreakpointRefreshQueued = false
  var stackBreakpointResizeBound = false

  function isResponsiveListCandidate(table) {
    if (!table) return false
    if (table.querySelector && table.querySelector("input, select, textarea, button")) return false
    return true
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

  function isColumnWrapTable(columnCount, explicitMode) {
    if (columnCount < 3) return false
    return explicitMode === "column" || explicitMode === "columns" || explicitMode === "col"
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

  function rebuildColumnListForMobile(table, labels) {
    if (!table) return
    if (table.querySelector("tbody.table-columns-mobile-body")) {
      table.classList.add("table-columns-rebuilt")
      return
    }

    var sourceBodies = table.tBodies && table.tBodies.length ? Array.prototype.slice.call(table.tBodies) : []
    if (!sourceBodies.length || !labels || !labels.length) return

    var valuesByColumn = []
    for (var index = 0; index < labels.length; index++) valuesByColumn.push([])

    for (var g = 0; g < sourceBodies.length; g++) {
      var body = sourceBodies[g]
      body.classList.add("table-columns-source-body")
      var rows = Array.prototype.slice.call(body.rows || [])
      for (var r = 0; r < rows.length; r++) {
        var row = rows[r]
        if (row.querySelector("th")) continue
        var expanded = expandRowCells(row)
        var limit = Math.min(labels.length, expanded.length)
        for (var c = 0; c < limit; c++) {
          var cell = expanded[c]
          var valueText = normalizeLabelText(cell ? cell.textContent : "")
          if (!valueText) continue
          valuesByColumn[c].push(cell ? cell.innerHTML : "")
        }
      }
    }

    var hasValues = false
    for (var v = 0; v < valuesByColumn.length; v++) {
      if (valuesByColumn[v].length) {
        hasValues = true
        break
      }
    }
    if (!hasValues) return

    var mobileBody = document.createElement("tbody")
    mobileBody.className = "table-columns-mobile-body"

    for (var col = 0; col < labels.length; col++) {
      var values = valuesByColumn[col]
      var label = normalizeLabelText(labels[col]) || "Column " + (col + 1)
      if (!values.length) continue

      var mobileRow = document.createElement("tr")
      mobileRow.className = "table-columns-mobile-row"

      var mobileCell = document.createElement("td")
      mobileCell.className = "table-columns-item"

      var labelNode = document.createElement("span")
      labelNode.className = "table-columns-label"
      labelNode.textContent = label
      mobileCell.appendChild(labelNode)

      var valueList = document.createElement("ul")
      valueList.className = "table-columns-values"
      for (var i = 0; i < values.length; i++) {
        var item = document.createElement("li")
        item.className = "table-columns-value"
        item.innerHTML = values[i]
        valueList.appendChild(item)
      }
      mobileCell.appendChild(valueList)

      mobileRow.appendChild(mobileCell)
      mobileBody.appendChild(mobileRow)
    }

    if (!mobileBody.children.length) return

    table.appendChild(mobileBody)
    table.classList.add("table-columns-rebuilt")
  }

  function getTableWrapDatasetTitle(table, columnCount) {
    if (!table) return ""

    var explicitTitle = normalizeLabelText(table.getAttribute("data-wrap-title") || table.getAttribute("data-stack-title"))
    if (explicitTitle) return explicitTitle

    var captionNode = table.querySelector("caption")
    var captionText = normalizeLabelText(captionNode ? captionNode.textContent : "")
    if (captionText) return captionText

    var headRows = table.tHead && table.tHead.rows ? table.tHead.rows : []
    if (headRows.length === 1) {
      var headCells = headRows[0].cells || []
      if (headCells.length === 1) {
        var span = parseInt(headCells[0].getAttribute("colspan") || "1", 10)
        if (!span || span < 1) span = 1
        var titleText = normalizeLabelText(headCells[0].textContent)
        if (titleText && span >= Math.max(columnCount || 1, 1)) return titleText
      }
    }

    var sibling = table.previousElementSibling
    while (sibling) {
      var tag = String(sibling.tagName || "").toLowerCase()
      if (/^h[1-6]$/.test(tag)) {
        var headingText = normalizeLabelText(sibling.textContent)
        if (headingText) return headingText
      }
      if (tag === "p") {
        var strong = sibling.querySelector("strong, b")
        var strongText = normalizeLabelText(strong ? strong.textContent : "")
        if (strongText) return strongText
      }
      sibling = sibling.previousElementSibling
    }

    return ""
  }

  function isGeneratedColumnLabel(value) {
    return /^column\s+\d+$/i.test(normalizeLabelText(value))
  }

  function resolveWrapHeaderText(config) {
    var table = config && config.table
    var sourceColumnCount = config && config.sourceColumnCount
    var wrapColumnSpan = config && config.wrapColumnSpan
    var preferredLabels = (config && config.preferredLabels) || []
    var allowTitleForWideSingleWrap = Boolean(config && config.allowTitleForWideSingleWrap)

    var safeSpan = parseInt(wrapColumnSpan, 10)
    if (!safeSpan || safeSpan < 1) safeSpan = 1
    var title = getTableWrapDatasetTitle(table, sourceColumnCount)

    if (safeSpan === 2) {
      var left = normalizeLabelText(preferredLabels[0] || "")
      var right = normalizeLabelText(preferredLabels[1] || "")
      var hasUsableLeft = left && !isGeneratedColumnLabel(left)
      var hasUsableRight = right && !isGeneratedColumnLabel(right)
      if (hasUsableLeft && hasUsableRight && left.toLowerCase() !== right.toLowerCase()) return left + " / " + right
      return title
    }

    if (safeSpan === 1) {
      if ((sourceColumnCount || 0) >= 3 && !allowTitleForWideSingleWrap) return ""
      return title
    }

    return ""
  }

  function resolveHeaderMode(value) {
    return normalizeLabelText(value) ? "text" : "cosmetic"
  }

  function applyVariantProfile(table, variantKey, profile) {
    if (!table || !variantKey) return
    profile = profile || {}
    var variant = TABLE_WRAP_VARIANT_MAP[variantKey]
    if (!variant) return

    var sourceColumns = parseInt(profile.sourceColumns, 10)
    if (!sourceColumns || sourceColumns < 0) sourceColumns = 0

    var mobileColumns = parseInt(profile.mobileColumns, 10)
    if (!mobileColumns || mobileColumns < 1) mobileColumns = variant.mobileColumns || 1

    var headerSpan = parseInt(profile.headerSpan, 10)
    if (!headerSpan || headerSpan < 1) headerSpan = variant.defaultHeaderSpan || 1

    var headerMode = normalizeLabelText(profile.headerMode || variant.defaultHeaderMode || "cosmetic").toLowerCase()

    table.classList.add(variant.classToken)
    table.setAttribute("data-wrap-variant", variantKey)
    table.setAttribute("data-wrap-source-cols", String(sourceColumns))
    table.setAttribute("data-wrap-mobile-cols", String(mobileColumns))
    table.setAttribute("data-wrap-header-span", String(headerSpan))
    table.setAttribute("data-wrap-header-mode", headerMode)
    table.setAttribute("data-wrap-classifier", "tablewrap-v2")
  }

  function ensureMobileCosmeticHeader(table, options) {
    if (!table) return
    options = options || {}
    var safeSpan = parseInt(options.columnSpan, 10)
    if (!safeSpan || safeSpan < 1) safeSpan = 1
    var headerText = normalizeLabelText(options.text || "")

    var head = table.querySelector("thead.table-wrap-cosmetic-head")
    if (!head) {
      head = document.createElement("thead")
      head.className = "table-wrap-cosmetic-head"

      var createRow = document.createElement("tr")
      var createCell = document.createElement("th")
      createRow.appendChild(createCell)
      head.appendChild(createRow)

      var firstChild = table.firstElementChild
      if (firstChild) table.insertBefore(head, firstChild)
      else table.appendChild(head)
    }

    var row = head.querySelector("tr")
    if (!row) {
      row = document.createElement("tr")
      head.appendChild(row)
    }

    var cell = row.querySelector("th")
    if (!cell) {
      cell = document.createElement("th")
      row.appendChild(cell)
    }

    cell.setAttribute("scope", "colgroup")
    cell.setAttribute("colspan", String(safeSpan))
    cell.setAttribute("aria-hidden", "true")
    if (headerText) {
      cell.textContent = headerText
      table.classList.add("table-wrap-cosmetic-has-text")
      table.setAttribute("data-wrap-cosmetic-mode", "text")
    } else {
      cell.innerHTML = "&nbsp;"
      table.classList.remove("table-wrap-cosmetic-has-text")
      table.setAttribute("data-wrap-cosmetic-mode", "cosmetic")
    }

    table.classList.add("table-wrap-cosmetic-header")
    table.setAttribute("data-wrap-cosmetic-cols", String(safeSpan))
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

  function resolveExplicitStackBreakpoint(table) {
    if (!table || !table.classList) return 0

    var resolved = 0
    var dataBreakpoint = parseInt(table.getAttribute("data-stack-break") || "", 10)
    if (dataBreakpoint && dataBreakpoint > 0) resolved = dataBreakpoint

    for (var i = 0; i < table.classList.length; i++) {
      var className = String(table.classList[i] || "")
      var match = className.match(STACK_BREAKPOINT_CLASS_PATTERN)
      if (!match) continue
      var parsed = parseInt(match[1], 10)
      if (parsed && parsed > resolved) resolved = parsed
    }

    return resolved
  }

  function registerStackBreakpointTable(table) {
    if (!table || table.getAttribute("data-stack-breakpoint-registered") === "true") return

    var breakpoint = resolveExplicitStackBreakpoint(table)
    if (!breakpoint) return

    table.setAttribute("data-stack-breakpoint", String(breakpoint))
    table.setAttribute("data-stack-breakpoint-registered", "true")
    stackBreakpointBindings.push({ table: table, breakpoint: breakpoint })
  }

  function applyStackBreakpointState(binding) {
    if (!binding || !binding.table || !binding.breakpoint) return
    var shouldActivate = window.innerWidth <= binding.breakpoint
    if (shouldActivate) binding.table.classList.add("table-stack-break-active")
    else binding.table.classList.remove("table-stack-break-active")
  }

  function refreshStackBreakpointStates() {
    if (!stackBreakpointBindings.length) return

    var activeBindings = []
    for (var i = 0; i < stackBreakpointBindings.length; i++) {
      var binding = stackBreakpointBindings[i]
      if (!binding || !binding.table || binding.table.isConnected === false) continue
      applyStackBreakpointState(binding)
      activeBindings.push(binding)
    }
    stackBreakpointBindings = activeBindings
  }

  function scheduleStackBreakpointRefresh() {
    if (stackBreakpointRefreshQueued) return
    stackBreakpointRefreshQueued = true

    var raf =
      typeof window.requestAnimationFrame === "function"
        ? window.requestAnimationFrame
        : function (cb) {
            return window.setTimeout(cb, 16)
          }

    raf(function () {
      stackBreakpointRefreshQueued = false
      refreshStackBreakpointStates()
    })
  }

  function initStackBreakpointObservers() {
    if (!stackBreakpointBindings.length) return

    refreshStackBreakpointStates()
    if (stackBreakpointResizeBound) return

    stackBreakpointResizeBound = true
    window.addEventListener("resize", scheduleStackBreakpointRefresh)
    window.addEventListener("orientationchange", scheduleStackBreakpointRefresh)
  }

  function initListTableStack() {
    var scope = document.querySelector("main#content, #content") || document
    var tableNodes = scope.querySelectorAll("table")
    if (!tableNodes || !tableNodes.length) return

    var tables = []
    forEachNodeList(tableNodes, function (table) {
      if (!isResponsiveListCandidate(table)) return
      tables.push(table)
    })
    if (!tables.length) return

    if (document.body && document.body.classList && !document.body.classList.contains("list")) {
      document.body.classList.add("responsive-lists")
    }

    forEachNodeList(tables, function (table) {
      registerStackBreakpointTable(table)
      if (!table || table.getAttribute("data-stack-ready") === "true") return
      var mode = normalizeLabelText(table.getAttribute("data-stack")).toLowerCase()
      if (mode === "off") return

      var columnCount = getTableColumnCount(table)
      if (isPairLayoutTable(table, columnCount, mode)) {
        table.classList.add("table-pairs-ready")
        rebuildPairRowsForMobile(table, columnCount)
        var pairLabels = getColumnLabels(table, columnCount)
        var pairHeaderText = resolveWrapHeaderText({
          table: table,
          sourceColumnCount: columnCount,
          wrapColumnSpan: 2,
          preferredLabels: [pairLabels[0], pairLabels[1]],
        })
        ensureMobileCosmeticHeader(table, { columnSpan: 2, text: pairHeaderText })
        applyVariantProfile(table, "pairs", {
          sourceColumns: columnCount,
          mobileColumns: 2,
          headerSpan: 2,
          headerMode: resolveHeaderMode(pairHeaderText),
        })
        table.setAttribute("data-stack-ready", "true")
        return
      }

      if (isDatumListTable(table, columnCount, mode)) {
        table.classList.add("table-list-ready")
        rebuildDatumListForMobile(table)
        var listHeaderText = resolveWrapHeaderText({
          table: table,
          sourceColumnCount: columnCount,
          wrapColumnSpan: 1,
          allowTitleForWideSingleWrap: true,
        })
        ensureMobileCosmeticHeader(table, { columnSpan: 1, text: listHeaderText })
        applyVariantProfile(table, "list", {
          sourceColumns: columnCount,
          mobileColumns: 1,
          headerSpan: 1,
          headerMode: resolveHeaderMode(listHeaderText),
        })
        table.setAttribute("data-stack-ready", "true")
        return
      }

      if (isColumnWrapTable(columnCount, mode)) {
        var columnLabels = getColumnLabels(table, columnCount)
        rebuildColumnListForMobile(table, columnLabels)
        table.classList.add("table-columns-ready")
        var columnHeaderText = resolveWrapHeaderText({
          table: table,
          sourceColumnCount: columnCount,
          wrapColumnSpan: 1,
        })
        ensureMobileCosmeticHeader(table, { columnSpan: 1, text: columnHeaderText })
        applyVariantProfile(table, "columns", {
          sourceColumns: columnCount,
          mobileColumns: 1,
          headerSpan: 1,
          headerMode: resolveHeaderMode(columnHeaderText),
        })
        table.setAttribute("data-stack-ready", "true")
        return
      }

      if (isSimpleTable(columnCount, mode)) {
        table.classList.add("table-simple-ready")
        table.classList.add(columnCount === 1 ? "table-simple-1col" : "table-simple-2col")
        var simpleLabels = []
        if (columnCount === 2) {
          simpleLabels = getColumnLabels(table, columnCount)
          var hasSimpleLabels = false
          for (var simpleIdx = 0; simpleIdx < simpleLabels.length; simpleIdx++) {
            if (simpleLabels[simpleIdx]) {
              hasSimpleLabels = true
              break
            }
          }
          if (hasSimpleLabels) applyStackLabels(table, simpleLabels)
        }
        var simpleHeaderText = resolveWrapHeaderText({
          table: table,
          sourceColumnCount: columnCount,
          wrapColumnSpan: columnCount,
          preferredLabels: simpleLabels,
        })
        ensureMobileCosmeticHeader(table, { columnSpan: columnCount, text: simpleHeaderText })
        applyVariantProfile(table, "simple", {
          sourceColumns: columnCount,
          mobileColumns: columnCount === 2 ? 2 : 1,
          headerSpan: columnCount,
          headerMode: resolveHeaderMode(simpleHeaderText),
        })
        table.setAttribute("data-stack-ready", "true")
        return
      }

      if (columnCount < 3) return

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
      var stackHeaderText = resolveWrapHeaderText({
        table: table,
        sourceColumnCount: columnCount,
        wrapColumnSpan: 1,
      })
      ensureMobileCosmeticHeader(table, { columnSpan: 1, text: stackHeaderText })
      applyVariantProfile(table, "stack", {
        sourceColumns: columnCount,
        mobileColumns: 1,
        headerSpan: 1,
        headerMode: resolveHeaderMode(stackHeaderText),
      })
      table.setAttribute("data-stack-ready", "true")
    })

    initStackBreakpointObservers()
  }
  function runTableWrap() {
    if (window.__tableWrapInitialized) return
    window.__tableWrapInitialized = true
    initListTableStack()
  }

  ready(runTableWrap)
})()
