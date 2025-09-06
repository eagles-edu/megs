/**
 * Modern Accordion Implementation
 * A lightweight, accessible accordion system with no dependencies
 * For MEGS educational web app - 2025 update
 */
document.addEventListener('DOMContentLoaded', () => {
  // Initialize all accordions on the page
  initAccordions();
});

/**
 * Initialize all accordions on the page
 */
function initAccordions() {
  const accordionToggles = document.querySelectorAll('.accordion-toggle');
  
  // Add click event listeners to all accordion toggles
  accordionToggles.forEach(toggle => {
    // Set initial ARIA attributes for accessibility
    const contentId = toggle.getAttribute('data-id');
    const content = document.getElementById(contentId);
    
    if (content) {
      // Set initial state
      const isExpanded = content.classList.contains('show');
      toggle.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
      toggle.setAttribute('aria-controls', contentId);
      content.setAttribute('aria-labelledby', toggle.id || '');
      
      // Add click event listener
      toggle.addEventListener('click', handleAccordionToggle);
    }
  });
  
  // Check URL hash to open specific accordion on page load
  checkUrlHash();
  
  // Listen for hash changes to open accordions when navigating
  window.addEventListener('hashchange', checkUrlHash);
}

/**
 * Handle accordion toggle click
 * @param {Event} e - Click event
 */
function handleAccordionToggle(e) {
  e.preventDefault();
  
  const toggle = e.currentTarget;
  const contentId = toggle.getAttribute('data-id');
  const content = document.getElementById(contentId);
  
  if (!content) return;
  
  // Check if we should close other accordions in the same group
  const parentId = toggle.getAttribute('data-parent');
  const isSingleOpen = !!parentId;
  
  // Get current state
  const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
  
  // Close other accordions in the same group if needed
  if (isSingleOpen && !isExpanded) {
    const parent = document.querySelector(parentId);
    if (parent) {
      const siblingToggles = parent.querySelectorAll('.accordion-toggle');
      siblingToggles.forEach(siblingToggle => {
        if (siblingToggle !== toggle) {
          const siblingContentId = siblingToggle.getAttribute('data-id');
          const siblingContent = document.getElementById(siblingContentId);
          
          if (siblingContent && siblingContent.classList.contains('show')) {
            // Close sibling accordion
            siblingToggle.setAttribute('aria-expanded', 'false');
            siblingContent.classList.remove('show');
            
            // Animate closing if supported
            animateAccordion(siblingContent, false);
          }
        }
      });
    }
  }
  
  // Toggle current accordion
  toggle.setAttribute('aria-expanded', !isExpanded);
  
  if (isExpanded) {
    // Close accordion
    content.classList.remove('show');
  } else {
    // Open accordion
    content.classList.add('show');
  }
  
  // Animate the accordion
  animateAccordion(content, !isExpanded);
  
  // Update URL hash if enabled
  if (!isExpanded && toggle.hasAttribute('data-update-hash')) {
    const hash = toggle.getAttribute('href');
    if (hash && hash.startsWith('#')) {
      history.replaceState(null, null, hash);
    }
  }
}

/**
 * Animate accordion opening/closing with smooth height transition
 * @param {HTMLElement} content - Accordion content element
 * @param {boolean} isOpening - Whether the accordion is opening or closing
 */
function animateAccordion(content, isOpening) {
  // Use Web Animation API if supported, otherwise use classList
  if (typeof content.animate === 'function') {
    if (isOpening) {
      // Get the height of the content
      content.style.height = 'auto';
      content.style.display = 'block';
      const height = content.offsetHeight;
      content.style.height = '0px';
      
      // Animate opening
      content.animate(
        [
          { height: '0px', opacity: 0 },
          { height: `${height}px`, opacity: 1 }
        ],
        { 
          duration: 300,
          easing: 'ease-out',
          fill: 'forwards'
        }
      ).onfinish = () => {
        content.style.height = '';
        content.style.display = '';
      };
    } else {
      // Get current height
      const height = content.offsetHeight;
      
      // Animate closing
      content.animate(
        [
          { height: `${height}px`, opacity: 1 },
          { height: '0px', opacity: 0 }
        ],
        { 
          duration: 300,
          easing: 'ease-in',
          fill: 'forwards'
        }
      ).onfinish = () => {
        content.style.height = '';
        content.style.display = '';
      };
    }
  } else {
    // Fallback for browsers without Web Animation API
    content.style.transition = 'height 300ms ease';
    if (isOpening) {
      content.style.height = 'auto';
    } else {
      content.style.height = '0px';
    }
    
    // Remove transition after animation completes
    setTimeout(() => {
      content.style.transition = '';
      if (!isOpening) {
        content.style.height = '';
      }
    }, 300);
  }
}

/**
 * Check URL hash and open corresponding accordion
 */
function checkUrlHash() {
  const hash = window.location.hash;
  if (hash) {
    // Find accordion toggle that matches the hash
    const toggle = document.querySelector(`.accordion-toggle[href$="${hash}"]`);
    if (toggle) {
      // Open the accordion
      const contentId = toggle.getAttribute('data-id');
      const content = document.getElementById(contentId);
      
      if (content && !content.classList.contains('show')) {
        toggle.setAttribute('aria-expanded', 'true');
        content.classList.add('show');
        
        // Scroll to the accordion
        setTimeout(() => {
          toggle.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    }
  }
}
