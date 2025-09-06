// Popup script for the Eco-Friendly Alternatives browser extension
class PopupManager {
  constructor() {
    this.currentProduct = null;
    this.alternatives = [];
    this.init();
  }

  async init() {
    // Get current tab information
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (this.isAmazonPage(tab.url)) {
      await this.loadProductData(tab.id);
      this.setupEventListeners();
    } else {
      this.showNotAmazonPage();
    }
  }

  isAmazonPage(url) {
    return url && (
      url.includes('amazon.com') ||
      url.includes('amazon.co.uk') ||
      url.includes('amazon.de') ||
      url.includes('amazon.fr') ||
      url.includes('amazon.ca') ||
      url.includes('amazon.com.au')
    );
  }

  async loadProductData(tabId) {
    try {
      this.showLoadingState();
      
      // Send message to content script to get product data
      const response = await chrome.tabs.sendMessage(tabId, { action: 'getProductData' });
      
      if (response && response.product) {
        this.currentProduct = response.product;
        this.alternatives = response.alternatives || [];
        this.displayProductAndAlternatives();
      } else {
        this.showNoAlternatives();
      }
    } catch (error) {
      console.error('Error loading product data:', error);
      this.showErrorState();
    }
  }

  showLoadingState() {
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = statusIndicator.querySelector('.status-text');
    const statusDot = statusIndicator.querySelector('.status-dot');
    
    statusText.textContent = 'Analyzing...';
    statusDot.style.animation = 'pulse 2s infinite';
  }

  showAnalyzingState() {
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = statusIndicator.querySelector('.status-text');
    const statusDot = statusIndicator.querySelector('.status-dot');
    
    statusText.textContent = 'Finding alternatives...';
    statusDot.style.animation = 'pulse 2s infinite';
  }

  showSuccessState() {
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = statusIndicator.querySelector('.status-text');
    const statusDot = statusIndicator.querySelector('.status-dot');
    
    statusText.textContent = 'Ready';
    statusDot.style.animation = 'none';
    statusDot.style.background = '#2ecc71';
  }

  displayProductAndAlternatives() {
    this.showSuccessState();
    
    // Display current product
    this.displayCurrentProduct();
    
    // Display alternatives
    if (this.alternatives.length > 0) {
      this.displayAlternatives();
    } else {
      this.showNoAlternatives();
    }
  }

  displayCurrentProduct() {
    const productImage = document.getElementById('productImage');
    const productTitle = document.getElementById('productTitle');
    const productCategory = document.getElementById('productCategory');
    const productPrice = document.getElementById('productPrice');

    if (this.currentProduct) {
      productImage.src = this.currentProduct.image || 'https://via.placeholder.com/60x60?text=Product';
      productImage.alt = this.currentProduct.title || 'Product image';
      productTitle.textContent = this.currentProduct.title || 'Unknown Product';
      productCategory.textContent = this.currentProduct.category || 'Unknown Category';
      productPrice.textContent = this.currentProduct.price || 'Price not available';
    }
  }

  displayAlternatives() {
    const alternativesList = document.getElementById('alternativesList');
    const alternativesSection = document.getElementById('alternativesSection');
    const noAlternatives = document.getElementById('noAlternatives');
    const errorState = document.getElementById('errorState');

    // Hide other states
    noAlternatives.style.display = 'none';
    errorState.style.display = 'none';
    alternativesSection.style.display = 'block';

    // Clear existing alternatives
    alternativesList.innerHTML = '';

    // Add each alternative
    this.alternatives.forEach(alternative => {
      const alternativeElement = this.createAlternativeElement(alternative);
      alternativesList.appendChild(alternativeElement);
    });
  }

  createAlternativeElement(alternative) {
    const div = document.createElement('div');
    div.className = 'alternative-item';
    
    div.innerHTML = `
      <div class="alternative-header">
        <div class="alternative-image">
          <img src="${alternative.image || 'https://via.placeholder.com/50x50?text=Eco'}" alt="${alternative.name}">
        </div>
        <div class="alternative-content">
          <div class="alternative-name">${alternative.name}</div>
          <div class="alternative-description">${alternative.description}</div>
          <div class="benefits">
            ${alternative.benefits.map(benefit => `<span class="benefit-tag">${benefit}</span>`).join('')}
          </div>
          <div class="alternative-actions">
            <a href="${alternative.url}" target="_blank" class="alternative-link">View Product</a>
            <span class="alternative-price">${alternative.price}</span>
          </div>
        </div>
      </div>
    `;

    // Add click handler to open product page
    div.addEventListener('click', (e) => {
      if (!e.target.closest('.alternative-link')) {
        window.open(alternative.url, '_blank');
      }
    });

    return div;
  }

  showNoAlternatives() {
    const alternativesSection = document.getElementById('alternativesSection');
    const noAlternatives = document.getElementById('noAlternatives');
    const errorState = document.getElementById('errorState');

    alternativesSection.style.display = 'none';
    errorState.style.display = 'none';
    noAlternatives.style.display = 'block';
  }

  showErrorState() {
    const alternativesSection = document.getElementById('alternativesSection');
    const noAlternatives = document.getElementById('noAlternatives');
    const errorState = document.getElementById('errorState');

    alternativesSection.style.display = 'none';
    noAlternatives.style.display = 'none';
    errorState.style.display = 'block';
  }

  showNotAmazonPage() {
    const alternativesSection = document.getElementById('alternativesSection');
    const noAlternatives = document.getElementById('noAlternatives');
    const errorState = document.getElementById('errorState');
    const currentProduct = document.getElementById('currentProduct');

    alternativesSection.style.display = 'none';
    noAlternatives.style.display = 'none';
    errorState.style.display = 'none';
    currentProduct.style.display = 'none';

    // Show message for non-Amazon pages
    const main = document.querySelector('.popup-main');
    main.innerHTML = `
      <div class="no-alternatives">
        <div class="no-alternatives-content">
          <span class="no-alternatives-icon">🛒</span>
          <h3>Visit an Amazon Product Page</h3>
          <p>This extension works on Amazon product pages. Navigate to a product you're interested in to see eco-friendly alternatives.</p>
        </div>
      </div>
    `;
  }

  setupEventListeners() {
    // Retry button
    const retryButton = document.getElementById('retryButton');
    if (retryButton) {
      retryButton.addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await this.loadProductData(tab.id);
      });
    }

    // Footer links
    const learnMoreLink = document.getElementById('learnMoreLink');
    if (learnMoreLink) {
      learnMoreLink.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: 'https://example.com/learn-more' });
      });
    }

    const settingsLink = document.getElementById('settingsLink');
    if (settingsLink) {
      settingsLink.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: 'chrome://extensions/' });
      });
    }

    const feedbackLink = document.getElementById('feedbackLink');
    if (feedbackLink) {
      feedbackLink.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: 'https://example.com/feedback' });
      });
    }
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});
