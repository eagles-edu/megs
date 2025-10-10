# Printing Large HTML Files in Chunks

Some of the legacy lesson pages in this repository are more than three thousand lines long.
When you need to share their contents in chat or copy them into another document, printing
an entire file at once can overwhelm the interface. Use the following approach to emit the
HTML in two contiguous blocks without any re-encoding.

1. Change into the repository root (`/workspace/megs` in this environment, or your local
   clone's path, for example `cd /path/to/megs`).
2. Run `sed` twice, once for each half of the file. Update the line ranges if the file length
   changes.

```bash
sed -n '1,1581p' exercise-1-nouns/111-common-nouns-codex-copy.html
sed -n '1582,3163p' exercise-1-nouns/111-common-nouns-codex-copy.html
```

The first command prints lines 1 through 1,581 (Part 1). The second command prints lines
1,582 through 3,163 (Part 2). The two outputs are contiguous and together contain the entire
file with no gaps or overlaps. On your local machine the output is streamed directly to the
terminal, so you can copy each half from the console, pipe it through another tool, or
redirect it into files, for example:

```bash
sed -n '1,1581p' exercise-1-nouns/111-common-nouns-codex-copy.html > part1.html
sed -n '1582,3163p' exercise-1-nouns/111-common-nouns-codex-copy.html > part2.html
```

Those `sed` commands read from the checked-out HTML file in your working tree and write the
output (either to the screen or to the files you specify). No additional export step is
required—the “edited printout” comes straight from the file contents that `sed` reads.

If you only need to confirm the total line count before splitting, run:

```bash
wc -l exercise-1-nouns/111-common-nouns-codex-copy.html
```

Adjust the split point accordingly so that both halves remain contiguous.