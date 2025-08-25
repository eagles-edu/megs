module.exports = {
  extends: ['stylelint-config-standard'],
  ignoreFiles: ['**/node_modules/**', '**/dist/**', '**/sto/**', '**/.sto/**'],
  rules: {
    /* Keep stylistic overlap with Prettier low; Prettier formats, this validates */
    'color-hex-length': 'short', // example non-formatting rule you may like
    // add or relax rules here as you prefer
    'at-rule-empty-line-before': [
      'always',
      { except: ['first-nested'], ignore: ['after-comment'] },
    ],
    'declaration-block-single-line-max-declarations': 3,
    'selector-class-pattern': '^[a-z0-9]+([_-][a-z0-9]+)*$',
    // allow kebab_case and kebab-case
  },
}

// This config is designed to be used with Stylelint
// It provides a base configuration that includes standard rules for CSS and Prettier integration.
// The rules are configured to be less strict, allowing for a more flexible coding style while still catching common issues like invalid properties and values.
// The configuration is modular, allowing for easy extension or modification as needed.
