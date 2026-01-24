#!/usr/bin/env node
// Smoke test multiple pages for left/flyout menu behavior presence

import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { JSDOM } from "jsdom"

const root = process.cwd()
const lessonDir = path.join(root, "lesson-1-nouns")
if (!fs.existsSync(lessonDir)) {
  console.error("❌ lesson-1-nouns directory not found")
  process.exit(1)
}

const pages = fs
  .readdirSync(lessonDir)
  .filter((file) => file.toLowerCase().endsWith(".html"))
  .map((file) => path.join("lesson-1-nouns", file))
  .sort((a, b) => a.localeCompare(b))

if (!pages.length) {
  console.error("❌ No HTML pages found in lesson-1-nouns/")
  process.exit(1)
}

const leftMenuJs = path.join(root, "web-asset/js/left-menu.js")
const flyoutMenuJs = path.join(root, "web-asset/js/flyout-menu.js")

;[leftMenuJs, flyoutMenuJs].forEach((asset) => {
  if (!fs.existsSync(asset)) {
    console.error(`❌ Missing required asset: ${path.relative(root, asset)}`)
    process.exit(1)
  }
})

function load(file) {
  return fs.readFileSync(file, "utf8")
}

function assert(cond, msg) {
  if (!cond) throw new Error("Assertion failed: " + msg)
}

async function checkPage(relPath) {
  const filePath = path.join(root, relPath)
  const html = load(filePath)
  const dom = new JSDOM(html, {
    url: "file://" + filePath,
    pretendToBeVisual: true,
    runScripts: "outside-only",
  })
  const { document } = dom.window

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
    return { flush }
  }

  const { flush } = makeFlushers(dom.window)

  // Inject menus
  dom.window.eval(load(leftMenuJs))
  dom.window.eval(load(flyoutMenuJs))
  document.dispatchEvent(new dom.window.Event("DOMContentLoaded", { bubbles: true }))
  dom.window.dispatchEvent(new dom.window.Event("load"))
  await flush()

  // Left menu smoke
  const left = document.getElementById("accordion_menu_90")
  if (left) {
    const li = left.querySelector("li")
    const wrapper = li && li.querySelector(".ul-wrapper")
    if (li && wrapper) {
      li.dispatchEvent(new dom.window.MouseEvent("mouseenter", { bubbles: false }))
      assert(li.classList.contains("opened"), `[${relPath}] left-menu opened`)
      assert(wrapper.style.display === "block", `[${relPath}] left-menu wrapper visible`)
      li.dispatchEvent(
        new dom.window.MouseEvent("mouseleave", { bubbles: false, relatedTarget: left })
      )
      assert(!li.classList.contains("opened"), `[${relPath}] left-menu closed`)
      assert(wrapper.style.display === "none", `[${relPath}] left-menu wrapper hidden`)
    }
  }

  // Flyout smoke
  const flyout =
    document.getElementById("flyout_menu_93") ||
    document.querySelector('ul[id^="flyout_menu_"]') ||
    document.querySelector("ul.flyout-menu")
  if (flyout) {
    const li = flyout.querySelector("li")
    const wrapper = li && li.querySelector(".ul-wrapper")
    if (li && wrapper) {
      li.dispatchEvent(new dom.window.MouseEvent("mouseenter", { bubbles: false }))
      assert(li.classList.contains("opened"), `[${relPath}] flyout opened`)
      assert(wrapper.style.display === "block", `[${relPath}] flyout wrapper visible`)
      li.dispatchEvent(
        new dom.window.MouseEvent("mouseleave", { bubbles: false, relatedTarget: flyout })
      )
      assert(!li.classList.contains("opened"), `[${relPath}] flyout closed`)
      assert(wrapper.style.display === "none", `[${relPath}] flyout wrapper hidden`)
    }
  }
}

async function main() {
  for (const p of pages) {
    await checkPage(p)
  }
  console.log("OK: Smoke tests passed for", pages.length, "lesson pages")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
