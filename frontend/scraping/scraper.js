/**
 * Main Scraper Entry Point
 * Simple interface for product scraping functionality
 */

// Import the ProductScraper class
import { ProductScraper } from './productScraper.js';

class EcoCartScraper {
    constructor() {
        this.productScraper = new ProductScraper();
    }

    /**
     * Scrape current product page and save to JSON
     * @param {string} filename - Optional custom filename
     * @returns {Promise<string>} Success message
     */
    async scrapeProduct(filename = null) {
        try {
            return await this.productScraper.scrapeAndSave(filename);
        } catch (error) {
            console.error('Scraping failed:', error);
            throw error;
        }
    }

    /**
     * Check if current page is a product page
     * @returns {Promise<boolean>} True if product page
     */
    async isProductPage() {
        return await this.productScraper.isProductPage();
    }

    /**
     * Get product data without saving
     * @returns {Promise<Object>} Product data
     */
    async getProductData() {
        return await this.productScraper.getProductData();
    }

    /**
     * Quick scrape - attempts to scrape and returns result
     * @returns {Promise<Object>} Result object with success status and message
     */
    async quickScrape() {
        try {
            const isProduct = await this.isProductPage();
            if (!isProduct) {
                return {
                    success: false,
                    message: 'Current page does not appear to be a product page',
                    data: null
                };
            }

            const productData = await this.getProductData();
            const filename = await this.scrapeProduct();
            
            return {
                success: true,
                message: filename,
                data: productData
            };
        } catch (error) {
            return {
                success: false,
                message: error.message,
                data: null
            };
        }
    }

    /**
     * Get all scraped products from storage
     * @returns {Promise<Array>} Array of scraped product summaries
     */
    async getAllScrapedProducts() {
        return await this.productScraper.getAllScrapedProducts();
    }

    /**
     * Get specific scraped product data
     * @param {string} key - Storage key for the product
     * @returns {Promise<Object>} Full product data
     */
    async getScrapedProduct(key) {
        return await this.productScraper.getScrapedProduct(key);
    }

    /**
     * Delete a scraped product from storage
     * @param {string} key - Storage key for the product
     * @returns {Promise<boolean>} Success status
     */
    async deleteScrapedProduct(key) {
        return await this.productScraper.deleteScrapedProduct(key);
    }

    /**
     * Clear all scraped products from storage
     * @returns {Promise<boolean>} Success status
     */
    async clearAllScrapedProducts() {
        return await this.productScraper.clearAllScrapedProducts();
    }

    /**
     * Export all scraped products as a single JSON file
     * @returns {Promise<string>} Success message
     */
    async exportAllScrapedProducts() {
        return await this.productScraper.exportAllScrapedProducts();
    }
}

// Create global instance
const ecoCartScraper = new EcoCartScraper();

// Export for module use
export { EcoCartScraper, ProductScraper };

// Make available globally for browser use
if (typeof window !== 'undefined') {
    window.EcoCartScraper = EcoCartScraper;
    window.ProductScraper = ProductScraper;
    window.ecoCartScraper = ecoCartScraper;
}

// Auto-scrape on load (optional - uncomment to enable)
// document.addEventListener('DOMContentLoaded', async () => {
//     try {
//         const result = await ecoCartScraper.quickScrape();
//         if (result.success) {
//             console.log('Product scraped successfully:', result.message);
//         } else {
//             console.log('Scraping failed:', result.message);
//         }
//     } catch (error) {
//         console.error('Auto-scraping failed:', error);
//     }
// });
