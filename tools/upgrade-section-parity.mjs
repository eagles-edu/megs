#!/usr/bin/env node

import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import prettier from "prettier"

const BREADCRUMB_DIVIDER_SVG = [
  '<span class="divider" aria-hidden="true">',
  '  <svg xmlns="http://www.w3.org/2000/svg" width="6" height="10" viewBox="0 0 6 10" fill="none">',
  '    <path d="M1 1L5 5L1 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>',
  "  </svg>",
  "</span>",
].join("\n")

const BREADCRUMB_LIST_RE =
  /<ul[^>]*itemtype=["']https:\/\/schema\.org\/BreadcrumbList["'][^>]*class=["'][^"']*\bbreadcrumb\b[^"']*["'][^>]*>[\s\S]*?<\/ul>/i
const BREADCRUMB_LIST_GLOBAL_RE =
  /<ul[^>]*itemtype=["']https:\/\/schema\.org\/BreadcrumbList["'][^>]*class=["'][^"']*\bbreadcrumb\b[^"']*["'][^>]*>[\s\S]*?<\/ul>/gi
const FAVICON_LINK_RE = /<link[^>]*rel=["']shortcut icon["'][^>]*>/i

const parseArgs = (argv) => {
  const opts = {
    prototype: "",
    targetsFile: "",
    write: false,
    noShell: false,
    noBreadcrumbs: false,
    noFlyout: false,
  }
  const targets = []

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === "--prototype") {
      opts.prototype = argv[++i] || ""
      continue
    }
    if (arg === "--targets-file") {
      opts.targetsFile = argv[++i] || ""
      continue
    }
    if (arg === "--write") {
      opts.write = true
      continue
    }
    if (arg === "--no-shell") {
      opts.noShell = true
      continue
    }
    if (arg === "--no-breadcrumbs") {
      opts.noBreadcrumbs = true
      continue
    }
    if (arg === "--no-flyout") {
      opts.noFlyout = true
      continue
    }
    if (arg === "--help" || arg === "-h") {
      opts.help = true
      continue
    }
    if (arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}`)
    }
    targets.push(arg)
  }

  return { opts, targets }
}

const usage = () => {
  console.log(`\nUsage:\n  node tools/upgrade-section-parity.mjs --prototype <file> [targets...] [--targets-file <file>] --write\n\nOptions:\n  --prototype <file>    Prototype page used for shell block (favicon -> end sidebar).\n  --targets-file <file> Newline-delimited target HTML files.\n  --write               Apply changes (default is dry-run summary only).\n  --no-shell            Skip shell block transplant.\n  --no-breadcrumbs      Skip breadcrumb normalization.\n  --no-flyout           Skip right-flyout formatting.\n`) 
}

const readUtf8 = (filePath) => fs.readFileSync(filePath, "utf8")

const normalizeText = (value) =>
  String(value || "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim()

const indentBlock = (block, indent) =>
  block
    .trim()
    .split(/\r?\n/)
    .map((line) => `${indent}${line}`)
    .join("\n")

const replaceAt = (source, start, end, replacement) =>
  `${source.slice(0, start)}${replacement}${source.slice(end)}`

const extractShellBlock = (prototypeHtml) => {
  const startMatch = prototypeHtml.match(FAVICON_LINK_RE)
  if (!startMatch || startMatch.index === undefined) {
    throw new Error("Prototype missing favicon link for shell extraction")
  }
  const start = startMatch.index
  const marker = "<!-- End Sidebar -->"
  const endMarker = prototypeHtml.indexOf(marker, start)
  if (endMarker < 0) {
    throw new Error("Prototype missing <!-- End Sidebar --> marker")
  }
  return prototypeHtml.slice(start, endMarker + marker.length)
}

const isExternalLike = (value) =>
  /^(?:[a-z]+:)?\/\//i.test(value) ||
  value.startsWith("#") ||
  value.startsWith("mailto:") ||
  value.startsWith("tel:") ||
  value.startsWith("data:") ||
  value.startsWith("javascript:")

const rebaseRelativeUrls = (fragment, prototypeFile, targetFile) => {
  const prototypeDir = path.posix.dirname(prototypeFile)
  const targetDir = path.posix.dirname(targetFile)
  return fragment.replace(/\b(href|src)=("|')([^"']+)(\2)/g, (match, attr, quote, raw) => {
    if (isExternalLike(raw)) return match
    const absoluteFromRepo = path.posix.normalize(path.posix.join(prototypeDir, raw))
    let rel = path.posix.relative(targetDir, absoluteFromRepo)
    if (!rel) rel = "."
    return `${attr}=${quote}${rel}${quote}`
  })
}

const applyShellBlock = (html, targetFile, rebasedShellBlock) => {
  const startMatch = html.match(FAVICON_LINK_RE)
  if (!startMatch || startMatch.index === undefined) {
    throw new Error(`Target missing favicon link: ${targetFile}`)
  }
  const start = startMatch.index
  const marker = "<!-- End Sidebar -->"
  const endMarker = html.indexOf(marker, start)
  if (endMarker < 0) {
    throw new Error(`Target missing <!-- End Sidebar --> marker: ${targetFile}`)
  }
  return replaceAt(html, start, endMarker + marker.length, rebasedShellBlock)
}

const normalizeBreadcrumbList = (listHtml, headline) => {
  let out = listHtml
  out = out.replace(/<span class=["']divider["'][^>]*>\s*<img[^>]*>\s*<\/span>/gi, BREADCRUMB_DIVIDER_SVG)

  const names = [...out.matchAll(/<span itemprop=["']name["']>[\s\S]*?<\/span>/gi)]
  if (names.length === 0) return out
  const last = names[names.length - 1]
  const before = out.slice(0, last.index)
  const after = out.slice((last.index || 0) + last[0].length)
  return `${before}<span itemprop="name">${headline}</span>${after}`
}

const replaceTopBottomWrappers = (html, crumbList) => {
  const topRe = /(^[ \t]*)<nav class="breadcrumb-wrap" aria-label="breadcrumbs-top">[\s\S]*?<\/nav>/m
  const bottomRe = /(^[ \t]*)<nav class="breadcrumb-wrap" aria-label="breadcrumbs-bottom">[\s\S]*?<\/nav>/m

  const buildWrapped = (indent, label) =>
    `${indent}<nav class="breadcrumb-wrap" aria-label="${label}">\n${indentBlock(crumbList, `${indent}  `)}\n${indent}</nav>`

  let out = html

  if (topRe.test(out)) {
    out = out.replace(topRe, (_m, indent = "") => buildWrapped(indent, "breadcrumbs-top"))
  } else {
    out = out.replace(
      /(^[ \t]*)<div itemprop="articleBody">/m,
      (_m, indent = "") => `${buildWrapped(indent, "breadcrumbs-top")}\n${indent}<div itemprop="articleBody">`,
    )
  }

  if (bottomRe.test(out)) {
    out = out.replace(bottomRe, (_m, indent = "") => buildWrapped(indent, "breadcrumbs-bottom"))
  } else {
    const matches = [...out.matchAll(BREADCRUMB_LIST_GLOBAL_RE)]
    if (matches.length > 0) {
      const last = matches[matches.length - 1]
      const start = last.index || 0
      const end = start + last[0].length
      const lineStart = out.lastIndexOf("\n", start) + 1
      const indentMatch = out.slice(lineStart, start).match(/^[ \t]*/)
      const indent = indentMatch ? indentMatch[0] : ""
      out = replaceAt(out, start, end, buildWrapped(indent, "breadcrumbs-bottom"))
    }
  }

  return out
}

const normalizeBreadcrumbs = (html, targetFile, warnings) => {
  const h2Match = html.match(/<h2 itemprop="headline">([\s\S]*?)<\/h2>/i)
  if (!h2Match) {
    warnings.push(`skip-breadcrumbs:${targetFile}:missing-h2`)
    return html
  }
  const headline = normalizeText(h2Match[1])
  const crumbMatch = html.match(BREADCRUMB_LIST_RE)
  if (!crumbMatch) {
    warnings.push(`skip-breadcrumbs:${targetFile}:missing-breadcrumb-list`)
    return html
  }
  const normalizedList = normalizeBreadcrumbList(crumbMatch[0], headline)
  return replaceTopBottomWrappers(html, normalizedList)
}

const formatFlyoutNav = async (html) => {
  const flyoutMatch = html.match(/<nav class="r-flyout-nav"[\s\S]*?<\/nav>/m)
  if (!flyoutMatch || flyoutMatch.index === undefined) {
    return html
  }

  const source = flyoutMatch[0]
  const formatted = (await prettier.format(source, { parser: "html", printWidth: 120 })).trimEnd()
  const lineStart = html.lastIndexOf("\n", flyoutMatch.index) + 1
  const indent = html.slice(lineStart, flyoutMatch.index).match(/^[ \t]*/)?.[0] || ""
  const indented = formatted
    .split("\n")
    .map((line) => `${indent}${line}`)
    .join("\n")

  return replaceAt(html, flyoutMatch.index, flyoutMatch.index + source.length, indented)
}

const main = async () => {
  const { opts, targets: cliTargets } = parseArgs(process.argv.slice(2))

  if (opts.help) {
    usage()
    return
  }

  if (!opts.prototype) {
    throw new Error("--prototype is required")
  }

  const targets = [...cliTargets]
  if (opts.targetsFile) {
    const listed = readUtf8(opts.targetsFile)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
    targets.push(...listed)
  }

  const uniqueTargets = Array.from(new Set(targets))
  if (uniqueTargets.length === 0) {
    throw new Error("No target files provided")
  }

  const prototype = path.posix.normalize(opts.prototype.replace(/\\/g, "/"))
  const prototypeHtml = readUtf8(prototype)
  const shellBlock = extractShellBlock(prototypeHtml)

  const changed = []
  const warnings = []
  const errors = []

  for (const targetRaw of uniqueTargets) {
    const target = path.posix.normalize(targetRaw.replace(/\\/g, "/"))
    try {
      let html = readUtf8(target)
      let next = html

      if (!opts.noShell) {
        const rebasedShell = rebaseRelativeUrls(shellBlock, prototype, target)
        next = applyShellBlock(next, target, rebasedShell)
      }

      if (!opts.noBreadcrumbs) {
        next = normalizeBreadcrumbs(next, target, warnings)
      }

      if (!opts.noFlyout) {
        next = await formatFlyoutNav(next)
      }

      if (next !== html) {
        changed.push(target)
        if (opts.write) {
          fs.writeFileSync(target, next)
        }
      }
    } catch (err) {
      errors.push(`${target}: ${err.message}`)
    }
  }

  console.log(`[parity-upgrade] prototype: ${prototype}`)
  console.log(`[parity-upgrade] targets: ${uniqueTargets.length}`)
  console.log(`[parity-upgrade] changed: ${changed.length}`)
  console.log(`[parity-upgrade] warnings: ${warnings.length}`)
  console.log(`[parity-upgrade] errors: ${errors.length}`)
  if (changed.length > 0) {
    changed.forEach((file) => console.log(` - ${file}`))
  }
  if (warnings.length > 0) {
    warnings.forEach((line) => console.log(` ! ${line}`))
  }
  if (errors.length > 0) {
    errors.forEach((line) => console.log(` x ${line}`))
    process.exitCode = 1
  }
  if (!opts.write) {
    console.log("[parity-upgrade] dry-run only. Add --write to apply.")
  }
}

main().catch((err) => {
  console.error(`[parity-upgrade] ERROR: ${err.message}`)
  process.exitCode = 1
})
