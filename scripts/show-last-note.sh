set -euo pipefail

FILE="docs/codex-log.md"

if [[ ! -f "$FILE" ]]; then
  echo "No docs/codex-log.md yet."
  exit 0
fi

mkdir -p tmp
NOTE_TMP="tmp/.lastnote.txt"
TAIL_TMP="tmp/.lasttail.txt"

# Extract the bottom-most CODEx session block (NOTE older format or new SESSION START)
awk '/^===== CODEx (NOTE|SESSION START) @ /{i++} {blk[i]=blk[i] $0 ORS} END{print blk[i]}' "$FILE" > "$NOTE_TMP"

# Get the last 300 lines of the entire file
tail -n 300 "$FILE" > "$TAIL_TMP" || true

note_lines=$(wc -l < "$NOTE_TMP" | tr -d ' ')
tail_lines=$(wc -l < "$TAIL_TMP" | tr -d ' ')

# Output whichever is greater: last 300 lines or the last CODEx date-stamped SESSION
if [[ "$tail_lines" -gt "$note_lines" ]]; then
  cat "$TAIL_TMP"
else
  cat "$NOTE_TMP"
fi
