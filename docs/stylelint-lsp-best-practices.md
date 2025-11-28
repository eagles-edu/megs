# Stylelint VS Code crash & migration guide

This repo uses Stylelint 16 (`package.json` and `.nvmrc` pin Node 20). The log at `docs/extension-output-stylelint.vs.txt` shows two issues:

- Deprecation warnings `[stylelint:002]` and `[stylelint:003]` when using the legacy CommonJS API and the deprecated `output` option (lines 17–21).
- The Stylelint language server repeatedly crashes because it tries to spawn `/usr/share/code/code` and the binary is missing, causing `ENOENT` and `write EPIPE` loops (lines 26–110 and repeats).

Follow the steps below to stop the crash loop and clear the warnings.

## 1) Fix the crash loop (`ENOENT: /usr/share/code/code`)

1. Check where your VS Code CLI actually lives: `command -v code`.
2. If `/usr/share/code/code` does not exist, point the extension to a real binary:
   - Standard VS Code install: `sudo install -d /usr/share/code && sudo ln -sf "$(command -v code)" /usr/share/code/code`.
   - VSCodium: `sudo install -d /usr/share/code && sudo ln -sf "$(command -v codium)" /usr/share/code/code`.
   - If no CLI is present, (re)install VS Code or add the shipped `code` CLI to `PATH`.
3. Restart VS Code after fixing the binary path. The Stylelint server should start once and stay running instead of crashing 5x in 3 minutes.

## 2) Stay on the supported Node version

- This project pins Node `20.19.4` via `.nvmrc` and `engines.node`. The log shows Node 22 was used, which is outside Stylelint’s tested range.
- Use `nvm use` (or let the “auto-nvm” extension switch for you) before launching VS Code/Stylelint.
- If the extension host ignores `nvm`, start VS Code from a terminal that already ran `nvm use 20.19.4` so `process.execPath` and `PATH` point at Node 20.

## 3) Migrate Stylelint config to the v16 ESM API

- Stylelint 16 is ESM-first; the CommonJS API is deprecated. Replace `.stylelintrc.cjs` with an ESM config (for example `stylelint.config.mjs`):

```js
// stylelint.config.mjs
export default {
  extends: ['stylelint-config-standard'],
  ignoreFiles: [
    '**/node_modules/**',
    '**/dist/**',
    '**/sto/**',
    '**/.sto/**',
    '**/._notes/**',
    '.env',
    '**/*.html',
    '**/*.htm',
    '**/*.min.css',
  ],
  rules: {
    'at-rule-empty-line-before': [
      'always',
      { except: ['first-nested'], ignore: ['after-comment'] },
    ],
    'rule-empty-line-before': [
      'always-multi-line',
      { except: ['first-nested'], ignore: ['after-comment', 'inside-block'] },
    ],
    'declaration-block-single-line-max-declarations': 3,
    'selector-class-pattern': null,
    'selector-id-pattern': null,
    'number-max-precision': null,
    'at-rule-no-unknown': null,
    'no-descending-specificity': null,
    'property-disallowed-list': null,
    'declaration-property-value-disallowed-list': null,
    'declaration-block-no-duplicate-properties': [
      true,
      {
        ignoreProperties: ['background', 'color', 'background-color', 'border-color', 'box-shadow'],
      },
    ],
  },
}
```

- Remove any use of the deprecated `output` option in custom scripts; use `formatter` plus `--output-file` (CLI) or handle `results` yourself when using the Node API.
- After migrating, delete the old `.stylelintrc.cjs` to avoid the CJS warning.

## 4) Validate

- Ensure the binary path is fixed: `ls -l /usr/share/code/code` and `code --version`.
- Ensure the right Node is active: `node -v` should print `v20.19.4`.
- Run the workspace lint to confirm Stylelint works without crashes: `npm run lint:css`.

Expected outcome: the Stylelint language server starts cleanly (no crash loop), and the deprecation warnings disappear once the config uses the ESM API and no `output` option is passed.
