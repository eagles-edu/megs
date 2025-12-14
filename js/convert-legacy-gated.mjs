#!/usr/bin/env node
/*
Usage:
  - node js/convert-legacy-gated.mjs /path/to/legacy.html [options]

  - node js/convert-legacy-gated.mjs exercise-2-verbs/231-auxiliary-verbs.html --answer-fields 1 --diff-preview

  - node js/convert-legacy-gated.mjs exercise-1-nouns/151-gender.html --answer-fields 1 --answer-ui textarea --diff-preview

Flags:
  --questions <int>             Override expected question count validation.
  --answer-fields <int>         Force number of answer inputs, 1 to 6 per question (defaults to scraped).
  --answer-ui <kind>            Force answer UI for all questions (e.g., textarea).
  --template <path>             Set gated template path (defaults to exercise-1-nouns/111-common-nouns.html).
  --dry-run                     Report actions without writing changes.
  --diff-preview                Show git-style diff between legacy and converted output.
  --test-mode                   Auto-fill answers and leave accordions open for QA.

Flag combos:
  --dry-run --diff-preview       Inspect the generated diff without touching files.
  --test-mode --answer-fields N  Generate QA-friendly output with N answer inputs per item.
  --test-mode --diff-preview     Open accordions for review while previewing the diff.

Per-question options:
  Add data-answer-ui="textarea" ****on a legacy .nn_sliders block**** to force a single, full-width, auto-resizing textarea (ignores --answer-fields overrides).
  The --answer-ui flag applies this to all questions; per-question data attributes still win.
*/
import { ArgumentParser } from "argparse"
import { load } from "cheerio"
import fs from "fs"
import os from "os"
import path from "path"
import { fileURLToPath } from "url"
import { spawnSync } from "child_process"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Keep aligned with tools/legacy-exercise-generator.mjs and tools/expand-questions.mjs
const fieldNames = ["answer_01", "answer_02", "answer_03", "answer_04", "answer_05", "answer_06"]

function slugify(value) {
  return (
    (value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "question"
  )
}

function loadHtml(targetPath) {
  try {
    return fs.readFileSync(targetPath, "utf8")
  } catch (error) {
    throw new Error(`Unable to read ${targetPath}: ${error.message}`)
  }
}

function ensureFileExists(targetPath) {
  if (!fs.existsSync(targetPath)) {
    throw new Error(`File not found: ${targetPath}`)
  }
}

function logEvent(telemetry, status, name, detail = "") {
  if (!telemetry) return
  telemetry.push({ status, name, detail })
}

function printTelemetry(telemetry = []) {
  if (!telemetry.length) return
  console.log("Conversion summary:")
  telemetry.forEach((event) => {
    const prefix = event.status === "warn" ? "WARN" : event.status === "fail" ? "FAIL" : "OK"
    const detail = event.detail ? ` - ${event.detail}` : ""
    console.log(`  [${prefix}] ${event.name}${detail}`)
  })
}

function resolvePathMaybe(relativePath) {
  return path.isAbsolute(relativePath) ? relativePath : path.resolve(process.cwd(), relativePath)
}

function extractInstructions($) {
  const firstAccordion = $(".nn_sliders").first()
  if (!firstAccordion.length) {
    return ""
  }

  const paragraphs = []
  let cursor = firstAccordion.prev()
  while (cursor && cursor.length) {
    if (cursor[0].tagName === "p") {
      const text = $(cursor).text().trim()
      if (text) paragraphs.unshift(text)
    }
    cursor = cursor.prev()
  }

  if (paragraphs.length) return paragraphs.join("\n")
  return $("p")
    .slice(0, 3)
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean)
    .join("\n")
}

function scrapeBreadcrumbs($) {
  const crumbs = []
  $("ul.breadcrumb li").each((index, li) => {
    const anchor = $(li).find("a").first()
    const name = anchor.length ? anchor.text().trim() : $(li).text().trim()
    const href = anchor.attr("href") || ""
    if (name) {
      crumbs.push({ name, href, position: index })
    }
  })
  return crumbs
}

function extractLinkLabelWithoutSvg(link) {
  if (!link || !link.length) return ""
  const clone = link.clone()
  clone.find("svg").remove()
  return clone
    .text()
    .replace(/\s+/g, " ")
    .trim()
}

function scrapePager($) {
  const pager = {}
  const prev = $(".pager .previous a").first()
  if (prev.length) {
    pager.previous = {
      href: prev.attr("href") || "",
      label: extractLinkLabelWithoutSvg(prev) || prev.attr("aria-label") || "",
      ariaLabel: prev.attr("aria-label") || "",
      rel: prev.attr("rel") || "prev",
      html: prev.html() || "",
      icon: prev.find("svg").first().toString() || "",
    }
  }
  const next = $(".pager .next a").first()
  if (next.length) {
    pager.next = {
      href: next.attr("href") || "",
      label: extractLinkLabelWithoutSvg(next) || next.attr("aria-label") || "",
      ariaLabel: next.attr("aria-label") || "",
      rel: next.attr("rel") || "next",
      html: next.html() || "",
      icon: next.find("svg").first().toString() || "",
    }
  }
  return pager
}

function scrapeAside($) {
  const aside = $("#aside").first()
  if (!aside.length) {
    return { html: "", rootHref: "", rootLabel: "", hasRFlyout: false, hasLegacyFlyout: false }
  }
  const rFlyout = aside.find(".r-flyout-menu").first()
  const legacyFlyout = aside.find(".flyout-menu").first()
  const root = rFlyout.find(".r-flyout__link-wrap a").first()
  return {
    html: aside.html() || "",
    rootHref: root.length ? root.attr("href") || "" : "",
    rootLabel: root.length ? root.text().trim() || "" : "",
    hasRFlyout: Boolean(rFlyout.length),
    hasLegacyFlyout: Boolean(legacyFlyout.length),
  }
}

function scrapeQuestions($) {
  const questions = []
  $(".nn_sliders").each((i, element) => {
    const wrapper = $(element)
    const toggle = wrapper.find(".nn_sliders-toggle").first()
    const body = wrapper.find(".nn_sliders-body").first()
    const number = i + 1
    const questionText = (
      toggle.find(".nn_sliders-toggle-inner").text() ||
      toggle.text() ||
      ""
    ).trim()
    const ariaControls =
      toggle.attr("aria-controls") || (toggle.attr("href") || "").replace(/^#/, "")
    const dataId = toggle.attr("data-id") || ariaControls || `q${number}`
    const dataParent = toggle.attr("data-parent") || ""
    const scrollTarget = wrapper.find('[id^="nn_sliders-scrollto"]').first().attr("id") || ""
    const storageKey = body.attr("id") || ariaControls || dataId
    const answerUi =
      (wrapper.attr("data-answer-ui") ||
        toggle.attr("data-answer-ui") ||
        body.attr("data-answer-ui") ||
        "")
        .trim()
        .toLowerCase()
    const scrapedAnswerFieldCount =
      wrapper.find(
        ".exercise-response-row input, .exercise-response-row textarea, .exercise-response-row select"
      ).length || 1
    const answerFieldCount = answerUi === "textarea" ? 1 : scrapedAnswerFieldCount

    if (!questionText) {
      throw new Error(`Missing question text for item ${number}`)
    }

    questions.push({
      number,
      questionText,
      ariaControls,
      dataId,
      dataParent,
      scrollTarget,
      storageKey,
      answerFieldCount,
      answerUi,
    })
  })
  return questions
}

function scrapeLegacy(legacyHtml, legacyPath) {
  const $ = load(legacyHtml)
  const title = $("title").first().text().trim()
  const canonical =
    $('link[rel="canonical"]').attr("href") || $('link[rel="non-canonical"]').attr("href") || ""
  const breadcrumbs = scrapeBreadcrumbs($)
  const pager = scrapePager($)
  const aside = scrapeAside($)
  const instructions = extractInstructions($)
  const questions = scrapeQuestions($)

  if (!title) throw new Error("Missing <title> content")
  if (!canonical) throw new Error('Missing canonical or rel="non-canonical" link')
  if (!questions.length) throw new Error("No questions found (expected .nn_sliders elements)")

  return {
    legacyPath,
    title,
    canonical,
    breadcrumbs,
    pager,
    aside,
    instructions,
    questions,
    totalQuestions: questions.length,
  }
}

function buildResponseFields($, questionKey, count, testMode, answerUi) {
  const isTextarea = (answerUi || "").toLowerCase() === "textarea"
  const row = $("<div>")
    .addClass("exercise-response-row")
    .attr("data-item", String(questionKey))
    .attr("data-answer-ui", isTextarea ? "textarea" : "")
  if (isTextarea) {
    row.addClass("exercise-response-row--long")
  }
  const labelPrefix = testMode ? "Auto-filled" : "Response"
  for (let i = 0; i < count; i += 1) {
    const name = fieldNames[i] || `field${i + 1}`
    const label = $("<label>").addClass("exercise-response-field")
    if (isTextarea) {
      label.addClass("exercise-response-field--long")
    }
    label.append(
      $("<span>").addClass("visually-hidden").text(`${labelPrefix} for item ${questionKey} (${name})`)
    )
    const input = isTextarea
      ? $("<textarea>")
          .addClass("exercise-response-input exercise-response-input--textarea")
          .attr({
            rows: 1,
            placeholder: "Rewrite here",
            "data-item": String(questionKey),
            "data-field": name,
            "data-autosize": "true",
          })
      : $("<input>")
          .addClass("exercise-response-input")
          .attr({
            type: "text",
            placeholder: "Answer",
            "data-item": String(questionKey),
            "data-field": name,
            inputmode: "text",
          })
    if (testMode) input.val(`Answer ${questionKey}.${i + 1}`)
    label.append(input)
    row.append(label)
  }
  return row
}

function buildQuestionDom($, question, answerFieldCount, testMode, fileName) {
  const questionKey = question.storageKey || question.dataId || `q${question.number}`
  const questBg = $("<div>")
    .addClass("quest-bg")
    .attr("data-exercise-question", String(questionKey))
  const groupId = `set-nn_sliders-${question.number}`
  const accordion = $("<div>").addClass("nn_sliders accordion panel-group").attr("id", groupId)
  const scrollAnchorId = question.scrollTarget || `nn_sliders-scrollto_${question.number}`
  accordion.append($("<span>").attr("id", scrollAnchorId).addClass("anchor nn_sliders-scroll"))

  const group = $("<div>").addClass("accordion-group panel nn_sliders-group")
  accordion.append(group)

  const innerScrollId = `${scrollAnchorId}-${questionKey}`
  group.append($("<span>").attr("id", innerScrollId).addClass("anchor nn_sliders-scroll"))

  const heading = $("<div>").addClass("accordion-heading panel-heading")
  const toggle = $("<a>")
    .addClass("accordion-toggle nn_sliders-toggle")
    .attr({
      href: `${fileName}#${question.ariaControls || questionKey}`,
      "aria-label": "Answer",
      "data-toggle": "collapse",
      "data-parent": question.dataParent || `#${groupId}`,
      "data-id": question.dataId || questionKey,
      "aria-expanded": testMode ? "true" : "false",
    })
  if (question.ariaControls) {
    toggle.attr("aria-controls", question.ariaControls)
  }
  toggle.append($("<span>").addClass("nn_sliders-toggle-inner").text(question.questionText))
  heading.append(toggle)
  group.append(heading)

  const bodyId = question.storageKey || question.ariaControls || questionKey
  const body = $("<div>")
    .addClass(`accordion-body nn_sliders-body${testMode ? "" : " collapse"}`)
    .attr({ id: bodyId, "aria-hidden": testMode ? "false" : "true" })
  const inner = $("<div>").addClass("accordion-inner panel-body")
  inner.append($("<h2>").addClass("nn_sliders-title").text(question.questionText))
  inner.append($("<p>").text(question.questionText))
  body.append(inner)
  if (testMode) {
    body.append(
      $("<div>")
        .addClass("accordion-test-mode-note")
        .text("Test mode: accordion open, answers auto-filled.")
    )
  }
  group.append(body)
  group.append(
    buildResponseFields($, questionKey, answerFieldCount, testMode, question.answerUi)
  )

  questBg.append(accordion)
  return questBg
}

function resolveAnswerFieldCount(question, overrideCount) {
  if (question && (question.answerUi || "").toLowerCase() === "textarea") return 1
  if (overrideCount && Number.isInteger(overrideCount) && overrideCount > 0) return overrideCount
  if (
    question.answerFieldCount &&
    Number.isInteger(question.answerFieldCount) &&
    question.answerFieldCount > 0
  ) {
    return question.answerFieldCount
  }
  return 1
}

function createAnswerKey(scraped, overrideAnswerFieldCount, testMode = false) {
  const answerArray = {}
  scraped.questions.forEach((question, index) => {
    const key = `question${String(index + 1).padStart(2, "0")}`
    const answerCount = resolveAnswerFieldCount(question, overrideAnswerFieldCount)
    const questionKey = question.storageKey || question.dataId || String(index + 1)

    answerArray[key] = {
      id: questionKey,
      answersAccepted: [],
      lengths: [answerCount],
      minLength: answerCount,
      maxLength: answerCount,
      manualCheckOk: false,
    }
  })

  return {
    title:
      slugify(path.basename(scraped.legacyPath, path.extname(scraped.legacyPath))) || "exercise",
    version: "0.3.0",
    publishDate: new Date().toISOString(),
    description: scraped.title,
    options: {
      requireCorrectBeforeReveal: !testMode,
      defaultHashAlgorithm: "fnv1a-64",
    },
    answerArrays: {
      exerciseName:
        slugify(path.basename(scraped.legacyPath, path.extname(scraped.legacyPath))) || "exercise",
      totalQuestions: scraped.totalQuestions,
      answerArray,
    },
  }
}

function ensureAnswerKeyIsJsonSafe(answerKey) {
  const entries = (answerKey && answerKey.answerArrays && answerKey.answerArrays.answerArray) || {}
  Object.keys(entries).forEach((key) => {
    const entry = entries[key] || {}
    if (!Array.isArray(entry.answersAccepted)) entry.answersAccepted = []
    entry.answersAccepted = entry.answersAccepted.map((combo, comboIndex) => {
      const list = Array.isArray(combo) ? combo : [combo]
      list.forEach((token, tokenIndex) => {
        if (typeof token !== "string") {
          throw new Error(
            `Invalid answer token for ${key} at [${comboIndex}][${tokenIndex}]: expected string`
          )
        }
        const trimmed = token.trim()
        if (/^(\/\/|\/\*|#)/.test(trimmed)) {
          throw new Error(
            `Invalid answer token for ${key} at [${comboIndex}][${tokenIndex}]: comment-like content detected`
          )
        }
      })
      return list
    })
    if (!Array.isArray(entry.lengths) || !entry.lengths.length) {
      const inferredLength =
        (entry.answersAccepted && entry.answersAccepted[0] && entry.answersAccepted[0].length) ||
        (Number.isInteger(entry.minLength) && entry.minLength > 0 ? entry.minLength : null) ||
        (Number.isInteger(entry.maxLength) && entry.maxLength > 0 ? entry.maxLength : null) ||
        1
      entry.lengths = [inferredLength]
    }
    if (!Number.isInteger(entry.minLength) || entry.minLength <= 0) {
      entry.minLength = Array.isArray(entry.lengths) && entry.lengths.length ? entry.lengths[0] : 1
    }
    if (!Number.isInteger(entry.maxLength) || entry.maxLength <= 0) {
      entry.maxLength = Array.isArray(entry.lengths) && entry.lengths.length ? entry.lengths[0] : 1
    }
    if (entry.manualCheckOk == null) entry.manualCheckOk = false
  })
}

function createExerciseConfig(scraped) {
  return {
    title: scraped.title,
    canonical: scraped.canonical,
    totalQuestions: scraped.totalQuestions,
    submitUrl: "",
    recipients: [],
    breadcrumbs: scraped.breadcrumbs,
    pager: scraped.pager,
  }
}

function applyPagerLink($, target, link) {
  if (!target.length || !link) return
  target.attr("href", link.href || "#")
  if (link.rel) target.attr("rel", link.rel)
  const ariaLabel = link.ariaLabel || link.label || target.attr("aria-label") || ""
  if (ariaLabel) {
    target.attr("aria-label", ariaLabel)
  }
  const icons = target
    .find("svg")
    .toArray()
    .map((icon) => $(icon).clone())
  target.empty()
  const isNext = (link.rel || "").toLowerCase() === "next"
  if (isNext) {
    if (link.label) {
      target.append(link.label)
    }
    if (icons.length) {
      if (link.label) target.append("\u00a0\u00a0")
      icons.forEach((icon) => target.append(icon))
    }
  } else {
    icons.forEach((icon) => target.append(icon))
    if (link.label) {
      target.append(`\u00a0\u00a0${link.label}`)
    }
  }
}

function applyPagerLinks($, scrapedPager, telemetry) {
  if (!scrapedPager || (!scrapedPager.previous && !scrapedPager.next)) {
    logEvent(telemetry, "warn", "pager", "No scraped pager data to apply")
    return
  }

  const pagers = $(".pager")
  if (!pagers.length) {
    logEvent(telemetry, "warn", "pager", "Pager template missing; cannot apply pager links")
    return
  }

  pagers.each((_, pager) => {
    const wrapper = $(pager)
    const prev = wrapper.find(".previous a, .prev a").first()
    if (prev.length && scrapedPager.previous) {
      applyPagerLink($, prev, scrapedPager.previous)
    }

    const next = wrapper.find(".next a").first()
    if (next.length && scrapedPager.next) {
      applyPagerLink($, next, scrapedPager.next)
    }
  })

  logEvent(telemetry, "ok", "pager", `Applied pager links to ${pagers.length} pager(s)`)
}

function injectTemplate(
  templateHtml,
  scraped,
  overrideAnswerFieldCount,
  testMode,
  targetPath,
  defaultAnswerUi,
  telemetry = []
) {
  const $ = load(templateHtml, { decodeEntities: false })
  const fileName = path.basename(targetPath)
  const normalizedDefaultUi = (defaultAnswerUi || "").trim().toLowerCase()

  logEvent(telemetry, "ok", "head-shell", "Using template head assets and scripts")

  $("title").first().text(scraped.title)
  const nonCanonical = $('link[rel="non-canonical"], link[rel="canonical"]').first()
  if (nonCanonical.length) {
    nonCanonical.attr("href", scraped.canonical)
  }

  $(".page-header h2").first().text(scraped.title)
  const breadcrumbList = $("ul.breadcrumb").first()
  if (breadcrumbList.length && scraped.breadcrumbs.length) {
    breadcrumbList.empty()
    breadcrumbList.append('<li class="active"><span class="divider icon-location"></span></li>')
    scraped.breadcrumbs.forEach((crumb, index) => {
      const li = $("<li>").attr({
        itemprop: "itemListElement",
        itemscope: "",
        itemtype: "https://schema.org/ListItem",
      })
      if (index === scraped.breadcrumbs.length - 1 && !crumb.href) li.addClass("active")
      if (crumb.href) {
        const a = $("<a>").attr({
          itemprop: "item",
          href: crumb.href,
          class: "pathway",
          "aria-label": crumb.name,
        })
        a.append($("<span>").attr("itemprop", "name").text(crumb.name))
        li.append(a)
        li.append(
          $("<span>")
            .addClass("divider")
            .append(
              $("<img>").attr({ src: "../images/arrow.svg", alt: "", width: "9", height: "9" })
            )
        )
      } else {
        li.append($("<span>").attr("itemprop", "name").text(crumb.name))
      }
      li.append($("<meta>").attr({ itemprop: "position", content: String(index + 1) }))
      breadcrumbList.append(li)
    })
    logEvent(
      telemetry,
      "ok",
      "breadcrumbs",
      `Applied ${scraped.breadcrumbs.length} breadcrumbs (canonical ${scraped.canonical || "n/a"})`
    )
  } else {
    logEvent(telemetry, "warn", "breadcrumbs", "Missing breadcrumb list or scraped crumbs")
  }

  applyPagerLinks($, scraped.pager, telemetry)

  const leftMenuTemplate = $("#sidebar-menu-template").first()
  const leftMenuMount = $("#sidebar-menu-mount").first()
  if (leftMenuTemplate.length && leftMenuMount.length) {
    logEvent(telemetry, "ok", "left-menu", "Using template sidebar menu + mount")
  } else {
    logEvent(telemetry, "warn", "left-menu", "Missing template sidebar nodes (sidebar-menu-template/mount)")
  }

  const aside = $("#aside").first()
  if (!aside.length) {
    logEvent(telemetry, "warn", "right-rail", "Template aside missing; cannot apply r-flyout")
  } else {
    const legacyFlyout = aside.find(".flyout-menu")
    if (legacyFlyout.length) {
      legacyFlyout.remove()
      logEvent(telemetry, "warn", "right-rail-clean", "Removed legacy .flyout-menu in template; using r-flyout prototype")
    }
    const rootLink = aside.find(".r-flyout__link-wrap a").first()
    const desiredHref = (scraped.aside && scraped.aside.rootHref) || ""
    const desiredLabel = (scraped.aside && scraped.aside.rootLabel) || ""
    if (rootLink.length) {
      if (desiredHref) rootLink.attr("href", desiredHref)
      if (desiredLabel) rootLink.text(desiredLabel)
      logEvent(
        telemetry,
        "ok",
        "right-rail",
        desiredHref || desiredLabel ? "Template r-flyout applied with scraped root link" : "Template r-flyout applied (default root link)"
      )
      if (scraped.aside && scraped.aside.hasLegacyFlyout) {
        logEvent(
          telemetry,
          "warn",
          "right-rail-legacy",
          "Legacy flyout detected in source; replaced with template r-flyout"
        )
      }
    } else {
      logEvent(telemetry, "warn", "right-rail", "Template r-flyout root link not found")
    }
  }

  const articleBody = $('[itemprop="articleBody"]').first()
  if (articleBody.length) {
    const introParagraphs = scraped.instructions.split("\n").filter(Boolean)
    articleBody.find("p").slice(0, introParagraphs.length).remove()
    introParagraphs
      .slice()
      .reverse()
      .forEach((text) => articleBody.prepend($("<p>").text(text)))
  }

  const form = $("form.exercise-form").first()
  if (!form.length) throw new Error("Template form not found")
  if (testMode) {
    form.attr("data-exercise-devtools", "auto")
    form.attr("data-test-mode", "true")
  } else {
    form.removeAttr("data-exercise-devtools")
    form.removeAttr("data-test-mode")
  }
  const progress = form.find("[data-exercise-progress]").first()
  if (progress.length) {
    progress.text(`0 of ${scraped.totalQuestions} questions completed.`)
  }

  form.attr(
    "data-storage-key",
    `exercise-${slugify(path.basename(targetPath, path.extname(targetPath)))}`
  )

  form.find(".quest-bg").remove()
  const submitRow = form.find("[data-exercise-submit-row]").first()
  const insertTarget = submitRow.length ? submitRow : form.children().last()
  scraped.questions.forEach((question) => {
    const mergedQuestion = { ...question }
    if (!mergedQuestion.answerUi && normalizedDefaultUi) {
      mergedQuestion.answerUi = normalizedDefaultUi
    }
    const resolvedCount = resolveAnswerFieldCount(mergedQuestion, overrideAnswerFieldCount)
    const questionDom = buildQuestionDom($, mergedQuestion, resolvedCount, testMode, fileName)
    insertTarget.before(questionDom)
  })
  logEvent(telemetry, "ok", "questions", `Injected ${scraped.totalQuestions} questions`)

  const answerKey = createAnswerKey(scraped, overrideAnswerFieldCount, testMode)
  const answerKeyScript = $("#exercise-answer-key")
  if (!answerKeyScript.length) throw new Error("Template answer key script not found")
  answerKeyScript.text(`\n${JSON.stringify(answerKey, null, 2)}\n                `)

  const config = createExerciseConfig(scraped)
  const configScript = $("#exercise-config")
  if (!configScript.length) throw new Error("Template exercise config script not found")
  configScript.text(`\n${JSON.stringify(config, null, 2)}\n                `)

  if (testMode) {
    $(".nn_sliders-body").each((_, el) => {
      const bodyEl = $(el)
      bodyEl.removeClass("collapse")
      bodyEl.attr("aria-hidden", "false")
    })
    $(".nn_sliders-toggle").attr("aria-expanded", "true")
    logEvent(telemetry, "ok", "test-mode", "Devtools/test-mode enabled; accordions opened")
  }

  logEvent(telemetry, "ok", "answer-key", "Answer key + config blocks populated")
  logEvent(telemetry, "ok", "pager/breadcrumbs", "Pager and breadcrumbs wired from scraped data")

  return collapseBooleanAttributes($.html())
}

function collapseBooleanAttributes(html) {
  const booleanAttrs = ["hidden", "nomodule", "defer", "disabled", "required", "novalidate"]
  const pattern = new RegExp(`(^|[^\\w-])(${booleanAttrs.join("|")})=""`, "gi")
  return html.replace(pattern, (match, prefix, attr) => `${prefix}${attr.toLowerCase()}`)
}

function trimTrailingWhitespace(text) {
  return text.replace(/[ \t]+$/gm, "")
}

function backupFile(targetPath) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const backupName = `${path.basename(targetPath)}.bak-${stamp}`
  const backupPath = path.join(path.dirname(targetPath), backupName)
  fs.copyFileSync(targetPath, backupPath)
  return backupPath
}

function showDiff(original, updated) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "legacy-gate-"))
  const beforePath = path.join(tempDir, "before.html")
  const afterPath = path.join(tempDir, "after.html")
  fs.writeFileSync(beforePath, original, "utf8")
  fs.writeFileSync(afterPath, updated, "utf8")
  const result = spawnSync(
    "git",
    ["--no-pager", "diff", "--no-index", "--color=always", beforePath, afterPath],
    {
      encoding: "utf8",
    }
  )
  return result.stdout || result.stderr
}

function validateCounts(scraped, expectedQuestions, answerKey, overrideAnswerFieldCount) {
  if (expectedQuestions && expectedQuestions !== scraped.totalQuestions) {
    throw new Error(
      `Question count mismatch: scraped ${scraped.totalQuestions} vs expected ${expectedQuestions}`
    )
  }
  const answerEntries = Object.keys(answerKey.answerArrays.answerArray || {}).length
  if (answerEntries !== scraped.totalQuestions) {
    throw new Error(
      `Answer key entries (${answerEntries}) do not match question count (${scraped.totalQuestions})`
    )
  }

  scraped.questions.forEach((question, index) => {
    const key = `question${String(index + 1).padStart(2, "0")}`
    const entry = answerKey.answerArrays.answerArray[key]
    if (!entry) {
      throw new Error(`Missing answer key entry for ${key}`)
    }

    const expectedFields = resolveAnswerFieldCount(question, overrideAnswerFieldCount)
    const configuredFields =
      (entry.answersAccepted?.[0] || []).length ||
      (Array.isArray(entry.lengths) && entry.lengths.length ? entry.lengths[0] : 0) ||
      (Number.isInteger(entry.minLength) ? entry.minLength : 0)
    const actualFields = configuredFields || 0
    if (actualFields !== expectedFields) {
      throw new Error(
        `Answer field count mismatch for ${key}: expected ${expectedFields}, found ${actualFields}`
      )
    }
  })
}

function main() {
  const parser = new ArgumentParser({
    description: "Convert legacy accordion HTML into gated exercise template.",
  })
  parser.add_argument("htmlPath", { help: "Path to the legacy HTML file to convert" })
  parser.add_argument("--questions", { type: "int", help: "Override question count validation" })
  parser.add_argument("--answer-fields", {
    type: "int",
    default: null,
    dest: "answerFields",
    help: "Override number of answer input fields per question (defaults to scraped count)",
  })
  parser.add_argument("--answer-ui", {
    default: null,
    dest: "answerUi",
    help: 'Override answer UI for all questions (e.g., "textarea")',
  })
  parser.add_argument("--template", {
    default: path.join(__dirname, "..", "exercise-1-nouns", "111-common-nouns.html"),
    help: "Path to the gated template HTML clone",
  })
  parser.add_argument("--dry-run", {
    action: "store_true",
    help: "Skip writing, only report actions",
  })
  parser.add_argument("--diff-preview", {
    action: "store_true",
    help: "Show git-style diff preview",
  })
  parser.add_argument("--test-mode", {
    action: "store_true",
    help: "Auto-fill answers and bypass accordion gating",
  })

  const args = parser.parse_args()
  const legacyPath = resolvePathMaybe(args.htmlPath)
  const templatePath = resolvePathMaybe(args.template)
  ensureFileExists(legacyPath)
  ensureFileExists(templatePath)

  const legacyHtml = loadHtml(legacyPath)
  const templateHtml = loadHtml(templatePath)
  const telemetry = []
  const scraped = scrapeLegacy(legacyHtml, legacyPath)
  logEvent(
    telemetry,
    "ok",
    "scrape",
    `title="${scraped.title}", canonical="${scraped.canonical}", breadcrumbs=${scraped.breadcrumbs.length}, pagerPrev=${scraped.pager.previous ? "yes" : "no"} (icon=${scraped.pager.previous && scraped.pager.previous.icon ? "yes" : "no"}), pagerNext=${scraped.pager.next ? "yes" : "no"} (icon=${scraped.pager.next && scraped.pager.next.icon ? "yes" : "no"}), questions=${scraped.totalQuestions}`
  )
  const answerKey = createAnswerKey(scraped, args.answerFields, args.test_mode)
  ensureAnswerKeyIsJsonSafe(answerKey)
  validateCounts(scraped, args.questions, answerKey, args.answerFields)
  const updatedHtml = injectTemplate(
    templateHtml,
    scraped,
    args.answerFields,
    args.test_mode,
    legacyPath,
    args.answerUi,
    telemetry
  )
  const cleanedHtml = trimTrailingWhitespace(updatedHtml)

  if (args.diff_preview) {
    const diff = showDiff(legacyHtml, cleanedHtml)
    console.log(diff)
  }

  if (args.dry_run) {
    console.log("[dry-run] conversion complete; no files written")
    printTelemetry(telemetry)
    return
  }

  const backupPath = backupFile(legacyPath)
  fs.writeFileSync(legacyPath, cleanedHtml, "utf8")
  console.log(`Backed up original to ${backupPath}`)
  console.log(`Wrote updated gated exercise to ${legacyPath}`)
  console.log("Shift + Alt + s")
  printTelemetry(telemetry)
}

main()
