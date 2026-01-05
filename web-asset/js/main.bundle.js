/**
 * Main Bundle Loader (Modern Module) - Eagles Club
 * Defers nav/accordion bundle loading until after LCP to reduce render delay.
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

const afterLCP = (cb) => {
  let done = false
  const runOnce = () => {
    if (done) return
    done = true
    cb()
  }

  const fallbackToLoad = () => {
    if (document.readyState === "complete") runOnce()
    else window.addEventListener("load", runOnce, { once: true })
  }

  if (!("PerformanceObserver" in window)) {
    fallbackToLoad()
    return
  }

  const supportsLCP =
    Array.isArray(PerformanceObserver.supportedEntryTypes) &&
    PerformanceObserver.supportedEntryTypes.indexOf("largest-contentful-paint") !== -1
  if (!supportsLCP) {
    fallbackToLoad()
    return
  }

  let observer
  try {
    observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      if (entries && entries.length) {
        observer.disconnect()
        runOnce()
      }
    })
    observer.observe({ type: "largest-contentful-paint", buffered: true })
  } catch (e) {
    void e
    fallbackToLoad()
    return
  }

  const runIfLCP = () => {
    if (done) return
    if (!observer || typeof observer.takeRecords !== "function") return
    const entries = observer.takeRecords()
    if (entries && entries.length) {
      observer.disconnect()
      runOnce()
    }
  }
  window.addEventListener("load", runIfLCP, { once: true })
}

afterLCP(loadNavBundle)
