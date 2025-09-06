/**
 * Modern Menu Implementation
 * A lightweight, accessible menu system with no dependencies
 * For MEGS educational web app - 2025 update
 */
document.addEventListener('DOMContentLoaded', () => {
  // Initialize accordion menu
  initAccordionMenu();
  
  // Initialize flyout menu
  initFlyoutMenu();
});

/**
 * Initialize accordion menu
 */
function initAccordionMenu() {
  const accordionMenu = document.getElementById('accordion_menu_90');
  if (!accordionMenu) return;
  
  // Handle menu item clicks
  const menuLinks = accordionMenu.querySelectorAll('a');
  menuLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const target = link.getAttribute('target');
      if (target === '_blank') {
        window.open(link.href);
      } else {
        location.href = link.href;
      }
      e.preventDefault();
    });
  });
  
  // Set initial state for opened items
  const openedItems = accordionMenu.querySelectorAll('li.opened');
  openedItems.forEach(item => {
    const subMenu = item.querySelector('.ul-wrapper');
    if (subMenu) {
      subMenu.style.display = 'block';
      
      const menuButton = item.querySelector('.item-wrapper .menu-button img');
      if (menuButton) {
        menuButton.src = '../modules/mod_cinch_menu/tmpl/images/minus.png';
      }
    }
  });
  
  // Handle menu item hover/interaction
  let onProcess = false;
  const menuItems = accordionMenu.querySelectorAll('li');
  
  menuItems.forEach(item => {
    // Mouse enter event
    item.addEventListener('mouseenter', () => {
      if (onProcess) return;
      
      const subMenu = item.querySelector('.ul-wrapper');
      if (subMenu) {
        onProcess = true;
        item.classList.add('opened');
        
        const menuButton = item.querySelector('.item-wrapper .menu-button img');
        if (menuButton) {
          menuButton.src = '../modules/mod_cinch_menu/tmpl/images/minus.png';
        }
        
        // Animate submenu opening
        subMenu.style.display = 'block';
        subMenu.style.height = '0';
        const height = subMenu.scrollHeight;
        
        const animation = subMenu.animate(
          [
            { height: '0px', opacity: 0 },
            { height: `${height}px`, opacity: 1 }
          ],
          { duration: 300, easing: 'ease-out' }
        );
        
        animation.onfinish = () => {
          subMenu.style.height = '';
          onProcess = false;
        };
      }
    });
    
    // Mouse leave event
    item.addEventListener('mouseleave', () => {
      if (onProcess) return;
      
      const subMenu = item.querySelector('.ul-wrapper');
      if (subMenu) {
        onProcess = true;
        
        const menuButton = item.querySelector('.item-wrapper .menu-button img');
        if (menuButton) {
          menuButton.src = '../modules/mod_cinch_menu/tmpl/images/plus.png';
        }
        
        // Animate submenu closing
        const height = subMenu.scrollHeight;
        
        const animation = subMenu.animate(
          [
            { height: `${height}px`, opacity: 1 },
            { height: '0px', opacity: 0 }
          ],
          { duration: 300, easing: 'ease-in' }
        );
        
        animation.onfinish = () => {
          subMenu.style.display = 'none';
          item.classList.remove('opened');
          onProcess = false;
        };
      }
    });
  });
}

/**
 * Initialize flyout menu
 */
function initFlyoutMenu() {
  const flyoutMenu = document.getElementById('flyout_menu_93');
  if (!flyoutMenu) return;
  
  // Handle menu item clicks
  const menuLinks = flyoutMenu.querySelectorAll('a');
  menuLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const target = link.getAttribute('target');
      if (target === '_blank') {
        window.open(link.href);
      } else {
        location.href = link.href;
      }
      e.preventDefault();
    });
  });
}
