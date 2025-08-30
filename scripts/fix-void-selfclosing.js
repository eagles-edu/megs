#!/usr/bin/env node
/*
 Replace XML-style self-closing syntax on HTML void elements with omitted-end-tag style.
 Affects only: area, base, br, col, embed, hr, img, input, link, meta, param, source, track, wbr
 Usage: node scripts/fix-void-selfclosing.js [globs...]
 If no globs passed, defaults to all .html and .htm files.
*/
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_GLOBS = ["**/*.html", "**/*.htm"]; 

// simple glob walker (no deps): recurse and filter by extensions
function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.git')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else {
      yield full;
    }
  }
}

function matches(file, exts) {
  return exts.some((e) => file.toLowerCase().endsWith(e));
}

const VOID_TAGS = [
  'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'
];

// Build regex: <(tag)(attrs)/> -> <$1$2>
const tagGroup = VOID_TAGS.join('|');
const re = new RegExp(`<(?:${tagGroup})(?:[^>"]|"[^"]*"|'[^']*')*?/\\s*>`, 'gi');

const root = process.cwd();
let changed = 0;
let files = 0;

for (const file of walk(root)) {
  if (!matches(file, ['.html', '.htm'])) continue;
  const orig = fs.readFileSync(file, 'utf8');
  const next = orig.replace(re, (m) => m.replace(/\s*\/\s*>$/i, '>'));
  if (next !== orig) {
    fs.writeFileSync(file, next, 'utf8');
    changed++;
  }
  files++;
}

console.log(`Scanned ${files} HTML files, fixed ${changed} files with self-closing void tags.`);
