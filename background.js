// Background script for the Eco-Friendly Alternatives browser extension
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Eco-Friendly Alternatives extension installed');
  
  // Set up context menu
  chrome.contextMenus.create({
    id: 'findEcoAlternatives',
    title: 'Find Eco-Friendly Alternatives',
    contexts: ['page'],
    documentUrlPatterns: [
      'https://*.amazon.com/*',
      'https://*.amazon.co.uk/*',
      'https://*.amazon.de/*',
      'https://*.amazon.fr/*',
      'https://*.amazon.ca/*',
      'https://*.amazon.com.au/*'
    ]
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'findEcoAlternatives') {
    // Send message to content script to analyze the page
    chrome.tabs.sendMessage(tab.id, { action: 'analyzePage' });
  }
});

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getProductData') {
    // This will be handled by the content script
    // The content script will respond directly
    return true;
  }
  
  if (request.action === 'openAlternatives') {
    // Open the alternatives in a new tab
    chrome.tabs.create({
      url: request.url
    });
  }
  
  if (request.action === 'logEvent') {
    // Log analytics events (if needed)
    console.log('Event logged:', request.event);
  }
});

// Handle tab updates to re-analyze when user navigates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Check if it's an Amazon product page
    if (isAmazonProductPage(tab.url)) {
      // Send message to content script to analyze the new page
      chrome.tabs.sendMessage(tabId, { action: 'analyzePage' }).catch(() => {
        // Content script might not be ready yet, ignore error
      });
    }
  }
});

// Helper function to check if URL is an Amazon product page
function isAmazonProductPage(url) {
  return url && (
    url.includes('amazon.com') ||
    url.includes('amazon.co.uk') ||
    url.includes('amazon.de') ||
    url.includes('amazon.fr') ||
    url.includes('amazon.ca') ||
    url.includes('amazon.com.au')
  ) && (
    url.includes('/dp/') ||
    url.includes('/product/') ||
    url.includes('/gp/product/')
  );
}

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  if (isAmazonProductPage(tab.url)) {
    // Open popup (this is handled by the manifest)
    return;
  } else {
    // Show notification for non-Amazon pages
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon.png',
      title: 'Eco-Friendly Alternatives',
      message: 'This extension works on Amazon product pages. Navigate to a product to see alternatives.'
    });
  }
});

// Handle storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  console.log('Storage changed:', changes, namespace);
});

// Initialize extension
chrome.runtime.onStartup.addListener(() => {
  console.log('Eco-Friendly Alternatives extension started');
});
