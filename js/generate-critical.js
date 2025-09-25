#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const critical = require('critical');

(async function main() {
  const htmlPath = process.argv[2] || 'exercise-1-nouns/111-common-nouns-codex.html';
  const base = process.cwd();
  const cssList = [
    'web-asset/css/base.css',
    'web-asset/css/left-menu.css',
    'web-asset/css/flyout-menu.css',
    'web-asset/css/page-classes.css',
    'web-asset/css/qa-accordion.css'
  ].map(p => path.join(base, p));

  const src = path.join(base, htmlPath);
  console.log('Generating critical CSS for', src);
  const { css } = await critical.generate({
    base,
    src,
    css: cssList,
    inline: false,
    rebase: false,
    minify: true,
    width: 412,
    height: 915
  });

  const html = fs.readFileSync(src, 'utf8');
  const start = '<style id="critical-inline">';
  const end = '</style>';
  const startIdx = html.indexOf(start);
  if (startIdx === -1) throw new Error('Missing <style id="critical-inline"> placeholder');
  const endIdx = html.indexOf(end, startIdx);
  if (endIdx === -1) throw new Error('Missing </style> after critical placeholder');
  const before = html.slice(0, startIdx + start.length);
  const after = html.slice(endIdx);
  const safeCss = css.replace(/</g, '&lt;');
  const nextHtml = `${before}\n${safeCss}\n${after}`;
  fs.writeFileSync(src, nextHtml);
  console.log('Inlined critical CSS into', src);
})().catch((e) => { console.error(e); process.exit(1); });

