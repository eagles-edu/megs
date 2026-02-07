/**
 * Main Bundle Loader (Modern Module) - Eagles Club
 * Loads nav/accordion bundle early to avoid post-paint layout shifts.
 */

const resolveNavBundleSrc = () => {
  const scripts = document.getElementsByTagName("script")
  for (let i = scripts.length - 1; i >= 0; i--) {
    const srcAttr = scripts[i].getAttribute("src") || ""
    if (!srcAttr) continue
    if (srcAttr.indexOf("main.bundle.js") === -1) continue
    const absolute = scripts[i].src || srcAttr
    return absolute.replace(/main\.bundle\.js(?:\?.*)?$/, "main.nav.bundle.js")
  }
  return ""
}

const loadNavBundle = () => {
  if (window.__navBundleLoading || window.__navBundleLoaded) return
  const src = resolveNavBundleSrc()
  if (!src) return
  window.__navBundleLoading = true
  const script = document.createElement("script")
  script.type = "module"
  script.src = src
  script.onload = () => {
    window.__navBundleLoaded = true
  }
  script.onerror = () => {
    window.__navBundleLoading = false
  }
  document.head.appendChild(script)
}

const scheduleNavBundle = () => {
  const run = () => {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(loadNavBundle, { timeout: 250 })
      return
    }
    window.setTimeout(loadNavBundle, 0)
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true })
    return
  }

  run()
}

scheduleNavBundle()
