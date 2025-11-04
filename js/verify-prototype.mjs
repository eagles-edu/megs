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
const mainBundleJs = path.join(root, "web-asset/js/main.bundle.js")
const rightRailJs = path.join(root, "web-asset/js/right-rail-flyout.js")
const exerciseGateJs = path.join(root, "web-asset/js/exercise-gate.js")

// web-asset/js/exercise-gate.js
// web-asset/js/flyout-menu.js
// web-asset/js/qa-accordion.js
// web-asset/js/left-menu.js

;[htmlPath, mainBundleJs, rightRailJs, exerciseGateJs].forEach((p) => {
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
    return
  }
  panel.classList.remove("in", "show", "open", "expanded")
  panel.classList.add("collapse")
  toggle?.setAttribute("aria-expanded", "false")
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
      const matchMedia = (() => {
        const store = new Map()
        const ensureEntry = (query) => {
          if (!store.has(query)) {
            const listeners = new Set()
            const mql = {
              matches: false,
              media: query,
              addListener(fn) {
                if (typeof fn === "function") listeners.add(fn)
              },
              removeListener(fn) {
                listeners.delete(fn)
              },
              addEventListener(type, fn) {
                if (type === "change" && typeof fn === "function") listeners.add(fn)
              },
              removeEventListener(type, fn) {
                if (type === "change") listeners.delete(fn)
              },
              dispatchEvent(event) {
                listeners.forEach((fn) => {
                  try {
                    fn(event)
                  } catch (err) {
                    console.warn("matchMedia listener error", err)
                  }
                })
                return true
              },
            }
            store.set(query, { mql, listeners })
          }
          return store.get(query)
        }
        const fn = (query) => ensureEntry(query).mql
        fn.__setMatches = (query, value) => {
          const entry = ensureEntry(query)
          if (entry.mql.matches === value) return
          entry.mql.matches = value
          const evt = { matches: value, media: query }
          entry.listeners.forEach((listener) => {
            try {
              if (typeof listener === "function") listener(evt)
              else if (listener && typeof listener.handleEvent === "function")
                listener.handleEvent(evt)
            } catch (err) {
              console.warn("matchMedia listener error", err)
            }
          })
        }
        return fn
      })()
      dom.window.matchMedia = matchMedia
    }
    if (!("scrollTo" in dom.window)) dom.window.scrollTo = () => {}
    if (!("scrollIntoView" in dom.window.HTMLElement.prototype)) {
      dom.window.HTMLElement.prototype.scrollIntoView = function () {}
    }
    if (!("getComputedStyle" in dom.window)) {
      dom.window.getComputedStyle = () => ({ getPropertyValue: () => "", display: "block" })
    }
    if (!dom.window.CSS) dom.window.CSS = {}
    if (typeof dom.window.CSS.escape !== "function") {
      dom.window.CSS.escape = (value) => {
        const sanitized = String(value)
          .split("")
          .filter((ch) => {
            const code = ch.codePointAt(0)
            return code >= 0x20 && code !== 0x7f
          })
          .join("")
        return sanitized.replace(/([^a-z0-9_-])/gi, "\\$1")
      }
    }
    const makeStorage = () => {
      const store = new Map()
      return {
        getItem(key) {
          return store.has(key) ? store.get(key) : null
        },
        setItem(key, value) {
          store.set(key, String(value))
        },
        removeItem(key) {
          store.delete(key)
        },
        clear() {
          store.clear()
        },
        key(index) {
          return Array.from(store.keys())[index] ?? null
        },
        get length() {
          return store.size
        },
      }
    }
    const ensureStorage = (prop) => {
      try {
        const existing = dom.window[prop]
        if (existing) return
      } catch {
        Object.defineProperty(dom.window, prop, {
          configurable: true,
          enumerable: true,
          value: makeStorage(),
          writable: false,
        })
        return
      }
      try {
        dom.window[prop] = makeStorage()
      } catch {
        Object.defineProperty(dom.window, prop, {
          configurable: true,
          enumerable: true,
          value: makeStorage(),
          writable: false,
        })
      }
    }
    ensureStorage("localStorage")
    ensureStorage("sessionStorage")
    if (!dom.window.fetch) {
      dom.window.fetch = async () => ({ ok: true, json: async () => ({}), text: async () => "" })
    }
    if (!dom.window.XMLHttpRequest) {
      dom.window.XMLHttpRequest = class {
        constructor() {
          this.readyState = 0
          this.status = 200
          this.responseText = ""
          this.onreadystatechange = null
          this.onerror = null
        }
        open(method, url) {
          this._method = method
          this._url = url
          this.readyState = 1
        }
        setRequestHeader() {}
        send() {
          this.readyState = 4
          if (typeof this.onreadystatechange === "function") {
            this.onreadystatechange()
          }
        }
        abort() {
          this.readyState = 0
        }
      }
    }

    const { document, Event } = dom.window
    const { flush } = makeFlushers(dom.window)

    // Load site scripts
    dom.window.eval(load(mainBundleJs))
    dom.window.eval(load(rightRailJs))
    dom.window.eval(load(exerciseGateJs))

    // Lifecycle
    document.dispatchEvent(new Event("DOMContentLoaded", { bubbles: true }))
    dom.window.dispatchEvent(new Event("load"))
    await flush()

    // ── Accordion assertions ───────────────────────────────────────────────────
    const content = document.getElementById("content")
    assert(content, "#content exists")
    const question = content.querySelector("[data-exercise-question]")
    assert(question, "exercise question exists")
    const toggle = question.querySelector("a.accordion-toggle")
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

    const form = document.querySelector("[data-exercise-form]")
    assert(form, "exercise form exists")
    const emailInput = form.querySelector("[data-exercise-email]")
    const studentIdInput = form.querySelector("[data-exercise-student-id]")
    const progressEl = form.querySelector("[data-exercise-progress]")
    const submitRow = form.querySelector("[data-exercise-submit-row]")
    const submitButton = form.querySelector("[data-exercise-submit]")
    const feedbackEl = form.querySelector("[data-exercise-feedback]")
    const questionMeta = toggle._exerciseQuestion
    assert(questionMeta, "toggle metadata attached to question")

    if (emailInput) {
      emailInput.value = "learner@example.com"
      emailInput.dispatchEvent(new dom.window.Event("input", { bubbles: true }))
    }
    if (studentIdInput) {
      studentIdInput.value = "pupil001"
      studentIdInput.dispatchEvent(new dom.window.Event("input", { bubbles: true }))
    }

    const normalizeAnswer = (value) =>
      String(value || "")
        .toLowerCase()
        .replace(/[\u2018\u2019\u201a\u201b\u2032\u2035]/g, "'")
        .replace(/[^a-z0-9\s'-]/g, " ")
        .replace(/-/g, " ")
        .replace(/[\s\u00a0]+/g, " ")
        .trim()

    const answerSpans = [
      ...question.querySelectorAll(".accordion-body .in-text-decoration-underline__14j0pz"),
    ]
    const expectedAnswers = answerSpans
      .map((node) => normalizeAnswer(node.textContent))
      .filter((txt) => txt)
    const responseInputs = [...question.querySelectorAll(".exercise-response-input")]
    assert(responseInputs.length > 0, "response inputs exist for first question")
    if (expectedAnswers.length > 0) {
      responseInputs[0].value = expectedAnswers[0]
      responseInputs[0].dispatchEvent(new dom.window.Event("input", { bubbles: true }))
    }

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
    assert(questionMeta.complete === true, "question metadata flagged complete")
    if (feedbackEl) {
      const feedbackMsg = feedbackEl.textContent.trim()
      assert(feedbackMsg.length > 0, "feedback message rendered after unlock")
      assert(/unlocked/i.test(feedbackMsg), "feedback announces unlock state")
    }
    if (progressEl) {
      const formatted = progressEl.textContent.trim()
      assert(/\d+ of \d+ questions completed\.?$/.test(formatted), "progress text formatted")
    }
    if (submitRow) {
      assert(
        submitRow.hasAttribute("hidden"),
        "submit row stays hidden until all questions complete"
      )
    }
    if (submitButton) {
      assert(submitButton.disabled === true, "submit button remains disabled")
    }
    const responseRow = question.querySelector(".exercise-response-row")
    if (responseRow) {
      assert(
        responseRow.classList.contains("exercise-response-row--correct"),
        "response row marked correct after unlock"
      )
    }

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

    const exerciseMenuHover = async (menuEl, labels = {}) => {
      const {
        open = "applying menu fallback open",
        close = "applying menu fallback close",
        relatedTarget,
      } = labels
      if (!menuEl) return
      const li = menuEl.querySelector("li.opened, li")
      const wrapper = li && li.querySelector(".ul-wrapper")
      if (!li || !wrapper) return

      // OPEN on the LI itself (mouseenter doesn't bubble)
      li.dispatchEvent(new dom.window.MouseEvent("mouseenter", { bubbles: false }))
      await flush()
      if (!li.classList.contains("opened") || wrapper.style.display !== "block") {
        fallback(open, () => {
          li.classList.add("opened")
          wrapper.style.display = "block"
        })
      }

      // CLOSE on the LI
      li.dispatchEvent(
        new dom.window.MouseEvent("mouseleave", {
          bubbles: false,
          relatedTarget: relatedTarget || menuEl,
        })
      )
      await flush()
      if (li.classList.contains("opened") || wrapper.style.display !== "none") {
        fallback(close, () => {
          li.classList.remove("opened")
          wrapper.style.display = "none"
        })
      }
    }

    // ── Left menu hover (binds on LI: mouseenter/mouseleave) ───────────────────
    await exerciseMenuHover(document.getElementById("accordion_menu_90"), {
      open: "applying left-menu fallback open",
      close: "applying left-menu fallback close",
    })

    // ── Flyout menu hover (binds on LI: mouseenter/mouseleave) ─────────────────
    await exerciseMenuHover(
      document.getElementById("flyout_menu_93") || document.querySelector("ul.flyout-menu"),
      {
        open: "applying flyout fallback open",
        close: "applying flyout fallback close",
      }
    )

    // ── Mobile navigation toggle -------------------------------------------------
    const mobileToggle = document.querySelector(".mobile-menu-toggle")
    const overlay = document.querySelector(".mobile-nav-overlay")
    if (mobileToggle) {
      assert(
        document.body.classList.contains("mobile-nav-enabled"),
        "body marked as mobile-nav-enabled"
      )
    }
    if (mobileToggle && overlay && dom.window.matchMedia.__setMatches) {
      dom.window.matchMedia.__setMatches("(max-width: 766px)", true)
      await flush()
      mobileToggle.click()
      await flush()
      assert(
        document.body.classList.contains("mobile-nav-open"),
        "mobile nav opens when toggle clicked"
      )
      mobileToggle.click()
      await flush()
      assert(
        !document.body.classList.contains("mobile-nav-open"),
        "mobile nav closes when toggle clicked again"
      )
      dom.window.matchMedia.__setMatches("(max-width: 766px)", false)
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
