# Eco-Friendly Alternatives Browser Extension

A browser extension that analyzes Amazon product pages and suggests sustainable, eco-friendly alternatives to help users make more environmentally conscious shopping decisions.

## Features

- **Automatic Product Analysis**: Scans Amazon product pages to extract product information
- **Smart Matching**: Uses product categories, keywords, and brands to find relevant alternatives
- **Comprehensive Database**: Curated list of eco-friendly products with environmental benefits
- **User-Friendly Interface**: Clean popup and inline panel design
- **Real-time Recommendations**: Shows alternatives directly on the product page
- **Environmental Certifications**: Highlights products with credible sustainability certifications

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension folder
5. The extension will be installed and ready to use

## Usage

1. Navigate to any Amazon product page
2. Click the extension icon in your browser toolbar
3. View eco-friendly alternatives in the popup
4. Click on any alternative to visit the product page
5. The extension also injects a recommendations panel directly on the product page

## File Structure

```
├── manifest.json          # Extension configuration
├── content.js            # Content script for page analysis
├── content.css           # Styles for injected content
├── popup.html            # Extension popup interface
├── popup.css             # Popup styling
├── popup.js              # Popup functionality
├── background.js         # Background service worker
├── alternatives.json     # Database of eco-friendly alternatives
└── README.md            # This file
```

## How It Works

### Product Analysis
The extension analyzes Amazon product pages by:
- Extracting product title, category, brand, and price
- Identifying relevant keywords and product attributes
- Categorizing products into general categories (home, clothing, beauty, etc.)

### Alternative Matching
The recommendation engine matches products to alternatives using:
- **Category matching**: Products are matched to relevant eco-friendly categories
- **Keyword matching**: Specific keywords trigger relevant alternatives
- **Brand alternatives**: Known brands are matched to sustainable alternatives

### Database Structure
The alternatives database includes:
- **Categories**: Organized by product type (home, clothing, beauty, etc.)
- **Keywords**: Specific terms that trigger relevant alternatives
- **Brands**: Alternative brands for popular products
- **Product details**: Name, description, benefits, price, and URL for each alternative

## Supported Product Categories

- **Home & Kitchen**: Sustainable kitchenware, cleaning products, storage solutions
- **Clothing & Fashion**: Ethical fashion brands, sustainable materials
- **Beauty & Personal Care**: Natural cosmetics, zero-waste products
- **Electronics**: Repairable devices, fair-trade electronics
- **Garden & Outdoor**: Eco-friendly gardening supplies, outdoor gear
- **Office Supplies**: Recycled paper, sustainable desk accessories

## Environmental Benefits Highlighted

- **Certifications**: Fair Trade, Organic, B-Corp, FSC Certified
- **Materials**: Recycled, biodegradable, renewable, non-toxic
- **Practices**: Carbon neutral, zero waste, refillable, repairable
- **Impact**: Water conservation, waste reduction, renewable energy

## Customization

You can customize the extension by:
- Adding new alternatives to `alternatives.json`
- Modifying the matching logic in `content.js`
- Updating the styling in `popup.css` and `content.css`
- Adding new product categories or keywords

## Browser Support

- Chrome (Manifest V3)
- Edge (Chromium-based)
- Other Chromium-based browsers

## Privacy

This extension:
- Only analyzes product pages on Amazon domains
- Does not collect or store personal data
- All processing happens locally in your browser
- No data is sent to external servers

## Contributing

To contribute to this project:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source and available under the MIT License.

## Support

For support or questions, please open an issue in the repository or contact the development team.

---

**Making shopping more sustainable, one product at a time. 🌱**
