/**
 * Main Bundle (Legacy ES5) - Eagles Club
 * Fallback for older browsers without ES6 module support
 * Combines: template592f.js + left-menu.js + flyout-menu.js + qa-accordion.js
 */
;(function () {
  'use strict'

  // Utilities
  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn)
    } else {
      fn()
    }
  }

  function forEachNodeList(list, cb) {
    if (!list) return
    if (typeof list.forEach === 'function') {
      list.forEach(cb)
      return
    }
    for (var i = 0; i < list.length; i++) cb(list[i], i)
  }

  function closest(el, selector) {
    if (!el) return null
    if (el.closest) return el.closest(selector)
    var node = el
    while (node && node.nodeType === 1) {
      if (matches(node, selector)) return node
      node = node.parentElement || node.parentNode
    }
    return null
  }

  function matches(el, selector) {
    if (!el) return false
    var fn = el.matches || el.msMatchesSelector || el.webkitMatchesSelector
    if (fn) return fn.call(el, selector)
    var scope =
      el.parentElement || el.parentNode || (typeof document !== 'undefined' ? document : null)
    if (!scope || !scope.querySelectorAll) return false
    var nodelist = scope.querySelectorAll(selector)
    for (var i = 0; i < nodelist.length; i++) if (nodelist[i] === el) return true
    return false
  }

  // Left Menu Module
  function initLeftMenu() {
    var menu = document.getElementById('accordion_menu_90')
    if (!menu) return

    var items = menu.children
    Array.prototype.forEach.call(items, function (li) {
      if (!(li && li.tagName === 'LI')) return
      var wrapper = li.querySelector('.ul-wrapper')
      var btnImg = li.querySelector('.item-wrapper > .menu-button > img')
      if (!wrapper) return

      li.addEventListener('mouseenter', function () {
        li.classList.add('opened')
        wrapper.style.display = 'block'
        if (btnImg) btnImg.src = '../web-asset/icons/svg/minus5.svg'
      })

      li.addEventListener('mouseleave', function () {
        li.classList.remove('opened')
        wrapper.style.display = 'none'
        if (btnImg) btnImg.src = '../web-asset/icons/svg/plus3.svg'
      })
    })
  }

  // Flyout Menu Module
  function initFlyoutMenu() {
    var menus = document.querySelectorAll('ul.flyout-menu')
    if (!menus || !menus.length) return

    Array.prototype.forEach.call(menus, function (menu) {
      if (menu.__flyoutBound) return
      menu.__flyoutBound = true

      menu.addEventListener('click', function (e) {
        var a = e.target && e.target.closest ? e.target.closest('a') : null
        if (!a || !menu.contains(a)) return
        var href = a.getAttribute('href')
        if (!href) return
        e.preventDefault()
        if (a.getAttribute('target') === '_blank') {
          window.open(href)
        } else {
          window.location.href = href
        }
      })

      var lis = menu.querySelectorAll('li')
      Array.prototype.forEach.call(lis, function (li) {
        var wrapper = li.querySelector('.ul-wrapper')
        var btnImg = li.querySelector('.item-wrapper > .menu-button > img')
        if (!wrapper) return

        li.addEventListener('mouseenter', function () {
          li.classList.add('opened')
          wrapper.style.display = 'block'
          if (btnImg) btnImg.src = '../web-asset/icons/svg/minus5.svg'
        })

        li.addEventListener('mouseleave', function () {
          li.classList.remove('opened')
          wrapper.style.display = 'none'
          if (btnImg) btnImg.src = '../web-asset/icons/svg/plus3.svg'
        })
      })
    })
  }

  // QA Accordion Module system
  function initQAAccordion() {
    var content = document.getElementById('content')
    if (!content) return

    var allToggles = content.querySelectorAll('a.accordion-toggle')
    forEachNodeList(allToggles, function (a) {
      var tid = a.getAttribute('data-id')
      if (!tid) {
        var href = a.getAttribute('href') || ''
        var i = href.indexOf('#')
        if (i >= 0) tid = href.slice(i + 1)
      }
      if (tid) {
        a.setAttribute('href', '#' + tid)
        a.setAttribute('aria-controls', tid)
        a.setAttribute('role', 'button')
        a.setAttribute('tabindex', '0')
      }
    })

    forEachNodeList(allToggles, function (a) {
      var tid = a.getAttribute('aria-controls')
      if (!tid) return
      var body = document.getElementById(tid)
      if (!body) return
      var isOpen = body.classList.contains('in') || body.classList.contains('show')
      a.setAttribute('aria-expanded', isOpen ? 'true' : 'false')
      var group = closest(a, '.accordion-group')
      if (group) {
        if (isOpen) group.classList.add('active')
        else group.classList.remove('active')
      }
      if (!isOpen) {
        body.style.height = '0px'
        body.style.overflow = 'hidden'
      }
    })

    function handleToggleClick(ev, explicitToggle) {
      var toggle =
        explicitToggle || (ev && ev.target ? closest(ev.target, 'a.accordion-toggle') : null)
      if (!toggle || !content.contains(toggle)) return
      if (ev) ev.preventDefault()

      var targetId = toggle.getAttribute('data-id')
      if (!targetId) {
        var href = toggle.getAttribute('href') || ''
        var idx = href.indexOf('#')
        if (idx >= 0) targetId = href.slice(idx + 1)
      }
      if (!targetId) return

      var body = document.getElementById(targetId)
      if (!body) {
        var groupFallback = closest(toggle, '.accordion-group')
        if (groupFallback) body = groupFallback.querySelector('.accordion-body')
      }
      if (!body) return

      var group = closest(toggle, '.accordion-group')
      var parentSelector = toggle.getAttribute('data-parent')
      var isOpen = body.classList.contains('in') || body.classList.contains('show')

      if (parentSelector) {
        try {
          var parent = document.querySelector(parentSelector)
          if (parent) {
            var openBodies = parent.querySelectorAll('.accordion-body.in, .accordion-body.show')
            forEachNodeList(openBodies, function (ob) {
              if (ob === body) return
              ob.classList.remove('in')
              ob.classList.remove('show')
              ob.style.height = '0px'
              var og = closest(ob, '.accordion-group')
              if (og) og.classList.remove('active')
              var tgl = og ? og.querySelector('.accordion-heading .accordion-toggle') : null
              if (tgl) tgl.setAttribute('aria-expanded', 'false')
            })
          }
          // eslint-disable-next-line no-empty, no-unused-vars
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

    forEachNodeList(allToggles, function (a) {
      a.addEventListener('click', function (ev) {
        handleToggleClick(ev, a)
      })
    })

    content.addEventListener('click', function (e) {
      handleToggleClick(e, null)
    })

    content.addEventListener('keydown', function (e) {
      var key = e.key || e.code
      if (key !== 'Enter' && key !== ' ' && key !== 'Space') return
      var toggle = e.target ? closest(e.target, 'a.accordion-toggle') : null
      if (!toggle || !content.contains(toggle)) return
      e.preventDefault()
      toggle.click()
    })
  }

  // Mobile Navigation (ES5 compatible)
  function MobileNavigation() {
    this.sidebar = null
    this.toggleButton = null
    this.overlay = null
    this.menuTemplate = null
    this.menuMount = null
    this.isOpen = false
    this.mediaQuery = window.matchMedia('(max-width: 766px)')
    this.init()
  }

  MobileNavigation.prototype.init = function () {
    this.createMobileElements()
    if (!this.sidebar || !this.toggleButton || !this.overlay) return
    document.body.classList.add('mobile-nav-enabled')
    this.bindEvents()
    this.handleResize()
    var self = this
    this.mediaQuery.addListener(function () {
      self.handleResize()
    })
    if (!this.mediaQuery.matches) this.mountMenuIfNeeded()
  }

  MobileNavigation.prototype.createMobileElements = function () {
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

  MobileNavigation.prototype.bindEvents = function () {
    var self = this
    this.toggleButton.addEventListener('click', function (e) {
      e.preventDefault()
      self.toggleMenu()
    })

    this.overlay.addEventListener('click', function () {
      self.closeMenu()
    })

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && self.isOpen) {
        self.closeMenu()
        self.toggleButton.focus()
      }
    })

    this.sidebar.addEventListener('click', function (e) {
      if (self.mediaQuery.matches && e.target.tagName === 'A') {
        window.setTimeout(function () {
          self.closeMenu()
        }, 150)
      }
    })

    window.addEventListener('resize', function () {
      if (!self.mediaQuery.matches && self.isOpen) self.closeMenu()
    })
  }

  MobileNavigation.prototype.toggleMenu = function () {
    this.isOpen ? this.closeMenu() : this.openMenu()
  }

  MobileNavigation.prototype.openMenu = function () {
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
    var firstLink = this.sidebar.querySelector('.accordion-menu a, .flyout-menu a')
    if (firstLink) firstLink.focus()
  }

  MobileNavigation.prototype.closeMenu = function () {
    this.isOpen = false
    document.body.classList.remove('mobile-nav-open')
    this.sidebar.classList.remove('mobile-nav-open')
    this.overlay.classList.remove('active')
    this.overlay.style.display = 'none'
    this.toggleButton.classList.remove('open')
    this.toggleButton.setAttribute('aria-expanded', 'false')
    this.overlay.setAttribute('aria-hidden', 'true')
  }

  MobileNavigation.prototype.handleResize = function () {
    if (!this.mediaQuery.matches && this.isOpen) this.closeMenu()
    if (!this.mediaQuery.matches) this.mountMenuIfNeeded()
  }

  MobileNavigation.prototype.mountMenuIfNeeded = function () {
    if (!this.menuTemplate || !this.menuMount) return
    if (this.menuMount.childNodes && this.menuMount.childNodes.length) return
    try {
      var frag = this.menuTemplate.content
        ? this.menuTemplate.content.cloneNode(true)
        : function () {
            var t = document.createElement('div')
            t.innerHTML = this.menuTemplate.innerHTML
            return t
          }.call(this)
      this.menuMount.appendChild(frag)
      this.menuMount.removeAttribute('aria-hidden')

      var menu = this.menuMount.querySelector('#accordion_menu_90')
      if (menu) {
        Array.prototype.forEach.call(menu.children, function (li) {
          if (!(li && li.tagName === 'LI')) return
          var wrapper = li.querySelector('.ul-wrapper')
          var btnImg = li.querySelector('.item-wrapper > .menu-button > img')
          if (!wrapper) return
          li.addEventListener('mouseenter', function () {
            li.classList.add('opened')
            wrapper.style.display = 'block'
            if (btnImg) btnImg.src = '../web-asset/icons/svg/minus5.svg'
          })
          li.addEventListener('mouseleave', function () {
            li.classList.remove('opened')
            wrapper.style.display = 'none'
            if (btnImg) btnImg.src = '../web-asset/icons/svg/plus3.svg'
          })
        })
      }
      // eslint-disable-next-line no-unused-vars
    } catch (e) {
      // no-op
    }
  }

  // jQuery compatibility
  function initJQueryCompat() {
    if (!window.jQuery) return

    var $ = window.jQuery

    $(document)
      .on('click', '.btn-group label:not(.active)', function () {
        var $label = $(this)
        var $input = $('#' + $label.attr('for'))

        if ($input.prop('checked')) return

        $label
          .closest('.btn-group')
          .find('label')
          .removeClass('active btn-success btn-danger btn-primary')

        var btnClass = 'primary'
        if ($input.val() != '') {
          var reversed = $label.closest('.btn-group').hasClass('btn-group-reversed')
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
  function initApp() {
    try {
      initLeftMenu()
      initFlyoutMenu()
      initQAAccordion()
      new MobileNavigation()
      initJQueryCompat()
      window._qaAccordionBound = true
    } catch (e) {
      // eslint-disable-next-line no-undef
      if (console && console.warn) console.warn('Bundle init error:', e)
    }
  }

  // Run on DOM ready
  ready(initApp)
})()
