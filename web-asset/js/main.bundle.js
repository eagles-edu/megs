/**
 * Main Bundle Loader (Modern Module) - Eagles Club
 * Schedules nav/accordion bundle after load/idle or first interaction.
 */

const resolveNavBundleSrc = () => {
  const scripts = document.getElementsByTagName("script")
  for (let i = scripts.length - 1; i >= 0; i--) {
    const srcAttr = scripts[i].getAttribute("src") || ""
    if (!srcAttr) continue
    if (srcAttr.indexOf("main.bundle.js") === -1) continue
    const absolute = scripts[i].src || srcAttr
    return absolute.replace(/main\.bundle\.js(?:\?.*)?$/, "main.nav.bundle.js")
  }
  return ""
}

const loadNavBundle = () => {
  if (window.__navBundleLoading || window.__navBundleLoaded) return
  const src = resolveNavBundleSrc()
  if (!src) return
  window.__navBundleLoading = true
  const script = document.createElement("script")
  script.type = "module"
  script.src = src
  script.async = true
  if ("fetchPriority" in script) script.fetchPriority = "low"
  script.onload = () => {
    window.__navBundleLoaded = true
    window.__navBundleLoading = false
  }
  script.onerror = () => {
    window.__navBundleLoading = false
  }
  document.head.appendChild(script)
}

const runWhenIdle = (fn, timeoutMs) => {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(fn, { timeout: timeoutMs })
    return
  }
  window.setTimeout(fn, 450)
}

const normalizeLabelText = (value) =>
  String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()

const isListSectionPage = () => {
  const body = document.body
  if (body && body.classList && body.classList.contains("list")) return true
  const path = String((window.location && window.location.pathname) || "").toLowerCase()
  return /(?:^|\/)(list-\d+|list-\d+-|lists2\/|lists\.html$)/.test(path)
}

const expandRowCells = (row) => {
  if (!row || !row.cells) return []
  const expanded = []
  for (let i = 0; i < row.cells.length; i++) {
    const cell = row.cells[i]
    const span = Math.max(parseInt(cell.getAttribute("colspan") || "1", 10) || 1, 1)
    for (let step = 0; step < span; step++) expanded.push(cell)
  }
  return expanded
}

const getTableColumnCount = (table) => {
  if (!table || !table.rows) return 0
  let maxColumns = 0
  for (let i = 0; i < table.rows.length; i++) {
    const row = table.rows[i]
    let columns = 0
    for (let j = 0; j < row.cells.length; j++) {
      const span = Math.max(parseInt(row.cells[j].getAttribute("colspan") || "1", 10) || 1, 1)
      columns += span
    }
    if (columns > maxColumns) maxColumns = columns
  }
  return maxColumns
}

const getColumnLabels = (table, columnCount) => {
  const headRows = table && table.tHead ? Array.from(table.tHead.rows || []) : []
  for (let i = headRows.length - 1; i >= 0; i--) {
    const rowCells = Array.from(headRows[i].cells || [])
    if (rowCells.length === 1) {
      const span = Math.max(parseInt(rowCells[0].getAttribute("colspan") || "1", 10) || 1, 1)
      if (span >= columnCount) {
        if (headRows.length === 1) {
          return Array.from({ length: columnCount }, (_, idx) => `Column ${idx + 1}`)
        }
        continue
      }
    }

    const expanded = expandRowCells(headRows[i])
    if (!expanded.length) continue
    const labels = []
    for (let col = 0; col < columnCount; col++) {
      const raw = expanded[col] ? normalizeLabelText(expanded[col].textContent) : ""
      labels.push(raw || `Column ${col + 1}`)
    }
    return labels
  }
  const fallback = []
  for (let col = 0; col < columnCount; col++) fallback.push(`Column ${col + 1}`)
  return fallback
}

const hasRepeatedPairHeaders = (table) => {
  if (!table || !table.tHead || !table.tHead.rows || !table.tHead.rows.length) return false
  for (let i = table.tHead.rows.length - 1; i >= 0; i--) {
    const expanded = expandRowCells(table.tHead.rows[i])
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
    const leftA = normalizeLabelText(expanded[0] ? expanded[0].textContent : "").toLowerCase()
    const leftB = normalizeLabelText(expanded[1] ? expanded[1].textContent : "").toLowerCase()
    const rightA = normalizeLabelText(expanded[2] ? expanded[2].textContent : "").toLowerCase()
    const rightB = normalizeLabelText(expanded[3] ? expanded[3].textContent : "").toLowerCase()
    return Boolean(leftA && leftB && leftA === rightA && leftB === rightB)
  }
  return false
}

const isPairLayoutTable = (table, columnCount, explicitMode) => {
  if (explicitMode === "pairs") return true
  if (columnCount !== 4 && columnCount !== 5) return false
  if (columnCount === 4 && !hasRepeatedPairHeaders(table)) return false

  const rowGroups = table.tBodies && table.tBodies.length ? Array.from(table.tBodies) : [table]
  let sampleRows = 0
  let spacerRows = 0

  for (let g = 0; g < rowGroups.length; g++) {
    const rows = rowGroups[g].rows || []
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r]
      if (row.querySelector("th")) continue
      const expanded = expandRowCells(row)
      if (expanded.length < columnCount) continue
      sampleRows += 1
      if (columnCount === 5) {
        const spacer = normalizeLabelText(expanded[2] ? expanded[2].textContent : "")
        if (!spacer) spacerRows += 1
      } else {
        spacerRows += 1
      }
    }
  }

  return sampleRows > 0 && spacerRows === sampleRows
}

const hasTitleOnlyHeader = (table, columnCount) => {
  const headRows = table && table.tHead ? Array.from(table.tHead.rows || []) : []
  if (headRows.length !== 1) return false
  const cells = Array.from(headRows[0].cells || [])
  if (cells.length !== 1) return false
  const span = Math.max(parseInt(cells[0].getAttribute("colspan") || "1", 10) || 1, 1)
  return span >= columnCount
}

const isDatumListTable = (table, columnCount, explicitMode) => {
  if (explicitMode === "list") return true
  if (columnCount < 2 || columnCount > 6) return false
  if (!hasTitleOnlyHeader(table, columnCount)) return false

  const rowGroups = table.tBodies && table.tBodies.length ? Array.from(table.tBodies) : []
  let filledCells = 0
  for (let g = 0; g < rowGroups.length; g++) {
    const rows = rowGroups[g].rows || []
    for (let r = 0; r < rows.length; r++) {
      const cells = rows[r].cells || []
      for (let c = 0; c < cells.length; c++) {
        if (normalizeLabelText(cells[c].textContent)) filledCells += 1
      }
    }
  }
  return filledCells > 0
}

const isSimpleTable = (columnCount, explicitMode) => {
  if (explicitMode === "simple") return true
  return columnCount >= 1 && columnCount <= 2
}

const createPairRow = (keyCell, valueCell) => {
  const keyText = normalizeLabelText(keyCell ? keyCell.textContent : "")
  const valueText = normalizeLabelText(valueCell ? valueCell.textContent : "")
  if (!keyText && !valueText) return null

  const row = document.createElement("tr")
  row.className = "table-pairs-mobile-row"

  const key = document.createElement("td")
  key.className = "table-pairs-key"
  key.innerHTML = keyCell ? keyCell.innerHTML : ""

  const value = document.createElement("td")
  value.className = "table-pairs-value"
  value.innerHTML = valueCell ? valueCell.innerHTML : ""

  row.appendChild(key)
  row.appendChild(value)
  return row
}

const rebuildPairRowsForMobile = (table, columnCount) => {
  if (!table || columnCount < 4) return
  if (table.querySelector("tbody.table-pairs-mobile-body")) {
    table.classList.add("table-pairs-rebuilt")
    return
  }

  const sourceBodies = table.tBodies && table.tBodies.length ? Array.from(table.tBodies) : []
  if (!sourceBodies.length) return

  const leftRows = []
  const rightRows = []

  for (let g = 0; g < sourceBodies.length; g++) {
    const body = sourceBodies[g]
    const rows = Array.from(body.rows || [])
    body.classList.add("table-pairs-source-body")

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r]
      if (row.querySelector("th")) continue
      const expanded = expandRowCells(row)
      if (expanded.length < columnCount) continue

      const leftRow = createPairRow(expanded[0], expanded[1])
      if (leftRow) leftRows.push(leftRow)

      const rightStart = columnCount - 2
      const rightRow = createPairRow(expanded[rightStart], expanded[rightStart + 1])
      if (rightRow) rightRows.push(rightRow)
    }
  }

  if (!leftRows.length && !rightRows.length) return

  const mobileBody = document.createElement("tbody")
  mobileBody.className = "table-pairs-mobile-body"
  for (let i = 0; i < leftRows.length; i++) mobileBody.appendChild(leftRows[i])
  for (let i = 0; i < rightRows.length; i++) mobileBody.appendChild(rightRows[i])

  table.appendChild(mobileBody)
  table.classList.add("table-pairs-rebuilt")
}

const rebuildDatumListForMobile = (table) => {
  if (!table) return
  if (table.querySelector("tbody.table-list-mobile-body")) {
    table.classList.add("table-list-rebuilt")
    return
  }

  const sourceBodies = table.tBodies && table.tBodies.length ? Array.from(table.tBodies) : []
  if (!sourceBodies.length) return

  const items = []
  for (let g = 0; g < sourceBodies.length; g++) {
    const body = sourceBodies[g]
    body.classList.add("table-list-source-body")
    const rows = Array.from(body.rows || [])
    for (let r = 0; r < rows.length; r++) {
      const cells = Array.from(rows[r].cells || [])
      for (let c = 0; c < cells.length; c++) {
        if (!normalizeLabelText(cells[c].textContent)) continue
        items.push(cells[c])
      }
    }
  }

  if (!items.length) return

  const mobileBody = document.createElement("tbody")
  mobileBody.className = "table-list-mobile-body"

  for (let i = 0; i < items.length; i++) {
    const row = document.createElement("tr")
    row.className = "table-list-mobile-row"

    const item = document.createElement("td")
    item.className = "table-list-item"
    item.innerHTML = items[i] ? items[i].innerHTML : ""
    row.appendChild(item)

    mobileBody.appendChild(row)
  }

  table.appendChild(mobileBody)
  table.classList.add("table-list-rebuilt")
}

const applyStackLabels = (table, labels) => {
  const ensureStackValueWrapper = (cell) => {
    if (!cell) return
    for (let i = 0; i < cell.children.length; i++) {
      const child = cell.children[i]
      if (child && child.classList && child.classList.contains("stack-cell-value")) return
    }

    const wrapper = document.createElement("span")
    wrapper.className = "stack-cell-value"
    while (cell.firstChild) wrapper.appendChild(cell.firstChild)
    cell.appendChild(wrapper)
  }

  const rowGroups =
    table.tBodies && table.tBodies.length
      ? Array.from(table.tBodies)
      : [table]

  for (let i = 0; i < rowGroups.length; i++) {
    const rows = rowGroups[i].rows || []
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r]
      let columnIndex = 0
      for (let c = 0; c < row.cells.length; c++) {
        const cell = row.cells[c]
        const span = Math.max(parseInt(cell.getAttribute("colspan") || "1", 10) || 1, 1)
        const labelParts = labels.slice(columnIndex, columnIndex + span).filter(Boolean)
        const label = labelParts.length
          ? labelParts.join(" / ")
          : labels[columnIndex] || `Column ${columnIndex + 1}`
        cell.setAttribute("data-stack-label", label)
        ensureStackValueWrapper(cell)
        columnIndex += span
      }
    }
  }
}

const initListTableStack = () => {
  if (!isListSectionPage()) return
  const scope = document.querySelector("main#content, #content") || document
  const tables = scope.querySelectorAll("table")
  if (!tables.length) return

  for (let i = 0; i < tables.length; i++) {
    const table = tables[i]
    if (!table || table.dataset.stackReady === "true") continue
    const mode = normalizeLabelText(table.getAttribute("data-stack")).toLowerCase()
    if (mode === "off") continue

    const columnCount = getTableColumnCount(table)
    if (isPairLayoutTable(table, columnCount, mode)) {
      table.classList.add("table-pairs-ready")
      rebuildPairRowsForMobile(table, columnCount)
      table.dataset.stackReady = "true"
      continue
    }

    if (isDatumListTable(table, columnCount, mode)) {
      table.classList.add("table-list-ready")
      rebuildDatumListForMobile(table)
      table.dataset.stackReady = "true"
      continue
    }

    if (isSimpleTable(columnCount, mode)) {
      table.classList.add("table-simple-ready")
      table.classList.add(columnCount === 1 ? "table-simple-1col" : "table-simple-2col")
      if (columnCount === 2) {
        const simpleLabels = getColumnLabels(table, columnCount)
        if (simpleLabels.some(Boolean)) applyStackLabels(table, simpleLabels)
      }
      table.dataset.stackReady = "true"
      continue
    }

    if (columnCount < 3 || columnCount > 6) continue

    const labels = getColumnLabels(table, columnCount)
    if (labels.some(Boolean)) applyStackLabels(table, labels)
    table.classList.add("table-stack-ready")
    table.dataset.stackReady = "true"
  }
}

const scheduleNavBundle = () => {
  if (window.__navBundleScheduled) return
  window.__navBundleScheduled = true

  const interactionEvents = ["pointerdown", "keydown", "touchstart"]
  const interactionOptions = { once: true, passive: true }
  let triggered = false

  const onInteraction = () => {
    if (triggered) return
    triggered = true
    for (let i = 0; i < interactionEvents.length; i++) {
      window.removeEventListener(interactionEvents[i], onInteraction, interactionOptions)
    }
    loadNavBundle()
  }

  for (let i = 0; i < interactionEvents.length; i++) {
    window.addEventListener(interactionEvents[i], onInteraction, interactionOptions)
  }

  const scheduleAfterLoad = () => {
    window.setTimeout(() => {
      if (triggered) return
      triggered = true
      runWhenIdle(loadNavBundle, 2000)
    }, 900)
  }

  if (document.readyState === "complete") {
    scheduleAfterLoad()
    return
  }
  window.addEventListener("load", scheduleAfterLoad, { once: true })
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initListTableStack, { once: true })
} else {
  initListTableStack()
}

scheduleNavBundle()
