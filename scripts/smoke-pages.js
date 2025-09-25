#!/usr/bin/env node
// Smoke test multiple pages for left/flyout menu behavior presence

import fs from 'node:fs'
import path from 'node:path'
import { JSDOM } from 'jsdom'

const root = process.cwd()
const pages = [
  'exercise-1-nouns/111-common-nouns-codex.html',
  'exercise-11-conditionals.html',
  'exercise-5-pronouns.html',
  'vocabulary.html'
]

const leftMenuJs = path.join(root, 'web-asset/js/left-menu.js')
const flyoutMenuJs = path.join(root, 'web-asset/js/flyout-menu.js')

function load(file) {
  return fs.readFileSync(file, 'utf8')
}

function assert(cond, msg) {
  if (!cond) throw new Error('Assertion failed: ' + msg)
}

async function checkPage(relPath) {
  const filePath = path.join(root, relPath)
  const html = load(filePath)
  const dom = new JSDOM(html, {
    url: 'file://' + filePath,
    pretendToBeVisual: true,
    runScripts: 'outside-only'
  })
  const { document } = dom.window

  // Inject menus
  dom.window.eval(load(leftMenuJs))
  dom.window.eval(load(flyoutMenuJs))
  document.dispatchEvent(new dom.window.Event('DOMContentLoaded', { bubbles: true }))

  // Left menu smoke
  const left = document.getElementById('accordion_menu_90')
  if (left) {
    const li = left.querySelector('li')
    const wrapper = li && li.querySelector('.ul-wrapper')
    if (li && wrapper) {
      li.dispatchEvent(new dom.window.Event('mouseenter'))
      assert(li.classList.contains('opened'), `[${relPath}] left-menu opened`)
      li.dispatchEvent(new dom.window.Event('mouseleave'))
      assert(!li.classList.contains('opened'), `[${relPath}] left-menu closed`)
    }
  }

  // Flyout smoke
  const flyout = document.getElementById('flyout_menu_93')
  if (flyout) {
    const li = flyout.querySelector('li')
    const wrapper = li && li.querySelector('.ul-wrapper')
    if (li && wrapper) {
      li.dispatchEvent(new dom.window.Event('mouseenter'))
      assert(li.classList.contains('opened'), `[${relPath}] flyout opened`)
      li.dispatchEvent(new dom.window.Event('mouseleave'))
      assert(!li.classList.contains('opened'), `[${relPath}] flyout closed`)
    }
  }
}

async function main() {
  for (const p of pages) {
    await checkPage(p)
  }
  console.log('OK: Smoke tests passed for', pages.length, 'pages')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

