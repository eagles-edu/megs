/**
 * @package     Joomla.Site
 * @subpackage  Templates.protostar
 * @copyright   Copyright (C) 2005 - 2018 Open Source Matters, Inc. All rights reserved.
 * @license     GNU General Public License version 2 or later; see LICENSE.txt
 * @since       3.2
 */

if (window.jQuery) jQuery(function ($) {
  'use strict'

  $(document)
    .on('click', '.btn-group label:not(.active)', function () {
      var $label = $(this)
      var $input = $('#' + $label.attr('for'))

      if ($input.prop('checked')) {
        return
      }

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
    .on('subform-row-add', initButtonGroup)
    .on('subform-row-add', initTooltip)

  initButtonGroup()
  initTooltip()

  // Ensure flyout menus (right sidebar) expand on hover even when
  // page-level inline scripts ran before jQuery was available (defer).
  function initFlyoutMenus() {
    $('ul.flyout-menu').each(function () {
      var $menu = $(this)
      if ($menu.data('cinchFlyoutBound')) return
      $menu.data('cinchFlyoutBound', true)

      // Navigate on click, preserving target behavior
      $menu.find('a').on('click.cinch', function (e) {
        e.preventDefault()
        var $a = $(this)
        if ($a.attr('target') === '_blank') {
          window.open($a.attr('href'))
        } else {
          window.location.assign($a.attr('href'))
        }
      })

      // Hover handlers for showing/hiding submenus
      $menu
        .find('li')
        .on('mouseenter.cinch', function () {
          var $li = $(this)
          $li.addClass('opened')
          $li.children('.ul-wrapper').stop(true, true).slideDown(300)
        })
        .on('mouseleave.cinch', function () {
          var $li = $(this)
          $li.removeClass('opened')
          $li.children('.ul-wrapper').stop(true, true).slideUp(300)
        })
    })
  }

  // Run once on ready
  initFlyoutMenus()

  // Ensure left accordion menu expands on hover and navigates on click
  function initAccordionMenus() {
    $('ul.accordion-menu').each(function () {
      var $menu = $(this)
      if ($menu.data('cinchAccordionBound')) return
      $menu.data('cinchAccordionBound', true)

      // Respect existing "opened" state
      $menu.find('li.opened > .ul-wrapper').css('display', 'block')

      // Navigate on click, preserving target behavior
      $menu.find('a').on('click.cinch', function (e) {
        e.preventDefault()
        var $a = $(this)
        if ($a.attr('target') === '_blank') {
          window.open($a.attr('href'))
        } else {
          window.location.assign($a.attr('href'))
        }
      })

      // Hover handlers for showing/hiding nested lists
      $menu
        .find('li')
        .on('mouseenter.cinch', function () {
          var $li = $(this)
          var $ul = $li.children('.ul-wrapper')
          if ($ul.length) {
            $li.addClass('opened')
            $ul.stop(true, true).slideDown(300)
          }
        })
        .on('mouseleave.cinch', function () {
          var $li = $(this)
          var $ul = $li.children('.ul-wrapper')
          if ($ul.length) {
            $li.removeClass('opened')
            $ul.stop(true, true).slideUp(300)
          }
        })
    })
  }

  initAccordionMenus()

  // Called once on domready, again when a subform row is added
  function initTooltip(event, container) {
    $(container || document)
      .find('*[rel=tooltip]')
      .tooltip()
  }

  // Called once on domready, again when a subform row is added
  function initButtonGroup(event, container) {
    var $container = $(container || document)

    // Turn radios into btn-group
    $container.find('.radio.btn-group label').addClass('btn')

    $container.find('.btn-group input:checked').each(function () {
      var $input = $(this)
      var $label = $('label[for=' + $input.attr('id') + ']')
      var btnClass = 'primary'

      if ($input.val() != '') {
        var reversed = $input.parent().hasClass('btn-group-reversed')
        btnClass = ($input.val() == 0 ? !reversed : reversed) ? 'danger' : 'success'
      }

      $label.addClass('active btn-' + btnClass)
    })
  }
})

// Global Mobile Navigation (no HTML edits required)
;(function () {
  class MobileNavigation {
    constructor() {
      this.sidebar = null
      this.toggleButton = null
      this.overlay = null
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
    }

    createMobileElements() {
      this.sidebar = document.getElementById('sidebar')
      if (!this.sidebar) return
      this.sidebar.setAttribute('role', 'navigation')
      this.sidebar.setAttribute('aria-label', 'Main menu')

      // Reuse existing elements if a page already created them
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
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      try { new MobileNavigation() } catch { /* no-op */ }
    })
  } else {
    try { new MobileNavigation() } catch { /* no-op */ }
  }
})()

// SOP loader removed: avoid fetching non-website resources
