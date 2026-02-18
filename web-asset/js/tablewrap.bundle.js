/**
 * Table Wrap Runtime (Modern Module) - Eagles Club
 * Responsive table classification + mobile wrap transformations.
 */

const normalizeLabelText = (value) =>
  String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()

const TABLE_WRAP_VARIANT_MAP = Object.freeze({
  pairs: Object.freeze({
    classToken: "table-variant-pairs",
    defaultHeaderMode: "auto",
    defaultHeaderSpan: 2,
    mobileColumns: 2,
  }),
  list: Object.freeze({
    classToken: "table-variant-list",
    defaultHeaderMode: "auto",
    defaultHeaderSpan: 1,
    mobileColumns: 1,
  }),
  columns: Object.freeze({
    classToken: "table-variant-columns",
    defaultHeaderMode: "auto",
    defaultHeaderSpan: 1,
    mobileColumns: 1,
  }),
  simple: Object.freeze({
    classToken: "table-variant-simple",
    defaultHeaderMode: "auto",
    defaultHeaderSpan: 1,
    mobileColumns: 1,
  }),
  stack: Object.freeze({
    classToken: "table-variant-stack",
    defaultHeaderMode: "auto",
    defaultHeaderSpan: 1,
    mobileColumns: 1,
  }),
})

const isResponsiveListCandidate = (table) => {
  if (!table) return false
  if (table.querySelector("input, select, textarea, button")) return false
  return true
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

const isColumnWrapTable = (columnCount, explicitMode) => {
  if (columnCount < 3) return false
  return explicitMode === "column" || explicitMode === "columns" || explicitMode === "col"
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

const rebuildColumnListForMobile = (table, labels) => {
  if (!table) return
  if (table.querySelector("tbody.table-columns-mobile-body")) {
    table.classList.add("table-columns-rebuilt")
    return
  }

  const sourceBodies = table.tBodies && table.tBodies.length ? Array.from(table.tBodies) : []
  if (!sourceBodies.length || !labels || !labels.length) return

  const valuesByColumn = Array.from({ length: labels.length }, () => [])
  for (let g = 0; g < sourceBodies.length; g++) {
    const body = sourceBodies[g]
    body.classList.add("table-columns-source-body")
    const rows = Array.from(body.rows || [])
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r]
      if (row.querySelector("th")) continue
      const expanded = expandRowCells(row)
      const limit = Math.min(labels.length, expanded.length)
      for (let c = 0; c < limit; c++) {
        const cell = expanded[c]
        const valueText = normalizeLabelText(cell ? cell.textContent : "")
        if (!valueText) continue
        valuesByColumn[c].push(cell ? cell.innerHTML : "")
      }
    }
  }

  if (!valuesByColumn.some((values) => values.length)) return

  const mobileBody = document.createElement("tbody")
  mobileBody.className = "table-columns-mobile-body"
  for (let c = 0; c < labels.length; c++) {
    const values = valuesByColumn[c]
    const label = normalizeLabelText(labels[c]) || `Column ${c + 1}`
    if (!values.length) continue

    const row = document.createElement("tr")
    row.className = "table-columns-mobile-row"

    const cell = document.createElement("td")
    cell.className = "table-columns-item"

    const labelNode = document.createElement("span")
    labelNode.className = "table-columns-label"
    labelNode.textContent = label
    cell.appendChild(labelNode)

    const list = document.createElement("ul")
    list.className = "table-columns-values"
    for (let i = 0; i < values.length; i++) {
      const item = document.createElement("li")
      item.className = "table-columns-value"
      item.innerHTML = values[i]
      list.appendChild(item)
    }
    cell.appendChild(list)

    row.appendChild(cell)
    mobileBody.appendChild(row)
  }

  if (!mobileBody.children.length) return

  table.appendChild(mobileBody)
  table.classList.add("table-columns-rebuilt")
}

const getTableWrapDatasetTitle = (table, columnCount) => {
  if (!table) return ""

  const explicitTitle = normalizeLabelText(table.getAttribute("data-wrap-title") || table.getAttribute("data-stack-title"))
  if (explicitTitle) return explicitTitle

  const captionText = normalizeLabelText(table.querySelector("caption") ? table.querySelector("caption").textContent : "")
  if (captionText) return captionText

  const headRows = table.tHead ? Array.from(table.tHead.rows || []) : []
  if (headRows.length === 1) {
    const cells = Array.from(headRows[0].cells || [])
    if (cells.length === 1) {
      const span = Math.max(parseInt(cells[0].getAttribute("colspan") || "1", 10) || 1, 1)
      const titleText = normalizeLabelText(cells[0].textContent)
      if (titleText && span >= Math.max(columnCount || 1, 1)) return titleText
    }
  }

  let sibling = table.previousElementSibling
  while (sibling) {
    const tag = String(sibling.tagName || "").toLowerCase()
    if (/^h[1-6]$/.test(tag)) {
      const headingText = normalizeLabelText(sibling.textContent)
      if (headingText) return headingText
    }
    if (tag === "p") {
      const strong = sibling.querySelector("strong, b")
      const strongText = normalizeLabelText(strong ? strong.textContent : "")
      if (strongText) return strongText
    }
    sibling = sibling.previousElementSibling
  }

  return ""
}

const isGeneratedColumnLabel = (value) => /^column\s+\d+$/i.test(normalizeLabelText(value))

const resolveWrapHeaderText = ({
  table,
  sourceColumnCount,
  wrapColumnSpan,
  preferredLabels = [],
  allowTitleForWideSingleWrap = false,
}) => {
  const safeSpan = Math.max(parseInt(wrapColumnSpan, 10) || 1, 1)
  const title = getTableWrapDatasetTitle(table, sourceColumnCount)

  if (safeSpan === 2) {
    const left = normalizeLabelText(preferredLabels[0] || "")
    const right = normalizeLabelText(preferredLabels[1] || "")
    const hasUsableLeft = left && !isGeneratedColumnLabel(left)
    const hasUsableRight = right && !isGeneratedColumnLabel(right)
    if (hasUsableLeft && hasUsableRight && left.toLowerCase() !== right.toLowerCase()) return `${left} / ${right}`
    return title
  }

  if (safeSpan === 1) {
    if ((sourceColumnCount || 0) >= 3 && !allowTitleForWideSingleWrap) return ""
    return title
  }

  return ""
}

const resolveHeaderMode = (value) =>
  normalizeLabelText(value) ? "text" : "cosmetic"

const applyVariantProfile = (table, variantKey, profile = {}) => {
  if (!table || !variantKey) return
  const variant = TABLE_WRAP_VARIANT_MAP[variantKey]
  if (!variant) return

  const sourceColumns = Math.max(parseInt(profile.sourceColumns, 10) || 0, 0)
  const mobileColumns = Math.max(
    parseInt(profile.mobileColumns, 10) || variant.mobileColumns || 1,
    1
  )
  const headerSpan = Math.max(
    parseInt(profile.headerSpan, 10) || variant.defaultHeaderSpan || 1,
    1
  )
  const headerMode = normalizeLabelText(
    profile.headerMode || variant.defaultHeaderMode || "cosmetic"
  ).toLowerCase()

  table.classList.add(variant.classToken)
  table.setAttribute("data-wrap-variant", variantKey)
  table.setAttribute("data-wrap-source-cols", String(sourceColumns))
  table.setAttribute("data-wrap-mobile-cols", String(mobileColumns))
  table.setAttribute("data-wrap-header-span", String(headerSpan))
  table.setAttribute("data-wrap-header-mode", headerMode)
  table.setAttribute("data-wrap-classifier", "tablewrap-v2")
}

const ensureMobileCosmeticHeader = (table, options = {}) => {
  if (!table) return
  const safeSpan = Math.max(parseInt(options.columnSpan, 10) || 1, 1)
  const headerText = normalizeLabelText(options.text || "")

  let head = table.querySelector("thead.table-wrap-cosmetic-head")
  if (!head) {
    head = document.createElement("thead")
    head.className = "table-wrap-cosmetic-head"

    const row = document.createElement("tr")
    const cell = document.createElement("th")
    row.appendChild(cell)
    head.appendChild(row)

    const firstChild = table.firstElementChild
    if (firstChild) table.insertBefore(head, firstChild)
    else table.appendChild(head)
  }

  const row = head.querySelector("tr") || document.createElement("tr")
  if (!row.parentNode) head.appendChild(row)

  const cell = row.querySelector("th") || document.createElement("th")
  if (!cell.parentNode) row.appendChild(cell)

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
  const scope = document.querySelector("main#content, #content") || document
  const tableNodes = scope.querySelectorAll("table")
  if (!tableNodes.length) return

  const tables = []
  for (let i = 0; i < tableNodes.length; i++) {
    if (!isResponsiveListCandidate(tableNodes[i])) continue
    tables.push(tableNodes[i])
  }
  if (!tables.length) return

  if (document.body && document.body.classList && !document.body.classList.contains("list")) {
    document.body.classList.add("responsive-lists")
  }

  for (let i = 0; i < tables.length; i++) {
    const table = tables[i]
    if (!table || table.dataset.stackReady === "true") continue
    const mode = normalizeLabelText(table.getAttribute("data-stack")).toLowerCase()
    if (mode === "off") continue

    const columnCount = getTableColumnCount(table)
    if (isPairLayoutTable(table, columnCount, mode)) {
      table.classList.add("table-pairs-ready")
      rebuildPairRowsForMobile(table, columnCount)
      const pairLabels = getColumnLabels(table, columnCount)
      const pairHeaderText = resolveWrapHeaderText({
        table,
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
      table.dataset.stackReady = "true"
      continue
    }

    if (isDatumListTable(table, columnCount, mode)) {
      table.classList.add("table-list-ready")
      rebuildDatumListForMobile(table)
      const listHeaderText = resolveWrapHeaderText({
        table,
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
      table.dataset.stackReady = "true"
      continue
    }

    if (isColumnWrapTable(columnCount, mode)) {
      const columnLabels = getColumnLabels(table, columnCount)
      rebuildColumnListForMobile(table, columnLabels)
      table.classList.add("table-columns-ready")
      const columnHeaderText = resolveWrapHeaderText({
        table,
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
      table.dataset.stackReady = "true"
      continue
    }

    if (isSimpleTable(columnCount, mode)) {
      table.classList.add("table-simple-ready")
      table.classList.add(columnCount === 1 ? "table-simple-1col" : "table-simple-2col")
      let simpleLabels = []
      if (columnCount === 2) {
        simpleLabels = getColumnLabels(table, columnCount)
        if (simpleLabels.some(Boolean)) applyStackLabels(table, simpleLabels)
      }
      const simpleHeaderText = resolveWrapHeaderText({
        table,
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
      table.dataset.stackReady = "true"
      continue
    }

    if (columnCount < 3) continue

    const labels = getColumnLabels(table, columnCount)
    if (labels.some(Boolean)) applyStackLabels(table, labels)
    table.classList.add("table-stack-ready")
    const stackHeaderText = resolveWrapHeaderText({
      table,
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
    table.dataset.stackReady = "true"
  }
}
const runTableWrap = () => {
  if (window.__tableWrapInitialized) return
  window.__tableWrapInitialized = true
  initListTableStack()
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", runTableWrap, { once: true })
} else {
  runTableWrap()
}
