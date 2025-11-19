# sed

## Quick whole-file dumps

```bash
# 1) Print whole file (stdout)
sed -n 'p' tools/expand-questions.mjs

# 2) Save whole file to a temp copy (avoids scrollback limits)
sed -n 'p' tools/expand-questions.mjs > /tmp/expand-questions.full.mjs
```

*Validation:* `wc -l tools/expand-questions.mjs /tmp/expand-questions.full.mjs` should show identical line counts.

### Page by 5,600-line windows (manual calls)

```bash
# page 1
sed -n '5600p' tools/expand-questions.mjs
# page 2
sed -n '5601,11200p' tools/expand-questions.mjs
# page 3 (adjust start if needed)
sed -n '11201,$p' tools/expand-questions.mjs
```

*Validation:* The last page shows `…,$p`; nothing should be skipped or duplicated at the boundaries.

### Auto-page in 5,600-line windows (press Enter between pages)

```bash
file=tools/expand-questions.mjs page=5600
total=$(wc -l < "$file"); start=1
while [ "$start" -le "$total" ]; do
  end=$(( start + page - 1 ))
  [ "$end" -gt "$total" ] && end=$total
  sed -n "${start},${end}p" "$file"
  echo "--- lines ${start}-${end}/${total} ---"
  read -r -p "next? " _
  start=$(( end + 1 ))
done
```

*Validation:* Each page footer shows the exact line range printed; last page ends at `/${total}`.

### From a Git commit/tree (bypasses working tree)

```bash
# Current HEAD, whole file to stdout
git show HEAD:tools/expand-questions.mjs | sed -n 'p'

# Specific ref and page 1
git show main:tools/expand-questions.mjs | sed -n '1,4800p'
```

*Validation:* `git show <ref>:tools/expand-questions.mjs | wc -l` equals the line count you expect.

### If CRLF or odd control chars interfere (optional)

```bash
# Strip trailing CR (Windows newlines) while printing
sed -n -e 's/\r$//' -e 'p' tools/expand-questions.mjs
```

*Validation:* Line count should remain the same; diffs should only show `\r` removals.

If you want this as a reusable function (e.g., `sedpage file 5600`), say the word and I’ll drop it in your `~/.bashrc` with inline comments.
