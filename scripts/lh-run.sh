#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   LH_URL=http://127.0.0.1:5500/exercise-1-nouns/111-common-nouns-codex.html ./scripts/lh-run.sh
#   ./scripts/lh-run.sh http://127.0.0.1:5500/exercise-1-nouns/111-common-nouns-codex.html

URL="${1:-${LH_URL:-http://127.0.0.1:8080/exercise-1-nouns/111-common-nouns-codex.html}}"

# Optionally auto-start a local server only for :8080 (safe default)
PORT=8080
if [[ "${URL}" == *":${PORT}"* ]] || [[ "${URL}" == http://127.0.0.1:${PORT}* ]]; then
  if ! lsof -iTCP:${PORT} -sTCP:LISTEN -P -n >/dev/null 2>&1; then
    echo "Starting local server on :${PORT}"
    nohup python3 -m http.server ${PORT} --bind 127.0.0.1 >/tmp/pyserver-${PORT}.log 2>&1 &
    sleep 1
  fi
fi

ts="$(date +%Y%m%d-%H%M%S)"
out_dir="docs"
mkdir -p "${out_dir}"
full_json="${out_dir}/lighthouse-${ts}.json"
slim_json="${out_dir}/lighthouse.json"   # compact report for IDE context
prev_slim_json="${out_dir}/lighthouse.prev.json"

echo "Preflight: checking URL reachability..."
status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "${URL}" || true)
if [[ -z "$status" || "$status" == "000" ]]; then
  echo "ERROR: URL not reachable. Ensure your dev server is running: ${URL}" >&2
  exit 2
fi
echo "HTTP ${status} for ${URL}"

echo "Running Lighthouse for ${URL} (perf preset, mobile form factor)"

# Default Chrome flags; relax cert checks for localhost HTTPS to avoid interstitials
CHROME_FLAGS="${LH_CHROME_FLAGS:-}"
if [[ -z "${CHROME_FLAGS}" ]]; then
  CHROME_FLAGS="--no-first-run --no-default-browser-check --disable-background-networking --disable-extensions"
fi
if [[ "${URL}" =~ ^https://(127\.0\.0\.1|localhost)[:/].* ]]; then
  CHROME_FLAGS+=" --ignore-certificate-errors --allow-insecure-localhost"
fi

npx --yes lighthouse@12.8.1 "${URL}" \
  --preset=perf \
  --form-factor=mobile \
  --no-enable-error-reporting \
  --chrome-flags="${CHROME_FLAGS}" \
  --output=json \
  --output-path="${full_json}"

# Keep the previous slim report for comparison
if [[ -f "${slim_json}" ]]; then
  cp -f "${slim_json}" "${prev_slim_json}"
fi

# Produce a slimmed JSON (vital timings + errors) and diff vs previous
FULL_JSON="${full_json}" \
SLIM_JSON="${slim_json}" \
PREV_SLIM_JSON="${prev_slim_json}" \
node <<'NODE'
const fs = require('fs');

const fullPath = process.env.FULL_JSON;
const slimPath = process.env.SLIM_JSON;
const prevSlimPath = process.env.PREV_SLIM_JSON;

function readJSON(path) {
  try {
    return JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch (e) {
    return null;
  }
}

function pickAudit(report, id) {
  const a = report?.audits?.[id];
  if (!a) return null;
  return {
    score: a.score ?? null,
    numericValue: a.numericValue ?? null,
    displayValue: a.displayValue ?? null,
    unit: a.numericUnit ?? null,
  };
}

const report = readJSON(fullPath);
if (!report) {
  console.error('Failed to read Lighthouse JSON:', fullPath);
  process.exit(2);
}

const slim = {
  lighthouseVersion: report.lighthouseVersion,
  fetchTime: report.fetchTime,
  requestedUrl: report.requestedUrl,
  finalUrl: report.finalUrl,
  environment: {
    hostUserAgent: report.environment?.hostUserAgent ?? null,
    benchmarkIndex: report.environment?.benchmarkIndex ?? null,
  },
  performanceScore: report.categories?.performance?.score ?? null,
  metrics: {
    firstContentfulPaint: pickAudit(report, 'first-contentful-paint'),
    largestContentfulPaint: pickAudit(report, 'largest-contentful-paint'),
    speedIndex: pickAudit(report, 'speed-index'),
    totalBlockingTime: pickAudit(report, 'total-blocking-time'),
    cumulativeLayoutShift: pickAudit(report, 'cumulative-layout-shift'),
    interactive: pickAudit(report, 'interactive'),
    maxPotentialFID: pickAudit(report, 'max-potential-fid'),
  },
  errors: {
    runtimeError: report.runtimeError?.message ?? null,
    runWarnings: report.runWarnings ?? [],
  },
};

// Write compact JSON
fs.writeFileSync(slimPath, JSON.stringify(slim, null, 2));

// Compare with previous slim JSON if present
const prev = readJSON(prevSlimPath);
function metricVal(m) { return m && typeof m.numericValue === 'number' ? m.numericValue : null; }

function fmtMs(n) { return n == null ? 'n/a' : `${Math.round(n)} ms`; }
function fmtUnit(n, unit) {
  if (n == null) return 'n/a';
  if (unit === 'millisecond') return `${Math.round(n)} ms`;
  if (unit === 'unitless') return n.toFixed(3);
  return String(n);
}

function deltaStr(curr, prev, unit) {
  if (curr == null || prev == null) return '';
  const d = curr - prev;
  const sign = d > 0 ? '+' : '';
  if (unit === 'millisecond') return ` (${sign}${Math.round(d)} ms)`;
  if (unit === 'unitless') return ` (${sign}${d.toFixed(3)})`;
  return ` (${sign}${d})`;
}

function logMetric(name, currObj, prevObj) {
  const curr = currObj?.numericValue ?? null;
  const prev = prevObj?.numericValue ?? null;
  const unit = currObj?.unit || prevObj?.unit || null;
  const currStr = fmtUnit(curr, unit);
  const prevStr = fmtUnit(prev, unit);
  const dStr = deltaStr(curr, prev, unit);
  console.log(`- ${name}: ${currStr}${prev != null ? ` (prev ${prevStr})` : ''}${dStr}`);
}

console.log('Lighthouse Summary (compact)');
console.log(`- URL: ${slim.finalUrl || slim.requestedUrl}`);
console.log(`- Fetch: ${slim.fetchTime}`);
console.log(`- Perf Score: ${slim.performanceScore != null ? (slim.performanceScore * 100).toFixed(0) : 'n/a'}`);
console.log('Metrics:');
logMetric('FCP', slim.metrics.firstContentfulPaint, prev?.metrics?.firstContentfulPaint);
logMetric('LCP', slim.metrics.largestContentfulPaint, prev?.metrics?.largestContentfulPaint);
logMetric('Speed Index', slim.metrics.speedIndex, prev?.metrics?.speedIndex);
logMetric('TBT', slim.metrics.totalBlockingTime, prev?.metrics?.totalBlockingTime);
logMetric('CLS', slim.metrics.cumulativeLayoutShift, prev?.metrics?.cumulativeLayoutShift);
logMetric('TTI (Interactive)', slim.metrics.interactive, prev?.metrics?.interactive);
logMetric('Max Potential FID', slim.metrics.maxPotentialFID, prev?.metrics?.maxPotentialFID);

if (slim.errors.runtimeError || (slim.errors.runWarnings && slim.errors.runWarnings.length)) {
  console.log('Warnings/Errors:');
  if (slim.errors.runtimeError) console.log(`- runtimeError: ${slim.errors.runtimeError}`);
  for (const w of slim.errors.runWarnings || []) console.log(`- warn: ${w}`);
}

console.log('Outputs:');
console.log(`- Full: ${fullPath}`);
console.log(`- Slim: ${slimPath}`);
NODE
  \
  FULL_JSON="${full_json}" \
  SLIM_JSON="${slim_json}" \
  PREV_SLIM_JSON="${prev_slim_json}"

echo "Slim report written to ${slim_json}"
echo "Full report archived at ${full_json}"
