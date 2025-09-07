# 🌱 EcoCart - Environmental Impact Browser Extension

**Aiming for "🌱 Best AI for Environmental Impact" in AGI Ventures Canada's Hackathon 3.0**

EcoCart is an innovative browser extension that helps users make environmentally conscious shopping decisions by analyzing products and suggesting sustainable alternatives. Built with AI-powered environmental impact assessment, EcoCart transforms your shopping experience into a force for positive environmental change.

## 🌟 Features

### 🔍 **Smart Environmental Analysis**
- **EcoScore Rating**: AI-powered environmental impact scoring from 1.0 (worst) to 5.0 (best)
- **Real-time Product Assessment**: Instant analysis of products on Amazon and other supported sites
- **Material Recognition**: Advanced detection of sustainable materials (paper, bamboo, metal, glass, etc.)

### 🛒 **Intelligent Alternative Suggestions**
- **AI-Powered Search**: Find environmentally friendlier alternatives using advanced web search
- **Amazon Integration**: Seamless integration with Amazon's global marketplaces
- **Price Comparison**: Compare prices alongside environmental impact
- **Image Preview**: Visual product previews with automatic image extraction

### 🎯 **Interactive Shopping Experience**
- **Swipe Interface**: Tinder-like interface to browse eco-friendly alternatives
- **Smart Cart**: Build your eco-friendly shopping cart with persistent storage
- **Visual Feedback**: Color-coded environmental impact indicators
- **Persistent State**: Remembers your browsing session across popup opens

### 🌍 **Environmental Impact Focus**
- **Sustainability Metrics**: Comprehensive evaluation of materials, reusability, and lifecycle
- **Certification Recognition**: Identifies credible sustainability certifications
- **Waste Reduction**: Promotes reusable, recyclable, and compostable alternatives
- **Educational Tool**: Learn about environmental impact through interactive scoring

## 🏗️ Architecture

### Backend (Flask API)
- **AI Integration**: OpenAI GPT models for environmental analysis and product search
- **Image Processing**: Automatic product image extraction and proxy serving
- **CORS Support**: Cross-origin resource sharing for browser extension compatibility

### Frontend (Browser Extension)
- **Cross-Browser Support**: Compatible with Firefox browsers
- **Modern UI**: Beautiful, responsive interface with smooth animations
- **Local Storage**: Persistent cart and session management
- **Real-time Updates**: Dynamic content loading and state management

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Node.js (for frontend development)
- OpenAI API key

### Backend Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/VanBaNguyen/EcoCart.git
   cd EcoCart/backend
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Environment Configuration**
   Create a `.env` file in the backend directory:
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   OPENAI_MODEL=gpt-4o-mini
   PORT=5057
   ```

4. **Start the backend server**
   ```bash
   python app.py
   ```
   The API will be available at `http://localhost:5057`

### Frontend Setup (Browser Extension)

1. **Navigate to frontend directory**
   ```bash
   cd ../frontend
   ```

2. **Load the extension**
   - **Firefox**: Open `about:debugging`, click "This Firefox", then "Load Temporary Add-on" and select `manifest.json`

3. **Configure permissions**
   The extension will request permissions for:
   - Active tab access (to read current page)
   - Local storage (for cart persistence)
   - Backend API access (for environmental analysis)

## 📱 Usage

### Basic Workflow

1. **Navigate to Amazon**: Visit any Amazon product page
2. **Open EcoCart**: Click the EcoCart extension icon
3. **View EcoScore**: See the environmental impact rating (1.0-5.0)
4. **Find Alternatives**: If score < 3.0, click "Find Eco Alternatives"
5. **Browse Options**: Swipe through sustainable alternatives
6. **Build Cart**: Add preferred items to your eco-friendly cart
7. **Shop Responsibly**: Make informed environmental choices

### EcoScore Interpretation

- **🟢 4.0-5.0**: Highly sustainable (durable materials, long lifespan, minimal waste)
- **🟡 3.0-3.9**: Mixed/unknown materials, partial recyclability, average footprint
- **🔴 1.0-2.9**: Predominantly single-use plastic, limited recyclability, short lifespan

## 🛠️ API Endpoints

### `/health` (GET)
Health check endpoint for backend connectivity.

### `/search` (POST)
Find environmentally friendly alternatives for products or topics.
```json
{
  "query": "sustainable water bottles",
  "product": {
    "name": "Product Name",
    "link": "https://amazon.com/product-url"
  },
  "limit": 5,
  "model": "gpt-4o-mini"
}
```

### `/judge` (POST)
Assess environmental impact of a specific product.
```json
{
  "product": {
    "name": "Product Name",
    "link": "https://amazon.com/product-url"
  },
  "model": "gpt-4o-mini"
}
```

### `/image-proxy` (GET)
Proxy service for product images to avoid CORS issues.
```
GET /image-proxy?url=https://example.com/image.jpg
```

## 🧪 Testing

### Backend Tests
```bash
cd backend
python test_judge_paper_straw_low.py
python test_search.py
```

### Frontend Testing
- Test on various Amazon product pages
- Verify cart persistence across browser sessions
- Check image loading and proxy functionality

## 🌱 Environmental Impact

EcoCart promotes sustainable shopping by:

- **Reducing Plastic Waste**: Encouraging reusable and biodegradable alternatives
- **Supporting Sustainable Brands**: Highlighting companies with environmental certifications
- **Educating Consumers**: Providing transparent environmental impact information
- **Promoting Circular Economy**: Favoring products with longer lifespans and recyclability

## 🔧 Development

### Project Structure
```
EcoCart/
├── backend/
│   ├── app.py              # Flask API server
│   ├── requirements.txt    # Python dependencies
│   └── test_*.py          # Backend tests
├── frontend/
│   ├── manifest.json      # Browser extension manifest
│   ├── popup.html         # Extension popup interface
│   ├── popup.css          # Styling and animations
│   ├── popup.js           # Extension logic and API integration
│   └── scraping/          # Web scraping utilities
└── README.md              # This file
```

### Key Technologies
- **Backend**: Flask, OpenAI API, BeautifulSoup, Requests
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **AI Models**: GPT-4o-mini for environmental analysis
- **Storage**: Browser extension local storage API

## 🤝 Contributing

We welcome contributions to make EcoCart even more impactful:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit changes**: `git commit -m 'Add amazing feature'`
4. **Push to branch**: `git push origin feature/amazing-feature`
5. **Open a Pull Request**

### Areas for Contribution
- Additional e-commerce platform support
- Enhanced AI model integration
- Improved environmental impact metrics
- UI/UX enhancements
- Performance optimizations

## 📄 License

This project is developed for AGI Ventures Canada's Hackathon 3.0. Please refer to the hackathon guidelines for usage and distribution terms.

## 🏆 Hackathon Goals

**Target Achievement**: "🌱 Best AI for Environmental Impact"

EcoCart demonstrates how AI can be harnessed to create meaningful environmental change by:
- Making sustainability accessible to everyday consumers
- Leveraging AI for real-time environmental impact assessment
- Creating an engaging, educational shopping experience
- Promoting conscious consumption and waste reduction

---

**Built with ❤️ for a sustainable future**

*EcoCart - Where every purchase is a vote for the planet* 🌍
