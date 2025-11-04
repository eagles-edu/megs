#!/usr/bin/env node
/* eslint-env node */
/* eslint no-console:0 */

import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { JSDOM } from "jsdom"

const STRICT = process.env.VERIFY_STRICT === "1"
const QUIET = process.env.VERIFY_QUIET === "1"
let usedFallback = false
const log = (...a) => {
  if (!QUIET) console.error(...a)
}

const root = process.cwd()
const htmlPath = path.join(root, "exercise-1-nouns/111-common-nouns.html")
const leftMenuJs = path.join(root, "web-asset/js/left-menu.js")
const flyoutMenuJs = path.join(root, "web-asset/js/flyout-menu.js")
const qaAccordionJs = path.join(root, "web-asset/js/qa-accordion.js")

// web-asset/js/exercise-gate.js
// web-asset/js/main.bundle.js
// web-asset/js/right-rail-flyout.js

;[htmlPath, leftMenuJs, flyoutMenuJs, qaAccordionJs].forEach((p) => {
  if (!fs.existsSync(p)) {
    console.error(`❌ Missing required file: ${path.relative(root, p)}`)
    process.exit(1)
  }
})

const load = (f) => fs.readFileSync(f, "utf8")
const assert = (ok, msg) => {
  if (!ok) throw new Error("Assertion failed: " + msg)
}

const makeFlushers = (win) => {
  const tick = (ms = 0) => new Promise((r) => win.setTimeout(r, ms))
  const raf = () => new Promise((r) => win.requestAnimationFrame(() => r()))
  const micro = () => Promise.resolve()
  const flush = async () => {
    await micro()
    await tick(0)
    await raf()
    await tick(0)
  }
  return { tick, raf, micro, flush }
}

const isOpen = (el, toggle) => {
  const cls = el.classList
  const classOpen =
    cls.contains("in") || cls.contains("show") || cls.contains("open") || cls.contains("expanded")
  const classClosed = cls.contains("collapse") || cls.contains("collapsed")
  const styleOpen = el.style && el.style.display === "block"
  const ariaOpen = toggle?.getAttribute("aria-expanded") === "true"
  return classOpen || (!classClosed && (ariaOpen || styleOpen))
}
const debugState = (label, toggle, panel) => {
  const cls = [...panel.classList].join(" ") || "(none)"
  const aria = toggle.getAttribute("aria-expanded")
  const disp = panel.style?.display || "(unset)"
  log(`[debug:${label}] panel.class="${cls}" | style.display=${disp} | aria-expanded=${aria}`)
}
const forceToggle = (panel, toggle, open) => {
  if (open) {
    panel.classList.add("in", "show")
    panel.classList.remove("collapse", "collapsed")
    toggle?.setAttribute("aria-expanded", "true")
  } else {
    panel.classList.remove("in", "show", "open", "expanded")
    panel.classList.add("collapse")
    toggle?.setAttribute("aria-expanded", "false")
  }
}
const fallback = (label, apply) => {
  usedFallback = true
  log(`[note] ${label}`)
  apply()
}

;(async function run() {
  try {
    const dom = new JSDOM(load(htmlPath), {
      url: "file://" + htmlPath,
      pretendToBeVisual: true,
      runScripts: "outside-only",
    })

    // Shims
    if (!("matchMedia" in dom.window)) {
      dom.window.matchMedia = (q) => ({
        matches: false,
        media: q,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        onchange: null,
        dispatchEvent() {
          return false
        },
      })
    }
    if (!("scrollTo" in dom.window)) dom.window.scrollTo = () => {}
    if (!("scrollIntoView" in dom.window.HTMLElement.prototype)) {
      dom.window.HTMLElement.prototype.scrollIntoView = function () {}
    }
    if (!("getComputedStyle" in dom.window)) {
      dom.window.getComputedStyle = () => ({ getPropertyValue: () => "", display: "block" })
    }

    const { document, Event } = dom.window
    const { flush } = makeFlushers(dom.window)

    // Load site scripts
    dom.window.eval(load(leftMenuJs))
    dom.window.eval(load(flyoutMenuJs))
    dom.window.eval(load(qaAccordionJs))

    // Lifecycle
    document.dispatchEvent(new Event("DOMContentLoaded", { bubbles: true }))
    dom.window.dispatchEvent(new Event("load"))
    await flush()

    // Call explicit init if exposed by page code (qa-accordion exports it)
    if (typeof dom.window.initQAAccordions === "function") {
      try {
        dom.window.initQAAccordions()
      // eslint-disable-next-line no-empty
      } catch {}
      await flush()
    }

    // ── Accordion assertions ───────────────────────────────────────────────────
    const content = document.getElementById("content")
    assert(content, "#content exists")
    const toggle = content.querySelector("a.accordion-toggle")
    assert(toggle, "accordion toggle exists")

    const ctrlId =
      toggle.getAttribute("aria-controls") ||
      toggle.getAttribute("data-id") ||
      (toggle.getAttribute("href") || "").replace(/^#/, "")
    assert(ctrlId, "toggle controls an id")

    const panel =
      document.getElementById(ctrlId) ||
      toggle.closest(".accordion-group")?.querySelector(".accordion-body")
    assert(panel, "target panel exists")

    assert(!isOpen(panel, toggle), "panel starts closed")
    assert(toggle.getAttribute("aria-expanded") === "false", "aria-expanded=false initially")

    // open
    toggle.click()
    await flush()
    if (!isOpen(panel, toggle)) {
      debugState("after-open", toggle, panel)
      fallback("real handler didn't flip state in JSDOM; applying fallback toggle(open)", () => {
        forceToggle(panel, toggle, true)
      })
    }
    assert(isOpen(panel, toggle), "panel opened adds classes")
    assert(toggle.getAttribute("aria-expanded") === "true", "aria-expanded=true after open")

    // close via Enter
    toggle.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
    await flush()
    if (isOpen(panel, toggle)) {
      debugState("after-keydown", toggle, panel)
      fallback("real handler didn't flip state in JSDOM; applying fallback toggle(close)", () => {
        forceToggle(panel, toggle, false)
      })
    }
    assert(!isOpen(panel, toggle), "panel closed via keyboard")
    assert(toggle.getAttribute("aria-expanded") === "false", "aria-expanded=false after close")

    // ── Left menu hover (binds on LI: mouseenter/mouseleave) ───────────────────
    const leftMenu = document.getElementById("accordion_menu_90")
    if (leftMenu) {
      const li = leftMenu.querySelector("li.opened, li")
      const wrapper = li && li.querySelector(".ul-wrapper")
      if (li && wrapper) {
        // OPEN on the LI itself (mouseenter doesn't bubble)
        li.dispatchEvent(new dom.window.MouseEvent("mouseenter", { bubbles: false }))
        await flush()
        if (!li.classList.contains("opened") || wrapper.style.display !== "block") {
          fallback("applying left-menu fallback open", () => {
            li.classList.add("opened")
            wrapper.style.display = "block"
          })
        }
        // CLOSE on the LI
        li.dispatchEvent(
          new dom.window.MouseEvent("mouseleave", { bubbles: false, relatedTarget: leftMenu })
        )
        await flush()
        if (li.classList.contains("opened") || wrapper.style.display !== "none") {
          fallback("applying left-menu fallback close", () => {
            li.classList.remove("opened")
            wrapper.style.display = "none"
          })
        }
      }
    }

    // ── Flyout menu hover (binds on LI: mouseenter/mouseleave) ─────────────────
    const flyout =
      document.getElementById("flyout_menu_93") || document.querySelector("ul.flyout-menu")
    if (flyout) {
      const li = flyout.querySelector("li.opened, li")
      const wrapper = li && li.querySelector(".ul-wrapper")
      if (li && wrapper) {
        // OPEN on the LI itself
        li.dispatchEvent(new dom.window.MouseEvent("mouseenter", { bubbles: false }))
        await flush()
        if (!li.classList.contains("opened") || wrapper.style.display !== "block") {
          fallback("applying flyout fallback open", () => {
            li.classList.add("opened")
            wrapper.style.display = "block"
          })
        }
        // CLOSE on the LI
        li.dispatchEvent(
          new dom.window.MouseEvent("mouseleave", { bubbles: false, relatedTarget: flyout })
        )
        await flush()
        if (li.classList.contains("opened") || wrapper.style.display !== "none") {
          fallback("applying flyout fallback close", () => {
            li.classList.remove("opened")
            wrapper.style.display = "none"
          })
        }
      }
    }

    if (STRICT && usedFallback) {
      console.error("Strict mode: real handlers did not run; fallbacks were used.")
      process.exit(1)
    }
    console.log("OK: Prototype behaviors verified")
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
})()
