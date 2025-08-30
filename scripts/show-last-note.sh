set -euo pipefail

FILE="docs/codex-working.txt"

if [[ ! -f "$FILE" ]]; then
  echo "No docs/codex-working.txt yet."
  exit 0
fi

mkdir -p tmp
NOTE_TMP="tmp/.lastnote.txt"
TAIL_TMP="tmp/.lasttail.txt"

# Extract the bottom-most CODEx NOTE block (append lines per block)
awk '/^===== CODEx NOTE @ /{i++} {blk[i]=blk[i] $0 ORS} END{print blk[i]}' "$FILE" > "$NOTE_TMP"

# Get the last 200 lines of the entire file
tail -n 200 "$FILE" > "$TAIL_TMP" || true

note_lines=$(wc -l < "$NOTE_TMP" | tr -d ' ')
tail_lines=$(wc -l < "$TAIL_TMP" | tr -d ' ')

# Output whichever is longer: last 200 lines or the last CODEx entry
if [[ "$tail_lines" -gt "$note_lines" ]]; then
  cat "$TAIL_TMP"
else
  cat "$NOTE_TMP"
fi
