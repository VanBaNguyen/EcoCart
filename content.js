// Content script to analyze Amazon product pages and inject eco-friendly alternatives
class EcoFriendlyAnalyzer {
  constructor() {
    this.alternatives = null;
    this.currentProduct = null;
    this.init();
  }

  async init() {
    // Load alternatives database
    await this.loadAlternatives();
    
    // Analyze current page
    this.analyzeCurrentPage();
    
    // Set up mutation observer to handle dynamic content
    this.setupMutationObserver();
  }

  async loadAlternatives() {
    try {
      const response = await fetch(chrome.runtime.getURL('alternatives.json'));
      this.alternatives = await response.json();
    } catch (error) {
      console.error('Failed to load alternatives database:', error);
    }
  }

  analyzeCurrentPage() {
    // Check if we're on an Amazon product page
    if (this.isAmazonProductPage()) {
      this.extractProductInfo();
      this.findAlternatives();
    }
  }

  isAmazonProductPage() {
    const url = window.location.href;
    return url.includes('/dp/') || url.includes('/product/') || url.includes('/gp/product/');
  }

  extractProductInfo() {
    const product = {
      title: this.getProductTitle(),
      category: this.getProductCategory(),
      brand: this.getProductBrand(),
      price: this.getProductPrice(),
      image: this.getProductImage(),
      description: this.getProductDescription(),
      keywords: this.extractKeywords()
    };

    this.currentProduct = product;
    console.log('Extracted product info:', product);
  }

  getProductTitle() {
    const selectors = [
      '#productTitle',
      '.product-title',
      'h1[data-automation-id="product-title"]',
      '.pdp-product-name'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) return element.textContent.trim();
    }
    return '';
  }

  getProductCategory() {
    // Try to get category from breadcrumbs
    const breadcrumbSelectors = [
      '#wayfinding-breadcrumbs_feature_div a',
      '.breadcrumb a',
      '[data-testid="breadcrumb"] a'
    ];
    
    for (const selector of breadcrumbSelectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        return Array.from(elements).map(el => el.textContent.trim()).join(' > ');
      }
    }
    return '';
  }

  getProductBrand() {
    const brandSelectors = [
      '#bylineInfo',
      '.brand',
      '[data-automation-id="bylineInfo"]',
      '.pdp-product-brand'
    ];
    
    for (const selector of brandSelectors) {
      const element = document.querySelector(selector);
      if (element) return element.textContent.trim();
    }
    return '';
  }

  getProductPrice() {
    const priceSelectors = [
      '.a-price-whole',
      '.a-price .a-offscreen',
      '[data-automation-id="product-price"]',
      '.pdp-price'
    ];
    
    for (const selector of priceSelectors) {
      const element = document.querySelector(selector);
      if (element) return element.textContent.trim();
    }
    return '';
  }

  getProductImage() {
    const imgSelectors = [
      '#landingImage',
      '.a-dynamic-image',
      '[data-automation-id="product-image"] img',
      '.pdp-product-image img'
    ];
    
    for (const selector of imgSelectors) {
      const element = document.querySelector(selector);
      if (element) return element.src || element.getAttribute('data-src');
    }
    return '';
  }

  getProductDescription() {
    const descSelectors = [
      '#feature-bullets ul',
      '.product-description',
      '[data-automation-id="product-description"]',
      '.pdp-product-description'
    ];
    
    for (const selector of descSelectors) {
      const element = document.querySelector(selector);
      if (element) return element.textContent.trim();
    }
    return '';
  }

  extractKeywords() {
    const title = this.getProductTitle();
    const description = this.getProductDescription();
    const category = this.getProductCategory();
    
    const text = `${title} ${description} ${category}`.toLowerCase();
    
    // Extract common product keywords
    const keywords = [];
    const commonTerms = [
      'organic', 'natural', 'eco', 'sustainable', 'recycled', 'biodegradable',
      'plastic', 'bamboo', 'cotton', 'wood', 'metal', 'glass', 'ceramic',
      'home', 'kitchen', 'bathroom', 'office', 'garden', 'clothing', 'shoes',
      'electronics', 'furniture', 'decor', 'cleaning', 'personal care'
    ];
    
    commonTerms.forEach(term => {
      if (text.includes(term)) {
        keywords.push(term);
      }
    });
    
    return keywords;
  }

  findAlternatives() {
    if (!this.alternatives || !this.currentProduct) return;

    const matches = this.matchAlternatives();
    if (matches.length > 0) {
      this.displayAlternatives(matches);
    }
  }

  matchAlternatives() {
    const product = this.currentProduct;
    const matches = [];

    // Match by category
    if (product.category) {
      const categoryMatches = this.alternatives.categories[this.categorizeProduct(product.category)];
      if (categoryMatches) {
        matches.push(...categoryMatches);
      }
    }

    // Match by keywords
    product.keywords.forEach(keyword => {
      if (this.alternatives.keywords[keyword]) {
        matches.push(...this.alternatives.keywords[keyword]);
      }
    });

    // Match by brand alternatives
    if (product.brand) {
      const brandMatches = this.alternatives.brands[product.brand.toLowerCase()];
      if (brandMatches) {
        matches.push(...brandMatches);
      }
    }

    // Remove duplicates and limit results
    const uniqueMatches = [...new Set(matches.map(m => m.name))].map(name => 
      matches.find(m => m.name === name)
    );

    return uniqueMatches.slice(0, 5); // Top 5 alternatives
  }

  categorizeProduct(categoryString) {
    const category = categoryString.toLowerCase();
    
    if (category.includes('home') || category.includes('kitchen')) return 'home';
    if (category.includes('clothing') || category.includes('fashion')) return 'clothing';
    if (category.includes('beauty') || category.includes('personal care')) return 'beauty';
    if (category.includes('electronics') || category.includes('tech')) return 'electronics';
    if (category.includes('garden') || category.includes('outdoor')) return 'garden';
    if (category.includes('office') || category.includes('stationery')) return 'office';
    
    return 'general';
  }

  displayAlternatives(alternatives) {
    // Remove existing alternatives panel
    const existingPanel = document.getElementById('eco-alternatives-panel');
    if (existingPanel) {
      existingPanel.remove();
    }

    // Create alternatives panel
    const panel = document.createElement('div');
    panel.id = 'eco-alternatives-panel';
    panel.innerHTML = this.createAlternativesHTML(alternatives);

    // Insert panel into the page
    const targetElement = this.findInsertionPoint();
    if (targetElement) {
      targetElement.insertAdjacentElement('afterend', panel);
    }
  }

  createAlternativesHTML(alternatives) {
    return `
      <div class="eco-alternatives-container">
        <div class="eco-alternatives-header">
          <h3>🌱 Eco-Friendly Alternatives</h3>
          <p>Discover sustainable options for this product</p>
        </div>
        <div class="eco-alternatives-list">
          ${alternatives.map(alt => `
            <div class="eco-alternative-item">
              <div class="eco-alternative-image">
                <img src="${alt.image || 'https://via.placeholder.com/100x100?text=Eco'}" alt="${alt.name}">
              </div>
              <div class="eco-alternative-content">
                <h4>${alt.name}</h4>
                <p class="eco-alternative-description">${alt.description}</p>
                <div class="eco-alternative-benefits">
                  ${alt.benefits.map(benefit => `<span class="benefit-tag">${benefit}</span>`).join('')}
                </div>
                <div class="eco-alternative-actions">
                  <a href="${alt.url}" target="_blank" class="eco-alternative-link">View Product</a>
                  <span class="eco-alternative-price">${alt.price}</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="eco-alternatives-footer">
          <p>💡 <strong>Tip:</strong> Look for certifications like Fair Trade, Organic, or B-Corp when shopping sustainably.</p>
        </div>
      </div>
    `;
  }

  findInsertionPoint() {
    // Try to find a good place to insert the alternatives panel
    const selectors = [
      '#dp-container',
      '#centerCol',
      '.product-details',
      '#productDetails_feature_div',
      '.a-section'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) return element;
    }
    
    return document.body;
  }

  setupMutationObserver() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // Re-analyze if new content is added
          setTimeout(() => this.analyzeCurrentPage(), 1000);
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
}

// Initialize the analyzer when the page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new EcoFriendlyAnalyzer());
} else {
  new EcoFriendlyAnalyzer();
}
