# Node 24.21.0 runtime alignment and legacy Node 20 migration assessment

## Assessment

Node 24.21.0 is now the repository runtime baseline. Node 20 references below are retained only where they describe the historical migration evidence. Node 24 has the longer support window, through April 2028; Node 22 ends April 2027. Node release schedule
Target	Risk	Recommendation
Node 22	Low–medium	Safe compatibility target
Node 24.21.0	Medium	Current production baseline
Legacy Node 20	High	Historical baseline; do not use for current work

Repository findings
.nvmrc pins 24.21.0.
package.json and package-lock.json require the exact engine 24.21.0.
GitHub Actions reads .nvmrc, so CI will follow the upgrade automatically.
Prisma 7.5 supports Node ^20.19 || ^22.12 || >=24.0. Prisma system requirements
No usage was found of the major removed APIs relevant to this codebase, such as crypto.createCipher(), process.assert, tls.createSecurePair(), or url.parse().
Validation performed
Both Node 22.22.1 and 24.18.0 passed:
Clean dependency installation
Prisma client generation
JavaScript lint
CSS/HTML/full lint on Node 24
Prototype verification
Repository test command, though it currently discovers 0 tests
The main remaining uncertainty is production behavior: database, Redis, SMTP, browser/smoke flows, and deployment infrastructure were not exercised.
Main risks
Node 22 removes import assertions and legacy crypto cipher helpers. Node 20 → 22 migration guide

Node 24 includes OpenSSL 3.5 and stricter security defaults. Old RSA/DH keys, weak ciphers, or legacy TLS integrations could fail. Node 22 → 24 migration guide

Node 24 upgrades npm to the npm 11 line. `package.json` now records approvals for `@prisma/engines@7.10.0`, `prisma@7.10.0`, and `puppeteer@2.1.1`; validate the clean install and policy in CI.

The old transitive puppeteer@2.1.1 package is deprecated. It did not block either runtime, but it increases install/browser-test risk.

Repository baseline
Use Node 24.21.0 as the production and default CI baseline. Keep Node 22 only as an explicit compatibility matrix entry if required:
"engines": {
  "node": "24.21.0"
}
The `.nvmrc`, package manifests, and CI configuration are aligned to Node 24.21.0. Run:
npm ci
npm run db:generate
npm run lint
npm run verify:prototype
npm run smoke:pages
real Prisma/Redis/SMTP integration checks
browser tests with Puppeteer enabled
No repository files were changed during this assessment; the existing dirty worktree was preserved.
