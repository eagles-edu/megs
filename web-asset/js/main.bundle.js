/**
 * Main Bundle Loader (Modern Module) - Eagles Club
 * Schedules nav/accordion bundle after load/idle or first interaction.
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
  script.async = true
  if ("fetchPriority" in script) script.fetchPriority = "low"
  script.onload = () => {
    window.__navBundleLoaded = true
    window.__navBundleLoading = false
  }
  script.onerror = () => {
    window.__navBundleLoading = false
  }
  document.head.appendChild(script)
}

const runWhenIdle = (fn, timeoutMs) => {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(fn, { timeout: timeoutMs })
    return
  }
  window.setTimeout(fn, 450)
}

const scheduleNavBundle = () => {
  if (window.__navBundleScheduled) return
  window.__navBundleScheduled = true

  const interactionEvents = ["pointerdown", "keydown", "touchstart"]
  const interactionOptions = { once: true, passive: true }
  let triggered = false

  const onInteraction = () => {
    if (triggered) return
    triggered = true
    for (let i = 0; i < interactionEvents.length; i++) {
      window.removeEventListener(interactionEvents[i], onInteraction, interactionOptions)
    }
    loadNavBundle()
  }

  for (let i = 0; i < interactionEvents.length; i++) {
    window.addEventListener(interactionEvents[i], onInteraction, interactionOptions)
  }

  const scheduleAfterLoad = () => {
    window.setTimeout(() => {
      if (triggered) return
      triggered = true
      runWhenIdle(loadNavBundle, 2000)
    }, 900)
  }

  if (document.readyState === "complete") {
    scheduleAfterLoad()
    return
  }
  window.addEventListener("load", scheduleAfterLoad, { once: true })
}

scheduleNavBundle()
