# EcoCart Product Scraper

A focused product scraping module that extracts product names and details from e-commerce product pages.

## Features

- **Product Detection**: Automatically detects if current page is a product page
- **Smart Extraction**: Uses multiple selectors to find product information
- **Extension Storage**: Saves scraped data to Chrome extension storage (no downloads)
- **Data Management**: View, delete, and export stored product data
- **Multi-Platform Support**: Works with various e-commerce sites

## Files

- `productScraper.js` - Core product scraping functionality
- `scraper.js` - Main entry point and simplified interface

## Usage

### Basic Product Scraping

```javascript
const scraper = new EcoCartScraper();
const result = await scraper.scrapeProduct();
console.log(result); // "Product data saved to extension storage as product_example.com_Amazing_Product_2024-01-01T12-00-00-000Z.json"
```

### Check if Page is Product Page

```javascript
const scraper = new EcoCartScraper();
const isProduct = await scraper.isProductPage();
console.log(isProduct); // true or false
```

### Get Product Data Without Saving

```javascript
const scraper = new EcoCartScraper();
const productData = await scraper.getProductData();
console.log(productData.name); // "Product Name"
console.log(productData.price); // "$29.99"
```

### Quick Scrape with Error Handling

```javascript
const scraper = new EcoCartScraper();
const result = await scraper.quickScrape();
if (result.success) {
    console.log('Success:', result.message);
    console.log('Product:', result.data);
} else {
    console.log('Failed:', result.message);
}
```

### Data Management

```javascript
const scraper = new EcoCartScraper();

// Get all scraped products
const products = await scraper.getAllScrapedProducts();
console.log('Total products:', products.length);

// Get specific product data
const productData = await scraper.getScrapedProduct('scraped_product_1234567890');

// Delete a product
await scraper.deleteScrapedProduct('scraped_product_1234567890');

// Clear all products
await scraper.clearAllScrapedProducts();

// Export all products as JSON file
const exportResult = await scraper.exportAllScrapedProducts();
console.log(exportResult); // "Exported 5 products to ecocart_export_2024-01-01T12-00-00-000Z.json"
```

## Extracted Data

The scraper extracts the following product information:

- **Product Name** - Main product title/name
- **Price** - Current price (sale or regular)
- **Brand** - Product brand/manufacturer
- **Description** - Product description
- **Image** - Main product image URL
- **Availability** - Stock status
- **Rating** - Customer rating
- **Reviews** - Number of reviews
- **Category** - Product category/breadcrumb
- **SKU** - Product SKU/item number

## JSON Output Format

```json
{
  "scrapedAt": "2024-01-01T12:00:00.000Z",
  "product": {
    "name": "Amazing Wireless Headphones",
    "price": "$99.99",
    "brand": "TechBrand",
    "description": "High-quality wireless headphones with noise cancellation...",
    "image": "https://example.com/images/headphones.jpg",
    "availability": "In Stock",
    "rating": "4.5 stars",
    "reviews": "1,234 reviews",
    "category": "Electronics > Audio > Headphones",
    "sku": "TB-WH-001",
    "rawData": {
      "title": "Amazing Wireless Headphones - TechBrand",
      "url": "https://example.com/products/wireless-headphones",
      "hasAddToCart": true,
      "hasPrice": true,
      "hasProductImages": true
    }
  },
  "extractionInfo": {
    "success": true,
    "hasProductName": true,
    "hasPrice": true,
    "hasImage": true,
    "isProductPage": true
  }
}
```

## Supported E-commerce Sites

The scraper uses intelligent selectors that work with:

- Amazon
- eBay
- Shopify stores
- WooCommerce stores
- Magento stores
- Custom e-commerce sites
- And many more...

## Storage Location

The scraped product data is stored in the Chrome extension's local storage, not in the user's downloads folder. This means:

- **No file downloads** - Data stays within the extension
- **Persistent storage** - Data persists between browser sessions
- **Privacy focused** - Data doesn't clutter the user's file system
- **Easy management** - Built-in functions to view, delete, and export data

## Browser Extension Integration

To use in a browser extension, add these permissions to your `manifest.json`:

```json
{
  "permissions": [
    "activeTab",
    "tabs",
    "scripting",
    "storage"
  ]
}
```

## Error Handling

The scraper includes comprehensive error handling:

- Detects if page is not a product page
- Handles missing product information gracefully
- Provides detailed error messages
- Returns structured success/failure results

## Requirements

- Chrome Extension APIs (`chrome.tabs`, `chrome.scripting`)
- Modern JavaScript (ES6+)
- No external dependencies
