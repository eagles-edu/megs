#!/usr/bin/env node
import { ArgumentParser } from 'argparse';
import { load } from 'cheerio';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fieldNames = ["answer_01", "answer_02", "answer_03", "answer_04", "answer_05", "answer_06"]

function slugify(value) {
  return (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'question';
}

function loadHtml(targetPath) {
  try {
    return fs.readFileSync(targetPath, 'utf8');
  } catch (error) {
    throw new Error(`Unable to read ${targetPath}: ${error.message}`);
  }
}

function ensureFileExists(targetPath) {
  if (!fs.existsSync(targetPath)) {
    throw new Error(`File not found: ${targetPath}`);
  }
}

function resolvePathMaybe(relativePath) {
  return path.isAbsolute(relativePath)
    ? relativePath
    : path.resolve(process.cwd(), relativePath);
}

function extractInstructions($) {
  const firstAccordion = $('.nn_sliders').first();
  if (!firstAccordion.length) {
    return '';
  }

  const paragraphs = [];
  let cursor = firstAccordion.prev();
  while (cursor && cursor.length) {
    if (cursor[0].tagName === 'p') {
      const text = $(cursor).text().trim();
      if (text) paragraphs.unshift(text);
    }
    cursor = cursor.prev();
  }

  if (paragraphs.length) return paragraphs.join('\n');
  return $('p').slice(0, 3).map((_, el) => $(el).text().trim()).get().filter(Boolean).join('\n');
}

function scrapeBreadcrumbs($) {
  const crumbs = [];
  $('ul.breadcrumb li').each((index, li) => {
    const anchor = $(li).find('a').first();
    const name = anchor.length ? anchor.text().trim() : $(li).text().trim();
    const href = anchor.attr('href') || '';
    if (name) {
      crumbs.push({ name, href, position: index });
    }
  });
  return crumbs;
}

function scrapePager($) {
  const pager = {};
  const prev = $('.pager .previous a').first();
  if (prev.length) {
    pager.previous = {
      href: prev.attr('href') || '',
      label: prev.text().trim() || prev.attr('aria-label') || ''
    };
  }
  const next = $('.pager .next a').first();
  if (next.length) {
    pager.next = {
      href: next.attr('href') || '',
      label: next.text().trim() || next.attr('aria-label') || ''
    };
  }
  return pager;
}

function scrapeQuestions($) {
  const questions = [];
  $('.nn_sliders').each((i, element) => {
    const wrapper = $(element);
    const toggle = wrapper.find('.nn_sliders-toggle').first();
    const body = wrapper.find('.nn_sliders-body').first();
    const number = i + 1;
    const questionText = (toggle.find('.nn_sliders-toggle-inner').text() || toggle.text() || '').trim();
    const ariaControls = toggle.attr('aria-controls') || (toggle.attr('href') || '').replace(/^#/, '');
    const dataId = toggle.attr('data-id') || ariaControls || `q${number}`;
    const dataParent = toggle.attr('data-parent') || '';
    const scrollTarget = wrapper.find('[id^="nn_sliders-scrollto"]').first().attr('id') || '';
    const storageKey = body.attr('id') || ariaControls || dataId;
    const answerFieldCount = wrapper
      .find('.exercise-response-row input, .exercise-response-row textarea, .exercise-response-row select')
      .length || 1;

    if (!questionText) {
      throw new Error(`Missing question text for item ${number}`);
    }

    questions.push({
      number,
      questionText,
      ariaControls,
      dataId,
      dataParent,
      scrollTarget,
      storageKey,
      answerFieldCount
    });
  });
  return questions;
}

function scrapeLegacy(legacyHtml, legacyPath) {
  const $ = load(legacyHtml);
  const title = $('title').first().text().trim();
  const canonical = $('link[rel="canonical"]').attr('href')
    || $('link[rel="non-canonical"]').attr('href')
    || '';
  const breadcrumbs = scrapeBreadcrumbs($);
  const pager = scrapePager($);
  const instructions = extractInstructions($);
  const questions = scrapeQuestions($);

  if (!title) throw new Error('Missing <title> content');
  if (!canonical) throw new Error('Missing canonical or rel="non-canonical" link');
  if (!questions.length) throw new Error('No questions found (expected .nn_sliders elements)');

  return {
    legacyPath,
    title,
    canonical,
    breadcrumbs,
    pager,
    instructions,
    questions,
    totalQuestions: questions.length
  };
}

function buildResponseFields($, number, count, testMode) {
  const row = $('<div>').addClass('exercise-response-row').attr('data-item', String(number));
  const labelPrefix = testMode ? 'Auto-filled' : 'Response';
  for (let i = 0; i < count; i += 1) {
    const name = fieldNames[i] || `field${i + 1}`;
    const label = $('<label>').addClass('exercise-response-field');
    label.append(
      $('<span>')
        .addClass('visually-hidden')
        .text(`${labelPrefix} for item ${number} (${name})`)
    );
    const input = $('<input>')
      .addClass('exercise-response-input')
      .attr({ type: 'text', placeholder: 'Answer', 'data-item': String(number), 'data-field': name });

    if (testMode) {
      input.attr('value', `Answer ${number}.${i + 1}`);
    }
    label.append(input);
    row.append(label);
  }
  return row;
}

function buildQuestionDom($, question, answerFieldCount, testMode, fileName) {
  const questBg = $('<div>').addClass('quest-bg').attr('data-exercise-question', String(question.number));
  const groupId = `set-nn_sliders-${question.number}`;
  const accordion = $('<div>').addClass('nn_sliders accordion panel-group').attr('id', groupId);
  const scrollAnchorId = question.scrollTarget || `nn_sliders-scrollto_${question.number}`;
  accordion.append($('<span>').attr('id', scrollAnchorId).addClass('anchor nn_sliders-scroll'));

  const group = $('<div>').addClass('accordion-group panel nn_sliders-group');
  accordion.append(group);

  const innerScrollId = `${scrollAnchorId}-${slugify(question.questionText)}`;
  group.append($('<span>').attr('id', innerScrollId).addClass('anchor nn_sliders-scroll'));

  const heading = $('<div>').addClass('accordion-heading panel-heading');
  const toggle = $('<a>')
    .addClass('accordion-toggle nn_sliders-toggle')
    .attr({
      href: `${fileName}#${question.ariaControls || question.storageKey}`,
      'aria-label': 'Answer',
      'data-toggle': 'collapse',
      'data-parent': question.dataParent || `#${groupId}`,
      'data-id': question.dataId || question.storageKey || `q${question.number}`,
      'aria-expanded': testMode ? 'true' : 'false'
    });
  if (question.ariaControls) {
    toggle.attr('aria-controls', question.ariaControls);
  }
  toggle.append($('<span>').addClass('nn_sliders-toggle-inner').text(question.questionText));
  heading.append(toggle);
  group.append(heading);

  const bodyId = question.storageKey || question.ariaControls || `q${question.number}`;
  const body = $('<div>')
    .addClass(`accordion-body nn_sliders-body${testMode ? '' : ' collapse'}`)
    .attr({ id: bodyId, 'aria-hidden': testMode ? 'false' : 'true' });
  const inner = $('<div>').addClass('accordion-inner panel-body');
  inner.append($('<h2>').addClass('nn_sliders-title').text(question.questionText));
  inner.append($('<p>').text(question.questionText));
  body.append(inner);
  if (testMode) {
    body.append($('<div>').addClass('accordion-test-mode-note').text('Test mode: accordion open, answers auto-filled.'));
  }
  group.append(body);
  group.append(buildResponseFields($, question.number, answerFieldCount, testMode));

  questBg.append(accordion);
  return questBg;
}

function resolveAnswerFieldCount(question, overrideCount) {
  if (overrideCount && Number.isInteger(overrideCount) && overrideCount > 0) return overrideCount;
  if (question.answerFieldCount && Number.isInteger(question.answerFieldCount) && question.answerFieldCount > 0) {
    return question.answerFieldCount;
  }
  return 1;
}

function createAnswerKey(scraped, overrideAnswerFieldCount) {
  const answerArray = {};
  scraped.questions.forEach((question, index) => {
    const key = `question${String(index + 1).padStart(2, '0')}`;
    const answerCount = resolveAnswerFieldCount(question, overrideAnswerFieldCount);
    answerArray[key] = {
      id: question.dataId || question.storageKey || String(index + 1),
      answersAccepted: Array.from({ length: 1 }, () => Array.from({ length: answerCount }, () => ''))
    };
  });

  return {
    meta: {
      defaultHashAlgorithm: 'fnv1a-64'
    },
    answerArrays: {
      exerciseName: slugify(path.basename(scraped.legacyPath, path.extname(scraped.legacyPath))) || 'exercise',
      totalQuestions: scraped.totalQuestions,
      answerArray
    }
  };
}

function createExerciseConfig(scraped) {
  return {
    title: scraped.title,
    canonical: scraped.canonical,
    totalQuestions: scraped.totalQuestions,
    submitUrl: '',
    recipients: [],
    breadcrumbs: scraped.breadcrumbs,
    pager: scraped.pager
  };
}

function injectTemplate(templateHtml, scraped, overrideAnswerFieldCount, testMode, targetPath) {
  const $ = load(templateHtml, { decodeEntities: false });
  const fileName = path.basename(targetPath);

  $('title').first().text(scraped.title);
  const nonCanonical = $('link[rel="non-canonical"], link[rel="canonical"]').first();
  if (nonCanonical.length) {
    nonCanonical.attr('href', scraped.canonical);
  }

  $('.page-header h2').first().text(scraped.title);
  const breadcrumbList = $('ul.breadcrumb').first();
  if (breadcrumbList.length && scraped.breadcrumbs.length) {
    breadcrumbList.empty();
    breadcrumbList.append('<li class="active"><span class="divider icon-location"></span></li>');
    scraped.breadcrumbs.forEach((crumb, index) => {
      const li = $('<li>').attr({ itemprop: 'itemListElement', itemscope: '', itemtype: 'https://schema.org/ListItem' });
      if (index === scraped.breadcrumbs.length - 1 && !crumb.href) li.addClass('active');
      if (crumb.href) {
        const a = $('<a>').attr({ itemprop: 'item', href: crumb.href, class: 'pathway', 'aria-label': crumb.name });
        a.append($('<span>').attr('itemprop', 'name').text(crumb.name));
        li.append(a);
        li.append(
          $('<span>').addClass('divider').append(
            $('<img>').attr({ src: '../images/arrow.svg', alt: '', width: '9', height: '9' })
          )
        );
      } else {
        li.append($('<span>').attr('itemprop', 'name').text(crumb.name));
      }
      li.append($('<meta>').attr({ itemprop: 'position', content: String(index + 1) }));
      breadcrumbList.append(li);
    });
  }

  const pager = $('.pager');
  if (pager.length) {
    const prev = pager.find('.previous a').first();
    if (prev.length && scraped.pager.previous) {
      prev.attr('href', scraped.pager.previous.href || '#');
      prev.attr('aria-label', scraped.pager.previous.label || 'Previous');
      prev.text(scraped.pager.previous.label || 'Previous');
    }
    const next = pager.find('.next a').first();
    if (next.length && scraped.pager.next) {
      next.attr('href', scraped.pager.next.href || '#');
      next.attr('aria-label', scraped.pager.next.label || 'Next');
      next.text(scraped.pager.next.label || 'Next');
    }
  }

  const articleBody = $('[itemprop="articleBody"]').first();
  if (articleBody.length) {
    const introParagraphs = scraped.instructions.split('\n').filter(Boolean);
    articleBody.find('p').slice(0, introParagraphs.length).remove();
    introParagraphs
      .slice()
      .reverse()
      .forEach((text) => articleBody.prepend($('<p>').text(text)));
  }

  const form = $('form.exercise-form').first();
  if (!form.length) throw new Error('Template form not found');
  if (testMode) {
    form.attr('data-exercise-devtools', 'auto');
    form.attr('data-test-mode', 'true');
  } else {
    form.removeAttr('data-exercise-devtools');
    form.removeAttr('data-test-mode');
  }
  const progress = form.find('[data-exercise-progress]').first();
  if (progress.length) {
    progress.text(`0 of ${scraped.totalQuestions} questions completed.`);
  }

  form.attr('data-storage-key', `exercise-${slugify(path.basename(targetPath, path.extname(targetPath)))}`);

  form.find('.quest-bg').remove();
  const submitRow = form.find('[data-exercise-submit-row]').first();
  const insertTarget = submitRow.length ? submitRow : form.children().last();
  scraped.questions.forEach((question) => {
    const resolvedCount = resolveAnswerFieldCount(question, overrideAnswerFieldCount);
    const questionDom = buildQuestionDom($, question, resolvedCount, testMode, fileName);
    insertTarget.before(questionDom);
  });

  const answerKey = createAnswerKey(scraped, overrideAnswerFieldCount);
  const answerKeyScript = $('#exercise-answer-key');
  if (!answerKeyScript.length) throw new Error('Template answer key script not found');
  answerKeyScript.text(`\n${JSON.stringify(answerKey, null, 2)}\n                `);

  const config = createExerciseConfig(scraped);
  const configScript = $('#exercise-config');
  if (!configScript.length) throw new Error('Template exercise config script not found');
  configScript.text(`\n${JSON.stringify(config, null, 2)}\n                `);

  if (testMode) {
    $('.nn_sliders-body').each((_, el) => {
      const bodyEl = $(el);
      bodyEl.removeClass('collapse');
      bodyEl.attr('aria-hidden', 'false');
    });
    $('.nn_sliders-toggle').attr('aria-expanded', 'true');
  }

  return $.html();
}

function backupFile(targetPath) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupName = `${path.basename(targetPath)}.bak-${stamp}`;
  const backupPath = path.join(path.dirname(targetPath), backupName);
  fs.copyFileSync(targetPath, backupPath);
  return backupPath;
}

function showDiff(original, updated) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'legacy-gate-'));
  const beforePath = path.join(tempDir, 'before.html');
  const afterPath = path.join(tempDir, 'after.html');
  fs.writeFileSync(beforePath, original, 'utf8');
  fs.writeFileSync(afterPath, updated, 'utf8');
  const result = spawnSync('git', ['--no-pager', 'diff', '--no-index', '--color=always', beforePath, afterPath], {
    encoding: 'utf8'
  });
  return result.stdout || result.stderr;
}

function validateCounts(scraped, expectedQuestions, answerKey, overrideAnswerFieldCount) {
  if (expectedQuestions && expectedQuestions !== scraped.totalQuestions) {
    throw new Error(`Question count mismatch: scraped ${scraped.totalQuestions} vs expected ${expectedQuestions}`);
  }
  const answerEntries = Object.keys(answerKey.answerArrays.answerArray || {}).length;
  if (answerEntries !== scraped.totalQuestions) {
    throw new Error(`Answer key entries (${answerEntries}) do not match question count (${scraped.totalQuestions})`);
  }

  scraped.questions.forEach((question, index) => {
    const key = `question${String(index + 1).padStart(2, '0')}`;
    const entry = answerKey.answerArrays.answerArray[key];
    if (!entry) {
      throw new Error(`Missing answer key entry for ${key}`);
    }
    const expectedFields = resolveAnswerFieldCount(question, overrideAnswerFieldCount);
    const actualFields = (entry.answersAccepted?.[0] || []).length;
    if (actualFields !== expectedFields) {
      throw new Error(
        `Answer field count mismatch for ${key}: expected ${expectedFields}, found ${actualFields}`
      );
    }
  });
}

function main() {
  const parser = new ArgumentParser({
    description: 'Convert legacy accordion HTML into gated exercise template.'
  });
  parser.add_argument('htmlPath', { help: 'Path to the legacy HTML file to convert' });
  parser.add_argument('--questions', { type: 'int', help: 'Override question count validation' });
  parser.add_argument('--answer-fields', {
    type: 'int',
    default: null,
    dest: 'answerFields',
    help: 'Override number of answer input fields per question (defaults to scraped count)'
  });
  parser.add_argument('--template', {
    default: path.join(__dirname, '..', 'exercise-1-nouns', '111-common-nouns.html'),
    help: 'Path to the gated template HTML clone'
  });
  parser.add_argument('--dry-run', { action: 'store_true', help: 'Skip writing, only report actions' });
  parser.add_argument('--diff-preview', { action: 'store_true', help: 'Show git-style diff preview' });
  parser.add_argument('--test-mode', { action: 'store_true', help: 'Auto-fill answers and bypass accordion gating' });

  const args = parser.parse_args();
  const legacyPath = resolvePathMaybe(args.htmlPath);
  const templatePath = resolvePathMaybe(args.template);
  ensureFileExists(legacyPath);
  ensureFileExists(templatePath);

  const legacyHtml = loadHtml(legacyPath);
  const templateHtml = loadHtml(templatePath);
  const scraped = scrapeLegacy(legacyHtml, legacyPath);
  const answerKey = createAnswerKey(scraped, args.answerFields);
  validateCounts(scraped, args.questions, answerKey, args.answerFields);
  const updatedHtml = injectTemplate(templateHtml, scraped, args.answerFields, args.test_mode, legacyPath);

  if (args.diff_preview) {
    const diff = showDiff(legacyHtml, updatedHtml);
    console.log(diff);
  }

  if (args.dry_run) {
    console.log('[dry-run] conversion complete; no files written');
    return;
  }

  const backupPath = backupFile(legacyPath);
  fs.writeFileSync(legacyPath, updatedHtml, 'utf8');
  console.log(`Backed up original to ${backupPath}`);
  console.log(`Wrote updated gated exercise to ${legacyPath}`);
}

main();
