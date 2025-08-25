# CONTINUE.md

## 1. Project Overview

**Description:**
This project is focused on English grammar and language learning, providing grammar lessons, exercises, vocabulary lists, and interactive resources for ESL learners. It is structured with many organized HTML files, and uses modern tools to maintain code quality and formatting.

**Key Technologies:**
- HTML (primary site content)
- JavaScript (utility and enhancement scripts)
- CSS (site design)
- Node.js (for formatting, linting, and validation tooling)
- Stylelint, ESLint, Prettier, HTML-Validate (tooling)

**Architecture:**
- Static site with modular HTML files.
- Node.js tooling for code quality.
- Organized by content type (lessons, exercises, lists, templates, modules, media).

---

## 2. Getting Started

**Prerequisites:**
- Node.js v20.x (see `package.json`)
- npm (Node Package Manager)

**Installation:**
1. Clone the repository: `git clone <repo_url>`
2. Install dependencies: `npm install`

**Basic Usage:**
- To view or edit content, open the HTML files directly or use VS Code with Live Server.
- For development and quality checks, use the npm scripts provided.

**Running Tests & Validation:**
- Format all code: `npm run format`
- Format only HTML: `npm run fmt:html`
- Lint HTML: `npm run lint:html`
- Lint JS: `npm run lint:js` / with fixes: `npm run lint:js:fix`
- Lint CSS: `npm run lint:css` / with fixes: `npm run lint:css:fix`

---

## 3. Project Structure

- **Root**: Global configuration and documentation files, scripts, and central HTML files
- **lesson-*/exercise-*/list-***: Main content directories for lessons, exercises, and vocabulary lists
- **media/**: Images, CSS, JS used throughout the site
- **modules/**, **templates/**: Reusable front-end components
- **schemas/**: JSON schemas for validation
- **scripts/**: Utility scripts for extraction, automation, etc.

**Key Files:**
- `README.md`: Quick reference for dev commands
- `package.json`: Node/NPM metadata and scripts
- `.htmlvalidate.json`, `.stylelintrc.cjs`, `eslint.config.js`, `.prettierrc`: Linting/formatting rules
- `index.html`: Likely main entry point

---

## 4. Development Workflow

**Standards/Conventions:**
- Use Prettier for formatting (automated via `npm run format`)
- Lint regularly with provided npm scripts
- Follow JS/HTML/CSS best practices as supported by linter configurations

**Testing:**
- No automated tests (unit/integration) found; validity is via linting and formatting
- Run lint/format scripts before commits

**Build/Deploy:**
- No custom build; static HTML/CSS/JS
- Serve via any static file server (e.g. VS Code Live Server)

**Contributing:**
- Run format and lint scripts before submitting changes
- Follow standard HTML/CSS/JS style and structure
- Update/add documentation as files or lessons are added

---

## 5. Key Concepts

**Domain Terminology:**
- ESL (English as a Second Language)
- Lesson/Exercise/Module: Distinct content blocks for learning

**Core Abstractions:**
- Lessons: Thematic grammar explanations/examples
- Exercises: Interactive/practice questions
- Lists: Vocabulary and reference info

**Design Patterns:**
- Modular, reusable static site structure

---

## 6. Common Tasks

**Adding New Content:**
1. Copy or create a new HTML file in the relevant directory (e.g. a new lesson/exercise)
2. Use existing files as a template for structure and style
3. Link media/assets from `/media` or `/images`
4. Ensure proper structure (heading, instructions, questions/answers where needed)
5. Run lint/format scripts

**Editing/Updating Existing Content:**
- Open and edit HTML directly; follow structure of similar files
- Validate with format/lint scripts

---

## 7. Troubleshooting

**Common Issues:**
- Node version mismatch: Use Node v20.x
- Lint errors: Run the appropriate npm script (see errors in terminal or VS Code Problems panel)
- Live Server errors: Make sure the extension is installed, or remove setting from `.vscode/settings.json`

**Debugging:**
- Use lint/format scripts to pinpoint common structural or formatting errors
- For advanced HTML/CSS/JS debugging, use browser developer tools

---

## 8. References

- [Project README.md](../README.md)
- [Prettier documentation](https://prettier.io/docs/en/index.html)
- [ESLint documentation](https://eslint.org/docs/latest/)
- [Stylelint documentation](https://stylelint.io/)
- [HTML-Validate documentation](https://html-validate.org/)
- [Node.js documentation](https://nodejs.org/en/docs)

---

> _Some assumptions (e.g. deployment, automated testing) are made for static projects; verify and customize as your project evolves._
