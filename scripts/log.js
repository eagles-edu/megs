#!/usr/bin/env node
/*
 Appends a timestamped entry to docs/codex-log.md (source of truth).
 Usage:
   npm run log -- "message to append"
   echo "multi-line\nmessage" | npm run log
*/
import fs from 'node:fs';
import path from 'node:path';

const DOC_PATH = path.join(process.cwd(), 'docs', 'codex-log.md');

/** Read message from argv or stdin */
async function readMessage() {
  const argMsg = process.argv.slice(2).join(' ').trim();
  if (argMsg) return argMsg;
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8').trim();
}

function ensureDocsDir() {
  const dir = path.dirname(DOC_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function appendEntry(message) {
  const now = new Date();
  const stamp = now.toISOString();
  const header = `\n\n===== CODEx SESSION START @ ${stamp} =====\n`;
  fs.appendFileSync(DOC_PATH, header + message + '\n');
}

(async () => {
  try {
    ensureDocsDir();
    const msg = await readMessage();
    if (!msg) {
      console.error('No message provided to log.');
      process.exit(1);
    }
    appendEntry(msg);
    console.log(`Appended ${msg.length} chars to docs/codex-log.md`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
