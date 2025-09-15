# CSS Bootstrap & Delivery Guide

This project ships legacy pages that lean on `web-asset/css/base.css` as the single source of truth for variables, typography, and layout primitives. To keep first paint snappy without layout shifts, every page should follow the pattern below.

## Load `base.css` with preload + print-swap

1. **Preload the file.**
   ```html
   <link
     rel="preload"
     href="/web-asset/css/base.css"
     as="style"
     onload="this.onload=null;this.rel='stylesheet'"
   />
   ```
   * `rel="preload"` raises the priority of `base.css`, so it is fetched alongside the HTML instead of waiting behind render-blocking styles.
   * The `onload` handler flips the relationship to an ordinary stylesheet after the bytes arrive. Browsers reuse the preloaded response, so `base.css` is only fetched once.

2. **Provide the print-media fallback.**
   ```html
   <link
     rel="stylesheet"
     href="/web-asset/css/base.css"
     media="print"
     onload="this.media='all'"
   />
   ```
   * `media="print"` keeps the request render-non-blocking for modern browsers while still triggering a fetch.
   * Swapping to `media='all'` in `onload` lets the stylesheet take effect as soon as it finishes downloading.
   * Older browsers that do not support `rel="preload"` ignore the first tag; the print-swap link ensures they still load `base.css` exactly once.

3. **Leave a `<noscript>` fallback.**
   ```html
   <noscript><link rel="stylesheet" href="/web-asset/css/base.css" /></noscript>
   ```
   Users that disable JavaScript still need deterministic styling and layout.

## Inline the critical grid + mobile navigation shell

`base.css` establishes the responsive grid (`.row-fluid` & span classes) and the mobile navigation affordance (`.mobile-menu-toggle`). Because we defer the full file, each page must inline just enough CSS to keep those elements from flashing unstyled content (FOUC) and to preserve **CLS = 0** during the swap.

Guidelines:

- Inline the theme tokens (a trimmed `:root { … }` block) so that variables referenced by the critical rules resolve before `base.css` loads.
- Add a short `<style>` block that:
  - sets `.row-fluid` to `display: flex` with `flex-wrap: wrap`,
  - gives each `[class*='span']` a `flex` + `max-width` fallback, and
  - defines the mobile toggle button shape/positioning used on narrow screens.
- Include any tiny helpers that prevent jumps (e.g., fixed icon sizes for nav links) but resist pasting entire legacy stylesheets inline.

## Recommended `<head>` snippet

```html
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />

  <!-- Minimal theme tokens so var() lookups do not flash -->
  <style id="theme-vars-critical">
    :root {
      --primary-color: #e0162b;
      --secondary-color: #f5f8ff;
      --text-color: #212121;
      --icon-slot: 1.25em;
      --icon-gap: 8px;
    }
  </style>

  <!-- Critical layout shell for grid + mobile nav -->
  <style id="critical-inline">
    .row-fluid {
      display: flex;
      flex-wrap: wrap;
      margin-inline: -8px;
    }
    .row-fluid > [class*='span'] {
      box-sizing: border-box;
      flex: 0 0 100%;
      max-width: 100%;
      padding-inline: 8px;
    }
    @media (max-width: 767px) {
      .mobile-menu-toggle {
        position: fixed;
        top: 12px;
        right: 12px;
        width: 40px;
        height: 40px;
        border-radius: 4px;
        background: var(--primary-color);
        border: 1px solid var(--primary-color);
        z-index: 1200;
      }
    }
  </style>

  <!-- Async base stylesheet: preload + print media swap -->
  <link
    rel="preload"
    href="/web-asset/css/base.css"
    as="style"
    onload="this.onload=null;this.rel='stylesheet'"
  />
  <link
    rel="stylesheet"
    href="/web-asset/css/base.css"
    media="print"
    onload="this.media='all'"
  />
  <noscript><link rel="stylesheet" href="/web-asset/css/base.css" /></noscript>
</head>
```

Following this recipe keeps the shared theme in one place, avoids flashes while the async stylesheet streams in, and maintains a zero layout shift budget across the catalog of legacy pages.
