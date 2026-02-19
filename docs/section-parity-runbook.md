# Section Parity Runbook

Use this to apply the same parity upgrade workflow across a section (shell, breadcrumbs, right-flyout formatting).

## Tool

`tools/upgrade-section-parity.mjs`

## What it does

1. Transplants the shell block from a prototype page:
   - from the favicon link through `<!-- End Sidebar -->`
   - auto-rebases relative `href`/`src` paths per target depth
2. Normalizes breadcrumbs:
   - ensures `breadcrumbs-top` + `breadcrumbs-bottom` wrappers
   - updates active breadcrumb to match `<h2 itemprop="headline">`
   - replaces legacy breadcrumb divider image arrows with inline SVG
3. Formats the right flyout nav block:
   - reflows `<nav class="r-flyout-nav">...</nav>` using Prettier for readable diffs

## Usage

Dry run:

```bash
node tools/upgrade-section-parity.mjs \
  --prototype writing/1-what-is-a-sentence.html \
  --targets-file /tmp/writing-parity-targets.txt
```

Apply:

```bash
node tools/upgrade-section-parity.mjs \
  --prototype writing/1-what-is-a-sentence.html \
  --targets-file /tmp/writing-parity-targets.txt \
  --write
```

## Build target lists

Writing:

```bash
{ printf "writing.html\nwriting-paragraph.html\nwriting-resources.html\n"; rg --files writing -g '*.html' | sort; } > /tmp/writing-parity-targets.txt
```

Vocabulary:

```bash
{ printf "vocabulary.html\n"; rg --files vocabulary -g '*.html' | sort; } > /tmp/vocabulary-parity-targets.txt
```

Sentences (verb+prep lists):

```bash
rg --files list-11-prepositions/sentences-examples -g '*.html' | sort > /tmp/sentences-parity-targets.txt
```

## Verification

1. Structure checks (2 breadcrumbs + 2 pagers expected for lesson/list/static pages with pager flow):

```bash
FILES="$(cat /tmp/writing-parity-targets.txt | tr '\n' ' ')"
for f in $FILES; do
  top=$(rg -c 'aria-label="breadcrumbs-top"' "$f" || true)
  bot=$(rg -c 'aria-label="breadcrumbs-bottom"' "$f" || true)
  pag=$(rg -c '<ul class="pager pagenav">' "$f" || true)
  echo "$f|top=$top|bottom=$bot|pager=$pag"
done
```

2. Legacy breadcrumb divider image removal:

```bash
FILES="$(cat /tmp/writing-parity-targets.txt | tr '\n' ' ')"
rg -n 'media/system/images/arrow\.png|images/arrow\.svg' $FILES
```

3. Prototype behavior check:

```bash
npm run verify:prototype
```

## Safety

Before running `--write`:

1. Create timestamped `.BAK-<YYYYmmdd-HHMMSS>` copies of targets.
2. Capture undo patch:

```bash
git diff -- $(cat /tmp/writing-parity-targets.txt | tr '\n' ' ') > /tmp/codex-undo-<timestamp>.patch
```
