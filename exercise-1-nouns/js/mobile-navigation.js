/**
 * Mobile Navigation Enhancement for MEGS Educational Platform
 * Provides responsive navigation functionality with hamburger menu
 * Ensures navigation accessibility across all screen sizes
 */

class MobileNavigation {
  constructor() {
    this.sidebar = null;
    this.toggleButton = null;
    this.overlay = null;
    this.isOpen = false;
    this.mediaQuery = window.matchMedia('(max-width: 767px)');
    
    this.init();
  }
  
  init() {
    this.createMobileElements();
    this.bindEvents();
    this.handleResize();
    
    // Listen for screen size changes
    this.mediaQuery.addEventListener('change', () => this.handleResize());
  }
  
  createMobileElements() {
    this.sidebar = document.getElementById('sidebar');
    if (!this.sidebar) {
      console.warn('Sidebar element not found');
      return;
    }
    
    // Create hamburger menu button
    this.toggleButton = document.createElement('button');
    this.toggleButton.className = 'mobile-menu-toggle';
    this.toggleButton.setAttribute('aria-label', 'Toggle navigation menu');
    this.toggleButton.setAttribute('aria-expanded', 'false');
    this.toggleButton.setAttribute('aria-controls', 'sidebar');
    this.toggleButton.type = 'button';
    
    // Create overlay for mobile menu
    this.overlay = document.createElement('div');
    this.overlay.className = 'mobile-nav-overlay';
    this.overlay.setAttribute('aria-hidden', 'true');
    
    // Insert elements into DOM
    document.body.appendChild(this.toggleButton);
    document.body.appendChild(this.overlay);
  }
  
  bindEvents() {
    if (!this.toggleButton || !this.overlay) return;
    
    // Toggle button click
    this.toggleButton.addEventListener('click', (e) => {
      e.preventDefault();
      this.toggleMenu();
    });
    
    // Overlay click to close menu
    this.overlay.addEventListener('click', () => {
      this.closeMenu();
    });
    
    // Escape key to close menu
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.closeMenu();
        this.toggleButton.focus();
      }
    });
    
    // Close menu when clicking on a navigation link (on mobile)
    this.sidebar?.addEventListener('click', (e) => {
      if (this.mediaQuery.matches && e.target.tagName === 'A') {
        // Small delay to allow navigation to start before closing menu
        setTimeout(() => this.closeMenu(), 150);
      }
    });
    
    // Prevent menu from staying open when resizing to desktop
    window.addEventListener('resize', () => {
      if (!this.mediaQuery.matches && this.isOpen) {
        this.closeMenu();
      }
    });
    
    // Focus management for accessibility
    this.setupFocusTrap();
  }
  
  toggleMenu() {
    if (this.isOpen) {
      this.closeMenu();
    } else {
      this.openMenu();
    }
  }
  
  openMenu() {
    if (!this.mediaQuery.matches) return;
    
    this.isOpen = true;
    document.body.classList.add('mobile-nav-open');
    this.sidebar?.classList.add('mobile-nav-open');
    this.overlay?.classList.add('active');
    this.toggleButton?.classList.add('open');
    
    // Update ARIA attributes
    this.toggleButton?.setAttribute('aria-expanded', 'true');
    this.overlay?.setAttribute('aria-hidden', 'false');
    
    // Focus first menu item for accessibility
    this.focusFirstMenuItem();
  }
  
  closeMenu() {
    this.isOpen = false;
    document.body.classList.remove('mobile-nav-open');
    this.sidebar?.classList.remove('mobile-nav-open');
    this.overlay?.classList.remove('active');
    this.toggleButton?.classList.remove('open');
    
    // Update ARIA attributes
    this.toggleButton?.setAttribute('aria-expanded', 'false');
    this.overlay?.setAttribute('aria-hidden', 'true');
  }
  
  handleResize() {
    // Ensure proper state when switching between mobile and desktop
    if (!this.mediaQuery.matches && this.isOpen) {
      this.closeMenu();
    }
  }
  
  focusFirstMenuItem() {
    const firstLink = this.sidebar?.querySelector('.accordion-menu a');
    if (firstLink) {
      firstLink.focus();
    }
  }
  
  setupFocusTrap() {
    if (!this.sidebar) return;
    
    const focusableElements = 'a, button, [tabindex]:not([tabindex="-1"])';
    
    this.sidebar.addEventListener('keydown', (e) => {
      if (!this.isOpen || e.key !== 'Tab') return;
      
      const focusableEls = this.sidebar.querySelectorAll(focusableElements);
      const firstFocusable = focusableEls[0];
      const lastFocusable = focusableEls[focusableEls.length - 1];
      
      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstFocusable) {
          lastFocusable.focus();
          e.preventDefault();
        }
      } else {
        // Tab
        if (document.activeElement === lastFocusable) {
          firstFocusable.focus();
          e.preventDefault();
        }
      }
    });
  }
}

// Initialize mobile navigation when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new MobileNavigation();
  });
} else {
  new MobileNavigation();
}

// Export for testing purposes
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MobileNavigation;
}