/**
 * @package     Joomla.Site
 * @subpackage  Templates.protostar
 * @copyright   Copyright (C) 2005 - 2018 Open Source Matters, Inc. All rights reserved.
 * @license     GNU General Public License version 2 or later; see LICENSE.txt
 * @since       3.2
 */

jQuery(function ($) {
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
          location = $a.attr('href')
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
          location = $a.attr('href')
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
