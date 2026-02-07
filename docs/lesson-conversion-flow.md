# Lesson Conversion Flow

This diagram shows the CLI assistant flow plus the core converter pipeline.

```mermaid
flowchart TD
  subgraph Assistant[tools/lesson-conversion-assistant.mjs]
    A1[Start] --> A2[Parse args / prompt for target, prototype, diff preview]
    A2 --> A3[Resolve target + prototype paths]
    A3 --> A4[Print settings + command]
    A4 --> A5{Continue?}
    A5 -- Q --> A6[Exit]
    A5 -- Enter --> A7[Run convert-legacy-lesson]
  end

  subgraph Converter[js/convert-legacy-lesson.mjs]
    B1[Load legacy + prototype HTML] --> B2[Extract headline, breadcrumbs, pager, body]
    B2 --> B3[Build allowed class set from prototype CSS/template]
    B3 --> B4[Normalize body: remove inline styles, drop orphan classes]
    B4 --> B5[Update title/headline, breadcrumbs, pager]
    B5 --> B6[Replace prototype article body with normalized content]
    B6 --> B7{diff preview?}
    B7 -- yes --> B8[Show diff + summary]
    B7 -- no --> B9[Backup + write file + summary]
  end

  A7 --> B1
```

Notes:
- Diff preview is enabled by default; use `--no-diff-preview` to write changes.
- Normalization removes inline `style` attributes and class tokens not present in prototype CSS/template.
- Deployment context: domain root `/`.
