/**
 * Product Name Scraper
 * Extracts product names and details from e-commerce product pages
 */

class ProductScraper {
    constructor() {
        this.commonSelectors = {
            // Common product name selectors across different e-commerce sites
            productName: [
                'h1[data-testid="product-title"]',
                'h1.product-title',
                'h1[class*="product"]',
                'h1[class*="title"]',
                '.product-name h1',
                '.product-title h1',
                '.product-info h1',
                '.product-details h1',
                '.product-header h1',
                '.product-main h1',
                '[data-testid="product-name"]',
                '[data-testid="product-title"]',
                '.product-name',
                '.product-title',
                '.product-info .title',
                '.product-details .title',
                '.product-header .title',
                '.product-main .title',
                'h1',
                '.title',
                '.name'
            ],
            // Price selectors
            price: [
                '[data-testid="price"]',
                '.price',
                '.product-price',
                '.current-price',
                '.sale-price',
                '.regular-price',
                '.price-current',
                '.price-value',
                '[class*="price"]'
            ],
            // Brand selectors
            brand: [
                '[data-testid="brand"]',
                '.brand',
                '.product-brand',
                '.manufacturer',
                '.vendor',
                '[class*="brand"]'
            ],
            // Description selectors
            description: [
                '[data-testid="description"]',
                '.description',
                '.product-description',
                '.product-details .description',
                '.product-info .description',
                '[class*="description"]'
            ]
        };
    }

    /**
     * Detect if current page is likely a product page
     * @returns {Promise<boolean>} True if page appears to be a product page
     */
    async isProductPage() {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs.length === 0) return false;

            const results = await chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: this.detectProductPageIndicators
            });

            return results[0].result;
        } catch (error) {
            console.error('Error detecting product page:', error);
            return false;
        }
    }

    /**
     * Function to detect product page indicators (runs in page context)
     */
    detectProductPageIndicators() {
        const indicators = [
            // URL patterns
            /\/product\//i,
            /\/item\//i,
            /\/p\//i,
            /\/dp\//i,
            /\/products\//i,
            /\/items\//i,
            /\/shop\//i,
            /\/buy\//i,
            /\/pdp\//i,
            /\/detail\//i
        ];

        // Check URL patterns
        const url = window.location.href;
        const hasProductUrl = indicators.some(pattern => pattern.test(url));

        // Check for common product page elements
        const productElements = [
            'button[class*="add-to-cart"]',
            'button[class*="buy"]',
            'button[class*="purchase"]',
            '.add-to-cart',
            '.buy-now',
            '.purchase',
            '[data-testid*="add-to-cart"]',
            '[data-testid*="buy"]',
            '.product-gallery',
            '.product-images',
            '.product-photos',
            '.price',
            '.product-price'
        ];

        const hasProductElements = productElements.some(selector => 
            document.querySelector(selector) !== null
        );

        // Check for product-specific meta tags
        const metaTags = [
            'meta[property="og:type"][content*="product"]',
            'meta[property="product:price"]',
            'meta[name="description"][content*="buy"]',
            'meta[name="description"][content*="purchase"]'
        ];

        const hasProductMeta = metaTags.some(selector => 
            document.querySelector(selector) !== null
        );

        return hasProductUrl || hasProductElements || hasProductMeta;
    }

    /**
     * Extract product information from current page
     * @returns {Promise<Object>} Product data object
     */
    async extractProductData() {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs.length === 0) {
                throw new Error('No active tab found');
            }

            const results = await chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: this.scrapeProductInfo,
                args: [this.commonSelectors]
            });

            const productData = results[0].result;
            
            // Add metadata
            productData.metadata = {
                url: tabs[0].url,
                title: tabs[0].title,
                timestamp: new Date().toISOString(),
                domain: new URL(tabs[0].url).hostname
            };

            return productData;
        } catch (error) {
            console.error('Error extracting product data:', error);
            throw error;
        }
    }

    /**
     * Function to scrape product info (runs in page context)
     */
    scrapeProductInfo(selectors) {
        const productData = {
            name: null,
            price: null,
            brand: null,
            description: null,
            image: null,
            availability: null,
            rating: null,
            reviews: null,
            category: null,
            sku: null,
            rawData: {}
        };

        // Helper function to try multiple selectors
        function trySelectors(selectorList, attribute = 'textContent') {
            for (const selector of selectorList) {
                try {
                    const element = document.querySelector(selector);
                    if (element) {
                        const value = attribute === 'textContent' ? 
                            element.textContent.trim() : 
                            element.getAttribute(attribute);
                        if (value && value.length > 0) {
                            return value;
                        }
                    }
                } catch (e) {
                    continue;
                }
            }
            return null;
        }

        // Extract product name
        productData.name = trySelectors(selectors.productName);

        // Extract price
        productData.price = trySelectors(selectors.price);

        // Extract brand
        productData.brand = trySelectors(selectors.brand);

        // Extract description
        productData.description = trySelectors(selectors.description);

        // Extract product image
        const imageSelectors = [
            '.product-image img',
            '.product-photo img',
            '.product-gallery img',
            '.product-images img',
            '.main-image img',
            '.hero-image img',
            'img[alt*="product"]',
            'img[class*="product"]'
        ];
        productData.image = trySelectors(imageSelectors, 'src');

        // Extract availability
        const availabilitySelectors = [
            '.availability',
            '.stock',
            '.in-stock',
            '.out-of-stock',
            '[class*="availability"]',
            '[class*="stock"]'
        ];
        productData.availability = trySelectors(availabilitySelectors);

        // Extract rating
        const ratingSelectors = [
            '.rating',
            '.stars',
            '.review-rating',
            '[class*="rating"]',
            '[class*="star"]'
        ];
        productData.rating = trySelectors(ratingSelectors);

        // Extract review count
        const reviewSelectors = [
            '.reviews-count',
            '.review-count',
            '.num-reviews',
            '[class*="review"]'
        ];
        productData.reviews = trySelectors(reviewSelectors);

        // Extract category
        const categorySelectors = [
            '.breadcrumb',
            '.category',
            '.product-category',
            '[class*="breadcrumb"]',
            '[class*="category"]'
        ];
        productData.category = trySelectors(categorySelectors);

        // Extract SKU
        const skuSelectors = [
            '.sku',
            '.product-sku',
            '.item-number',
            '[class*="sku"]',
            '[class*="item-number"]'
        ];
        productData.sku = trySelectors(skuSelectors);

        // Store raw page data for debugging
        productData.rawData = {
            title: document.title,
            url: window.location.href,
            hasAddToCart: document.querySelector('button[class*="add-to-cart"], .add-to-cart, [data-testid*="add-to-cart"]') !== null,
            hasPrice: document.querySelector('.price, [class*="price"]') !== null,
            hasProductImages: document.querySelector('img[class*="product"], .product-image img') !== null
        };

        return productData;
    }

    /**
     * Save product data to extension storage
     * @param {Object} productData - Product data to save
     * @param {string} filename - Optional custom filename
     * @returns {Promise<string>} Success message
     */
    async saveProductData(productData, filename = null) {
        try {
            if (!productData || !productData.metadata) {
                throw new Error('Invalid product data');
            }

            // Generate filename if not provided
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const domain = productData.metadata.domain.replace(/[^a-zA-Z0-9.-]/g, '_');
            const productName = productData.name ? 
                productData.name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').substring(0, 50) : 
                'unknown_product';
            const defaultFilename = `product_${domain}_${productName}_${timestamp}.json`;
            const finalFilename = filename || defaultFilename;

            // Format data for output
            const outputData = {
                scrapedAt: new Date().toISOString(),
                product: productData,
                extractionInfo: {
                    success: true,
                    hasProductName: !!productData.name,
                    hasPrice: !!productData.price,
                    hasImage: !!productData.image,
                    isProductPage: productData.rawData?.hasAddToCart || productData.rawData?.hasPrice
                }
            };

            // Save to extension storage
            const storageKey = `scraped_product_${Date.now()}`;
            await chrome.storage.local.set({
                [storageKey]: {
                    filename: finalFilename,
                    data: outputData,
                    timestamp: new Date().toISOString()
                }
            });

            // Also save to a list of all scraped products
            const { scrapedProducts = [] } = await chrome.storage.local.get(['scrapedProducts']);
            scrapedProducts.push({
                key: storageKey,
                filename: finalFilename,
                productName: productData.name || 'Unknown Product',
                domain: productData.metadata.domain,
                timestamp: new Date().toISOString(),
                url: productData.metadata.url
            });
            
            await chrome.storage.local.set({ scrapedProducts });

            return `Product data saved to extension storage as ${finalFilename}`;
        } catch (error) {
            console.error('Error saving product data:', error);
            throw error;
        }
    }

    /**
     * Main function: detect product page, extract data, and save to JSON
     * @param {string} filename - Optional custom filename
     * @returns {Promise<string>} Success message
     */
    async scrapeAndSave(filename = null) {
        try {
            // Check if current page is a product page
            const isProduct = await this.isProductPage();
            if (!isProduct) {
                throw new Error('Current page does not appear to be a product page');
            }

            // Extract product data
            const productData = await this.extractProductData();
            
            // Check if we got any useful data
            if (!productData.name && !productData.price) {
                throw new Error('Could not extract product information from this page');
            }

            // Save to JSON file
            const result = await this.saveProductData(productData, filename);
            return result;
        } catch (error) {
            console.error('Error in scrapeAndSave:', error);
            throw error;
        }
    }

    /**
     * Get product data without saving
     * @returns {Promise<Object>} Product data object
     */
    async getProductData() {
        const isProduct = await this.isProductPage();
        if (!isProduct) {
            throw new Error('Current page does not appear to be a product page');
        }
        return await this.extractProductData();
    }

    /**
     * Get all scraped products from storage
     * @returns {Promise<Array>} Array of scraped product summaries
     */
    async getAllScrapedProducts() {
        try {
            const { scrapedProducts = [] } = await chrome.storage.local.get(['scrapedProducts']);
            return scrapedProducts;
        } catch (error) {
            console.error('Error getting scraped products:', error);
            return [];
        }
    }

    /**
     * Get specific scraped product data by key
     * @param {string} key - Storage key for the product
     * @returns {Promise<Object>} Full product data
     */
    async getScrapedProduct(key) {
        try {
            const result = await chrome.storage.local.get([key]);
            return result[key] || null;
        } catch (error) {
            console.error('Error getting scraped product:', error);
            return null;
        }
    }

    /**
     * Delete a scraped product from storage
     * @param {string} key - Storage key for the product
     * @returns {Promise<boolean>} Success status
     */
    async deleteScrapedProduct(key) {
        try {
            await chrome.storage.local.remove([key]);
            
            // Remove from scraped products list
            const { scrapedProducts = [] } = await chrome.storage.local.get(['scrapedProducts']);
            const updatedList = scrapedProducts.filter(item => item.key !== key);
            await chrome.storage.local.set({ scrapedProducts: updatedList });
            
            return true;
        } catch (error) {
            console.error('Error deleting scraped product:', error);
            return false;
        }
    }

    /**
     * Clear all scraped products from storage
     * @returns {Promise<boolean>} Success status
     */
    async clearAllScrapedProducts() {
        try {
            // Get all scraped product keys
            const { scrapedProducts = [] } = await chrome.storage.local.get(['scrapedProducts']);
            const keysToRemove = scrapedProducts.map(item => item.key);
            
            // Remove all product data
            await chrome.storage.local.remove(keysToRemove);
            
            // Clear the scraped products list
            await chrome.storage.local.remove(['scrapedProducts']);
            
            return true;
        } catch (error) {
            console.error('Error clearing scraped products:', error);
            return false;
        }
    }

    /**
     * Export all scraped products as a single JSON file
     * @returns {Promise<string>} Success message
     */
    async exportAllScrapedProducts() {
        try {
            const { scrapedProducts = [] } = await chrome.storage.local.get(['scrapedProducts']);
            
            if (scrapedProducts.length === 0) {
                throw new Error('No scraped products found');
            }

            // Get all product data
            const allData = [];
            for (const product of scrapedProducts) {
                const productData = await this.getScrapedProduct(product.key);
                if (productData) {
                    allData.push(productData);
                }
            }

            // Create export data
            const exportData = {
                exportedAt: new Date().toISOString(),
                totalProducts: allData.length,
                products: allData
            };

            // Generate filename
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `ecocart_export_${timestamp}.json`;

            // Download as JSON file
            const jsonString = JSON.stringify(exportData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const downloadLink = document.createElement('a');
            downloadLink.href = url;
            downloadLink.download = filename;
            downloadLink.style.display = 'none';
            
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            
            URL.revokeObjectURL(url);

            return `Exported ${allData.length} products to ${filename}`;
        } catch (error) {
            console.error('Error exporting scraped products:', error);
            throw error;
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProductScraper;
}

// Make available globally for browser use
if (typeof window !== 'undefined') {
    window.ProductScraper = ProductScraper;
}
