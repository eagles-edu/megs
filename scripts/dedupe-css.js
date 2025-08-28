#!/usr/bin/env node
// Remove duplicate declarations within each CSS rule, preserving the last occurrence.
// Usage: node scripts/dedupe-css.js templates/protostar/css/template592f.css

const fs = require('fs')

const file = process.argv[2]
if (!file) {
  console.error('Usage: node scripts/dedupe-css.js <file.css>')
  process.exit(1)
}

const src = fs.readFileSync(file, 'utf8')
const out = []
let i = 0
while (i < src.length) {
  const open = src.indexOf('{', i)
  if (open === -1) {
    out.push(src.slice(i))
    break
  }
  // push selector part including '{'
  const header = src.slice(i, open + 1)
  out.push(header)
  // find matching '}' at same nesting level
  let j = open + 1
  let depth = 1
  while (j < src.length && depth > 0) {
    const ch = src[j]
    if (ch === '{') depth++
    else if (ch === '}') depth--
    j++
  }
  const block = src.slice(open + 1, j - 1)
  const lines = block.split(/\n/)
  // track last index of each property (exact name match)
  const lastIndex = new Map()
  lines.forEach((ln, idx) => {
    const m = ln.match(/(^|\s)([\-*a-zA-Z][\w-]*)\s*:/)
    if (!m) return
    const prop = m[2]
    lastIndex.set(prop, idx)
  })
  // rebuild lines keeping only last occurrence for each property
  const keep = new Array(lines.length).fill(true)
  lines.forEach((ln, idx) => {
    const m = ln.match(/(^|\s)([\-*a-zA-Z][\w-]*)\s*:/)
    if (!m) return
    const prop = m[2]
    if (lastIndex.get(prop) !== idx) keep[idx] = false
  })
  const cleaned = lines.filter((_, idx) => keep[idx]).join('\n')
  out.push(cleaned)
  out.push('}')
  i = j
}

fs.writeFileSync(file, out.join(''), 'utf8')
console.log(`Deduped: ${file}`)

