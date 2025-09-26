/**
 * Main Bundle (Modern Module) - Eagles Club
 * Combines: template592f.js + left-menu.js + flyout-menu.js + qa-accordion.js
 * Optimized for performance with ES6 modules and reduced bundling overhead
 */

// Utilities
const ready = (fn) => {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn)
  } else {
    fn()
  }
}

const forEachNodeList = (list, cb) => {
  if (!list) return
  if (typeof list.forEach === 'function') {
    list.forEach(cb)
    return
  }
  for (let i = 0; i < list.length; i++) cb(list[i], i)
}

const closest = (el, selector) => {
  if (!el) return null
  if (el.closest) return el.closest(selector)
  let node = el
  while (node && node.nodeType === 1) {
    if (matches(node, selector)) return node
    node = node.parentElement || node.parentNode
  }
  return null
}

const matches = (el, selector) => {
  if (!el) return false
  const fn = el.matches || el.msMatchesSelector || el.webkitMatchesSelector
  if (fn) return fn.call(el, selector)
  const scope =
    el.parentElement || el.parentNode || (typeof document !== 'undefined' ? document : null)
  if (!scope || !scope.querySelectorAll) return false
  const nodelist = scope.querySelectorAll(selector)
  for (let i = 0; i < nodelist.length; i++) if (nodelist[i] === el) return true
  return false
}

// Left Menu Module
const LeftMenu = {
  init() {
    const menu = document.getElementById('accordion_menu_90')
    if (!menu) return

    const items = menu.children
    Array.prototype.forEach.call(items, (li) => {
      if (!(li && li.tagName === 'LI')) return
      const wrapper = li.querySelector('.ul-wrapper')
      const btnImg = li.querySelector('.item-wrapper > .menu-button > img')
      if (!wrapper) return

      li.addEventListener('mouseenter', () => {
        li.classList.add('opened')
        wrapper.style.display = 'block'
        if (btnImg) btnImg.src = "../web-asset/icons/svg/sized/sized/minus5.svg"
      })

      li.addEventListener('mouseleave', () => {
        li.classList.remove('opened')
        wrapper.style.display = 'none'
        if (btnImg) btnImg.src = "../web-asset/icons/svg/sized/plus3.svg"
      })
    })
  },
}

// Flyout Menu Module
const FlyoutMenu = {
  init() {
    const menus = document.querySelectorAll('ul.flyout-menu')
    if (!menus || !menus.length) return

    menus.forEach((menu) => {
      if (menu.__flyoutBound) return
      menu.__flyoutBound = true

      // Navigate on click
      menu.addEventListener('click', (e) => {
        const a = e.target && e.target.closest ? e.target.closest('a') : null
        if (!a || !menu.contains(a)) return
        const href = a.getAttribute('href')
        if (!href) return
        e.preventDefault()
        if (a.getAttribute('target') === '_blank') {
          window.open(href)
        } else {
          window.location.href = href
        }
      })

      // Hover open/close
      menu.querySelectorAll('li').forEach((li) => {
        const wrapper = li.querySelector(':scope > .ul-wrapper')
        const btnImg = li.querySelector(':scope > .item-wrapper > .menu-button > img')
        if (!wrapper) return

        li.addEventListener('mouseenter', () => {
          li.classList.add('opened')
          wrapper.style.display = 'block'
          if (btnImg) btnImg.src = "../web-asset/icons/svg/sized/minus5.svg"
        })

        li.addEventListener('mouseleave', () => {
          li.classList.remove('opened')
          wrapper.style.display = 'none'
          if (btnImg) btnImg.src = "../web-asset/icons/svg/sized/plus3.svg"
        })
      })
    })
  },
}

// QA Accordion Module
const QAAccordion = {
  init() {
    const content = document.getElementById('content')
    if (!content) return

    // Normalize toggle links
    const allToggles = content.querySelectorAll('a.accordion-toggle')
    forEachNodeList(allToggles, (a) => {
      let tid = a.getAttribute('data-id')
      if (!tid) {
        const href = a.getAttribute('href') || ''
        const i = href.indexOf('#')
        if (i >= 0) tid = href.slice(i + 1)
      }
      if (tid) {
        a.setAttribute('href', '#' + tid)
        a.setAttribute('aria-controls', tid)
        a.setAttribute('role', 'button')
        a.setAttribute('tabindex', '0')
      }
    })

    // Initialize current state
    forEachNodeList(allToggles, (a) => {
      const tid = a.getAttribute('aria-controls')
      if (!tid) return
      const body = document.getElementById(tid)
      if (!body) return
      const isOpen = body.classList.contains('in') || body.classList.contains('show')
      a.setAttribute('aria-expanded', isOpen ? 'true' : 'false')
      const group = closest(a, '.accordion-group')
      if (group) {
        if (isOpen) group.classList.add('active')
        else group.classList.remove('active')
      }
      if (!isOpen) {
        body.style.height = '0px'
        body.style.overflow = 'hidden'
      }
    })

    const handleToggleClick = (ev, explicitToggle) => {
      const toggle =
        explicitToggle || (ev && ev.target ? closest(ev.target, 'a.accordion-toggle') : null)
      if (!toggle || !content.contains(toggle)) return
      if (ev) ev.preventDefault()

      let targetId = toggle.getAttribute('data-id')
      if (!targetId) {
        const href = toggle.getAttribute('href') || ''
        const idx = href.indexOf('#')
        if (idx >= 0) targetId = href.slice(idx + 1)
      }
      if (!targetId) return

      let body = document.getElementById(targetId)
      if (!body) {
        const groupFallback = closest(toggle, '.accordion-group')
        if (groupFallback) body = groupFallback.querySelector('.accordion-body')
      }
      if (!body) return

      const group = closest(toggle, '.accordion-group')
      const parentSelector = toggle.getAttribute('data-parent')
      const isOpen = body.classList.contains('in') || body.classList.contains('show')

      if (parentSelector) {
        try {
          const parent = document.querySelector(parentSelector)
          if (parent) {
            const openBodies = parent.querySelectorAll('.accordion-body.in, .accordion-body.show')
            forEachNodeList(openBodies, (ob) => {
              if (ob === body) return
              ob.classList.remove('in')
              ob.classList.remove('show')
              ob.style.height = '0px'
              const og = closest(ob, '.accordion-group')
              if (og) og.classList.remove('active')
              const tgl = og ? og.querySelector('.accordion-heading .accordion-toggle') : null
              if (tgl) tgl.setAttribute('aria-expanded', 'false')
            })
          }
        } catch (_) {}
      }

      if (isOpen) {
        body.classList.remove('in')
        body.classList.remove('show')
        body.style.height = '0px'
        toggle.setAttribute('aria-expanded', 'false')
        if (group) group.classList.remove('active')
      } else {
        body.classList.add('in')
        body.classList.add('show')
        body.style.height = 'auto'
        toggle.setAttribute('aria-expanded', 'true')
        if (group) group.classList.add('active')
      }
    }

    // Event listener
    forEachNodeList(allToggles, (a) => {
      a.addEventListener('click', (ev) => {
        handleToggleClick(ev, a)
      })
    })

    content.addEventListener('click', (e) => {
      handleToggleClick(e, null)
    })

    content.addEventListener('keydown', (e) => {
      const key = e.key || e.code
      if (key !== 'Enter' && key !== ' ' && key !== 'Space') return
      const toggle = e.target ? closest(e.target, 'a.accordion-toggle') : null
      if (!toggle || !content.contains(toggle)) return
      e.preventDefault()
      toggle.click()
    })
  },
}

// Mobile Navigation Module (from template592f.js)
class MobileNavigation {
  constructor() {
    this.sidebar = null
    this.toggleButton = null
    this.overlay = null
    this.menuTemplate = null
    this.menuMount = null
    this.isOpen = false
    this.mediaQuery = window.matchMedia('(max-width: 766px)')
    this.init()
  }

  init() {
    this.createMobileElements()
    if (!this.sidebar || !this.toggleButton || !this.overlay) return
    document.body.classList.add('mobile-nav-enabled')
    this.bindEvents()
    this.handleResize()
    this.mediaQuery.addEventListener('change', () => this.handleResize())
    if (!this.mediaQuery.matches) this.mountMenuIfNeeded()
  }

  createMobileElements() {
    this.sidebar = document.getElementById('sidebar')
    if (!this.sidebar) return
    this.sidebar.setAttribute('role', 'navigation')
    this.sidebar.setAttribute('aria-label', 'Main menu')

    this.menuTemplate = document.getElementById('sidebar-menu-template')
    this.menuMount = document.getElementById('sidebar-menu-mount')

    this.toggleButton = document.querySelector('.mobile-menu-toggle')
    this.overlay = document.querySelector('.mobile-nav-overlay')

    if (!this.toggleButton) {
      this.toggleButton = document.createElement('button')
      this.toggleButton.className = 'mobile-menu-toggle'
      this.toggleButton.setAttribute('aria-label', 'Main menu')
      this.toggleButton.setAttribute('aria-expanded', 'false')
      this.toggleButton.setAttribute('aria-controls', 'sidebar')
      this.toggleButton.setAttribute('aria-haspopup', 'true')
      this.toggleButton.type = 'button'
      document.body.appendChild(this.toggleButton)
    }

    if (!this.overlay) {
      this.overlay = document.createElement('div')
      this.overlay.className = 'mobile-nav-overlay'
      this.overlay.setAttribute('aria-hidden', 'true')
      document.body.appendChild(this.overlay)
    }
  }

  bindEvents() {
    this.toggleButton.addEventListener('click', (e) => {
      e.preventDefault()
      this.toggleMenu()
    })

    this.overlay.addEventListener('click', () => this.closeMenu())

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.closeMenu()
        this.toggleButton.focus()
      }
    })

    this.sidebar.addEventListener('click', (e) => {
      if (this.mediaQuery.matches && e.target.tagName === 'A') {
        window.setTimeout(() => this.closeMenu(), 150)
      }
    })

    window.addEventListener('resize', () => {
      if (!this.mediaQuery.matches && this.isOpen) this.closeMenu()
    })
  }

  toggleMenu() {
    this.isOpen ? this.closeMenu() : this.openMenu()
  }

  openMenu() {
    if (!this.mediaQuery.matches) return
    this.mountMenuIfNeeded()
    this.isOpen = true
    document.body.classList.add('mobile-nav-open')
    this.sidebar.classList.add('mobile-nav-open')
    this.overlay.style.display = 'block'
    this.overlay.classList.add('active')
    this.toggleButton.classList.add('open')
    this.toggleButton.setAttribute('aria-expanded', 'true')
    this.overlay.setAttribute('aria-hidden', 'false')
    const firstLink = this.sidebar.querySelector('.accordion-menu a, .flyout-menu a')
    if (firstLink) firstLink.focus()
  }

  closeMenu() {
    this.isOpen = false
    document.body.classList.remove('mobile-nav-open')
    this.sidebar.classList.remove('mobile-nav-open')
    this.overlay.classList.remove('active')
    this.overlay.style.display = 'none'
    this.toggleButton.classList.remove('open')
    this.toggleButton.setAttribute('aria-expanded', 'false')
    this.overlay.setAttribute('aria-hidden', 'true')
  }

  handleResize() {
    if (!this.mediaQuery.matches && this.isOpen) this.closeMenu()
    if (!this.mediaQuery.matches) this.mountMenuIfNeeded()
  }

  mountMenuIfNeeded() {
    if (!this.menuTemplate || !this.menuMount) return
    if (this.menuMount.childNodes && this.menuMount.childNodes.length) return
    try {
      const frag = this.menuTemplate.content
        ? this.menuTemplate.content.cloneNode(true)
        : (() => {
            const t = document.createElement('div')
            t.innerHTML = this.menuTemplate.innerHTML
            return t
          })()
      this.menuMount.appendChild(frag)
      this.menuMount.removeAttribute('aria-hidden')

      const menu = this.menuMount.querySelector('#accordion_menu_90')
      if (menu) {
        Array.prototype.forEach.call(menu.children, (li) => {
          if (!(li && li.tagName === 'LI')) return
          const wrapper = li.querySelector('.ul-wrapper')
          const btnImg = li.querySelector('.item-wrapper > .menu-button > img')
          if (!wrapper) return
          li.addEventListener('mouseenter', () => {
            li.classList.add('opened')
            wrapper.style.display = 'block'
            if (btnImg) btnImg.src = "../web-asset/icons/svg/sized/minus5.svg"
          })
          li.addEventListener('mouseleave', () => {
            li.classList.remove('opened')
            wrapper.style.display = 'none'
            if (btnImg) btnImg.src = "../web-asset/icons/svg/sized/plus3.svg"
          })
        })
      }
    } catch (e) {
      // no-op
    }
  }
}

// jQuery compatibility layer (condensed from template592f.js)
const jQueryCompatibility = () => {
  if (!window.jQuery) return

  const $ = window.jQuery

  $(document)
    .on('click', '.btn-group label:not(.active)', function () {
      const $label = $(this)
      const $input = $('#' + $label.attr('for'))

      if ($input.prop('checked')) return

      $label
        .closest('.btn-group')
        .find('label')
        .removeClass('active btn-success btn-danger btn-primary')

      let btnClass = 'primary'
      if ($input.val() != '') {
        const reversed = $label.closest('.btn-group').hasClass('btn-group-reversed')
        btnClass = ($input.val() == 0 ? !reversed : reversed) ? 'danger' : 'success'
      }

      $label.addClass('active btn-' + btnClass)
      $input.prop('checked', true).trigger('change')
    })
    .on('click', '#back-top', function (e) {
      e.preventDefault()
      $('html, body').animate({ scrollTop: 0 }, 1000)
    })
}

// Initialize everything
const initApp = () => {
  try {
    LeftMenu.init()
    FlyoutMenu.init()
    QAAccordion.init()
    new MobileNavigation()
    jQueryCompatibility()
    window._qaAccordionBound = true
  } catch (e) {
    console.warn('Bundle init error:', e)
  }
}

// Run on DOM ready
ready(initApp)
