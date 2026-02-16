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

const applyStackLabels = (table, labels) => {
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
    if (table.getAttribute("data-stack") === "off") continue

    const columnCount = getTableColumnCount(table)
    if (columnCount < 3) continue

    const labels = getColumnLabels(table, columnCount)
    applyStackLabels(table, labels)
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
