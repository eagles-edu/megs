module.exports = {
  extends: ['stylelint-config-standard'],
  ignoreFiles: [
    '**/node_modules/**',
    '**/dist/**',
    '**/sto/**',
    '**/.sto/**',
    '**/._notes/**',
    '.env',
    '**/*.html',
    '**/*.htm'
  ],
  rules: {
    /* Keep stylistic overlap with Prettier low; Prettier formats, this validates */
    //'color-hex-length': 'null', // example non-formatting rule you may like
    // add or relax rules here as you prefer
    'at-rule-empty-line-before': [
      'always',
      { except: ['first-nested'], ignore: ['after-comment'] },
    ],
    'declaration-block-single-line-max-declarations': 3,
    // Turn off class/id naming convention linting (kebab/snake/camel, etc.) — project policy: NO KEBAB-CASE ENFORCEMENT
    'selector-class-pattern': null,
    'selector-id-pattern': null,
    // Allow for higher precision numbers
    'number-max-precision': null,
    'at-rule-no-unknown': null,
    'no-descending-specificity': null,
    'property-disallowed-list': null,
    'declaration-property-value-disallowed-list': null,
    'declaration-block-no-duplicate-properties': [
      true,
      {
        ignoreProperties: ['background', 'color', 'background-color', 'border-color', 'box-shadow']
      }
    ]
  },
}

// This config is designed to be used with Stylelint
// It provides a base configuration that includes standard rules for CSS and Prettier integration.
// The rules are configured to be less strict, allowing for a more flexible coding style while still catching common issues like invalid properties and values.
// The configuration is modular, allowing for easy extension or modification as needed.
