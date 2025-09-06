// Simple Firefox extension popup script
document.addEventListener('DOMContentLoaded', function() {
  console.log('Simple Firefox extension popup loaded');
  
  const productPanel = document.querySelector('.product-panel');
  const leftArrow = document.querySelector('.left-arrow');
  const rightArrow = document.querySelector('.right-arrow');
  const contentPanels = document.querySelectorAll('.product-content');
  
  let currentIndex = 0;
  const totalPanels = contentPanels.length;
  
  // Smooth animation function
  function smoothReturn() {
    productPanel.style.transition = 'transform 1.1s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    productPanel.style.transform = 'translateX(0px) rotate(0deg)';
    
    // Remove transition after animation completes
    setTimeout(() => {
      productPanel.style.transition = 'none';
    }, 1100);
  }
  
  // Update content positions
  function updateContentPositions() {
    contentPanels.forEach((panel, index) => {
      panel.classList.remove('current', 'next', 'prev');
      
      if (index === currentIndex) {
        panel.classList.add('current');
      } else if (index === (currentIndex + 1) % totalPanels) {
        panel.classList.add('next');
      } else {
        panel.classList.add('prev');
      }
    });
  }
  
  // Slide to next content (green arrow - always left to right)
  function slideToNext() {
    const currentPanel = document.querySelector('.product-content.current');
    const nextIndex = (currentIndex + 1) % totalPanels;
    const nextPanel = contentPanels[nextIndex];
    
    // Position next panel to the left (off-screen)
    nextPanel.style.transform = 'translateX(-100%)';
    nextPanel.style.zIndex = '3';
    
    // Force a reflow
    nextPanel.offsetHeight;
    
    // Slide current out to right, next in from left
    currentPanel.style.transform = 'translateX(100%)';
    nextPanel.style.transform = 'translateX(0)';
    
    setTimeout(() => {
      currentIndex = nextIndex;
      updateContentPositions();
    }, 600);
  }
  
  // Slide to previous content (red arrow - always right to left)
  function slideToPrev() {
    const currentPanel = document.querySelector('.product-content.current');
    const prevIndex = (currentIndex - 1 + totalPanels) % totalPanels;
    const prevPanel = contentPanels[prevIndex];
    
    // Position prev panel to the right (off-screen)
    prevPanel.style.transform = 'translateX(100%)';
    prevPanel.style.zIndex = '3';
    
    // Force a reflow
    prevPanel.offsetHeight;
    
    // Slide current out to left, prev in from right
    currentPanel.style.transform = 'translateX(-100%)';
    prevPanel.style.transform = 'translateX(0)';
    
    setTimeout(() => {
      currentIndex = prevIndex;
      updateContentPositions();
    }, 600);
  }
  
  if (productPanel) {
    // Panel hover effect
    productPanel.addEventListener('mousemove', function(e) {
      const rect = productPanel.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const panelWidth = rect.width;
      const centerX = panelWidth / 2;
      
      // Calculate how far from center (0 to 1)
      const distanceFromCenter = (x - centerX) / centerX;
      
      // Move the entire panel horizontally and rotate it
      const moveX = distanceFromCenter * 20; // Move up to 20px
      const rotate = distanceFromCenter * 8; // Rotate up to 8 degrees
      
      productPanel.style.transition = 'none';
      productPanel.style.transform = `translateX(${moveX}px) rotate(${rotate}deg)`;
    });
    
    productPanel.addEventListener('mouseleave', function() {
      smoothReturn();
    });
  }
  
  // Left arrow hover effect (red arrow - swipe left)
  if (leftArrow && productPanel) {
    leftArrow.addEventListener('mouseenter', function() {
      productPanel.style.transition = 'none';
      productPanel.style.transform = 'translateX(-15px) rotate(-5deg)';
    });
    
    leftArrow.addEventListener('mouseleave', function() {
      smoothReturn();
    });
    
    // Left arrow click effect
    leftArrow.addEventListener('click', function() {
      slideToPrev();
    });
  }
  
  // Right arrow hover effect (green arrow - swipe right)
  if (rightArrow && productPanel) {
    rightArrow.addEventListener('mouseenter', function() {
      productPanel.style.transition = 'none';
      productPanel.style.transform = 'translateX(15px) rotate(5deg)';
    });
    
    rightArrow.addEventListener('mouseleave', function() {
      smoothReturn();
    });
    
    // Right arrow click effect
    rightArrow.addEventListener('click', function() {
      slideToNext();
    });
  }
  
  // Initialize content positions
  updateContentPositions();
});
