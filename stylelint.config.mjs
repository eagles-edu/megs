// stylelint.config.mjs
export default {
  extends: ["stylelint-config-standard"],
  ignoreFiles: [
    "**/node_modules/**",
    "**/dist/**",
    "**/sto/**",
    "**/.sto/**",
    "**/._notes/**",
    ".env",
    "**/*.html",
    "**/*.htm",
    "**/*.min.css",
    "web-asset/admin/student-admin.css",
    "web-asset/admin/student-admin.critical.css",
    "web-asset/admin/student-admin.min.css",
    "web-asset/legacy/template592f.css",
  ],
  rules: {
    "at-rule-empty-line-before": [
      "always",
      { except: ["first-nested"], ignore: ["after-comment"] },
    ],
    "rule-empty-line-before": [
      "always-multi-line",
      { except: ["first-nested"], ignore: ["after-comment", "inside-block"] },
    ],
    "declaration-block-single-line-max-declarations": 3,
    "selector-class-pattern": null,
    "selector-id-pattern": null,
    "number-max-precision": null,
    "at-rule-no-unknown": null,
    "no-descending-specificity": null,
    "property-disallowed-list": null,
    "declaration-property-value-disallowed-list": null,
    "declaration-block-no-duplicate-properties": [
      true,
      {
        ignoreProperties: ["background", "color", "background-color", "border-color", "box-shadow"],
      },
    ],
  },
}
