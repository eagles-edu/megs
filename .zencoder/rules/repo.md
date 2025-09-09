---
description: Repository Information Overview
alwaysApply: true
---

# MEGS Educational Web App Information

## Summary
MEGS is an educational web application focused on English language learning and grammar. It provides interactive lessons, exercises, and vocabulary resources for ESL (English as a Second Language) students. The project is a legacy codebase being updated for 2025, with a focus on modern web standards and code quality.

## Structure
- **scripts/**: Contains utility scripts for log management, CSS processing, and startup procedures
- **docs/**: Documentation and logging files
- **modules/**: Application modules
- **templates/**: HTML templates and web fonts
- **images/**: Image assets for the application
- **vocabulary/**: English vocabulary resources and lessons
- **writing/**: Writing lessons and resources
- **exercise-***: Various grammar exercise files and directories
- **lesson-***: Grammar lesson files and directories

## Language & Runtime
**Language**: JavaScript (ES Modules)
**Version**: Node.js 20
**Build System**: npm scripts
**Package Manager**: npm

## Dependencies
**Main Dependencies**:
- archiver: ^7.0.1 (ZIP file creation)
- cheerio: ^1.1.2 (HTML parsing)
- css-declaration-sorter: ^7.2.0 (CSS processing)
- cssnano: ^7.1.1 (CSS minification)
- dotenv: ^17.2.1 (Environment variable management)
- postcss: ^8.5.6 (CSS transformation)

**Development Dependencies**:
- eslint: ^9.33.0 (JavaScript linting)
- prettier: ^3.6.2 (Code formatting)
- html-validate: ^10.0.0 (HTML validation)
- stylelint: ^16.23.1 (CSS linting)

## Build & Installation
```bash
# Install dependencies
npm install

# Start the application
npm start

# Format code
npm run format

# Lint code
npm run lint
```

## Testing
**Linting Commands**:
```bash
# Lint HTML
npm run lint:html

# Lint JavaScript
npm run lint:js

# Lint CSS
npm run lint:css

# Fix issues automatically
npm run lint:js:fix
npm run lint:css:fix
npm run lint:html:fix
```

## Configuration Files
**ESLint**: eslint.config.js (ES Module format)
**HTML Validate**: .htmlvalidate.json
**StyleLint**: .stylelintrc.cjs
**Prettier**: .prettierrc
**Node Version**: .nvmrc (v20)

<!-- Zencoder: Added persistent memory anchor sections for status and decision tracking. Rationale: single always-read source to support agent recall and project continuity. -->

## Current Focus
- [ ] Fill with the primary goal(s) for this sprint/week.

## Next 3 Tasks
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

## Recent Decisions
- Decision: …
  Context: …
  Options: …
  Rationale: …
  Impact: …

## Known Risks
- …

## Versions/Tooling (Snapshot)
- Node: v20
- ESLint: see eslint.config.js
- Stylelint: see .stylelintrc.cjs
- Prettier: see .prettierrc

## Standard Operating Procedures (SOPs)

### CSS Property Organization
**SOP**: Always alphabetize CSS properties within each selector block.

**Rationale**: Alphabetical ordering of CSS properties improves code maintainability, reduces merge conflicts, and enhances readability by providing a consistent, predictable structure.

**Implementation**: When writing or editing CSS files, properties within each selector should be arranged in alphabetical order (A-Z).

**Example**:
```css
.example {
  background-color: #fff;
  border: 1px solid #ccc;
  color: #333;
  display: flex;
  margin: 10px;
  padding: 20px;
  width: 100%;
}
```

## Testing Framework
targetFramework: Playwright

## Open Questions
- …