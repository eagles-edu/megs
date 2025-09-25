#!/usr/bin/env node
import { JSDOM } from 'jsdom'

const PORT = process.env.PORT || 8080
const URL = `http://127.0.0.1:${PORT}/exercise-1-nouns/111-common-nouns-codex.html`

function assert(cond, msg) {
  if (!cond) throw new Error('Assertion failed: ' + msg)
}

async function waitForLoad(window, timeout = 5000) {
  if (window.document.readyState === 'complete') return
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout waiting for load')), timeout)
    window.addEventListener('load', () => { clearTimeout(timer); resolve() })
  })
}

async function main() {
  const dom = await JSDOM.fromURL(URL, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
  })
  const { window } = dom
  await waitForLoad(window, 6000)

  const content = window.document.getElementById('content')
  assert(content, '#content exists')
  const toggle = content.querySelector('a.accordion-toggle')
  assert(toggle, 'Found a toggle')

  const hrefBefore = toggle.getAttribute('href')
  const ariaBefore = toggle.getAttribute('aria-controls')
  const id = ariaBefore || toggle.getAttribute('data-id') || (hrefBefore||'').split('#')[1]
  assert(id, 'Toggle controls an id')
  const panel = window.document.getElementById(id) || toggle.closest('.accordion-group')?.querySelector('.accordion-body')
  assert(panel, 'Target panel exists')

  // Click to open, then click to close
  toggle.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
  assert(panel.classList.contains('in') || panel.classList.contains('show'), 'Panel opened on click')
  toggle.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
  assert(!panel.classList.contains('in') && !panel.classList.contains('show'), 'Panel closed on second click')

  console.log('OK: Live verification passed for', URL)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
