// Simple Firefox extension popup script
document.addEventListener('DOMContentLoaded', function() {
  console.log('Simple Firefox extension popup loaded');
  const ecoscaleTitle = document.querySelector('.ecoscale-title');
  const urlTitle = document.querySelector('.url-title');
  const CANDIDATE_BASE_URLS = [
    'http://localhost:5057',
    'http://127.0.0.1:5057',
    'http://localhost:5060',
    'http://127.0.0.1:5060'
  ];
  let BASE_URL = CANDIDATE_BASE_URLS[0];

  function setEcoScaleText(text) {
    if (ecoscaleTitle) ecoscaleTitle.textContent = `EcoScore: ${text}`;
  }

  async function ensureBackend() {
    for (const candidate of CANDIDATE_BASE_URLS) {
      const healthUrl = `${candidate}/health`;
      console.log('[EcoCart] Pinging backend health:', healthUrl);
      try {
        const r = await fetch(healthUrl, { method: 'GET' });
        console.log('[EcoCart] Health status:', r.status, 'for', candidate);
        if (!r.ok) continue;
        BASE_URL = candidate;
        return true;
      } catch (e) {
        console.warn('[EcoCart] Health check failed for', candidate, e);
      }
    }
    console.error('[EcoCart] Backend not reachable on any candidate host.');
    setEcoScaleText('Error (backend not reachable)');
    return false;
  }

  async function getActiveTabInfo() {
    console.log('[EcoCart] Querying active tab...');
    return new Promise((resolve) => {
      try {
        browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
          const tab = tabs && tabs[0];
          const info = { url: tab ? tab.url : '', title: tab ? tab.title : '' };
          console.log('[EcoCart] Active tab (browser):', info);
          resolve(info);
        }).catch(() => resolve({ url: '', title: '' }));
      } catch (e) {
        // Fallback for Chrome-like API in some contexts
        try {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs && tabs[0];
            const info = { url: tab ? tab.url : '', title: tab ? tab.title : '' };
            console.log('[EcoCart] Active tab (chrome):', info);
            resolve(info);
          });
        } catch (e2) {
          console.error('[EcoCart] tabs.query failed:', e, e2);
          resolve({ url: '', title: '' });
        }
      }
    });
  }

  // Judge only to get ecoscore; do not fetch alternatives here
  async function judgeOnly(name, link) {
    try {
      setEcoScaleText('Loading...');
      const payload = { product: { name, link }, model: 'gpt-4o-mini' };
      const url = `${BASE_URL}/judge`;
      console.log('[EcoCart] Calling /judge:', url, 'payload:', payload);
      const res = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      const raw = await res.text();
      console.log('[EcoCart] /judge raw body:', raw);
      if (!res.ok) throw new Error(`Judge failed: ${res.status}`);
      const data = JSON.parse(raw);
      const score = typeof data.ecoscore === 'number' ? data.ecoscore : null;
      if (score !== null) setEcoScaleText(String(score)); else setEcoScaleText('Unknown');

      const swipeInterface = document.querySelector('.swipe-interface');
      const actions = document.querySelector('.ecoscore-actions');
      const btn = document.getElementById('find-eco-btn');
      if (score !== null && score >= 3.0) {
        if (swipeInterface) swipeInterface.style.display = 'none';
        if (actions) actions.style.display = 'none';
        if (btn) btn.style.display = 'none';
        const thankYou = document.createElement('div');
        thankYou.style.marginTop = '20px';
        thankYou.style.textAlign = 'center';
        thankYou.style.color = '#ffffff';
        thankYou.style.fontSize = '20px';
        thankYou.style.textShadow = '0 1px 2px rgba(0,0,0,0.2)';
        thankYou.textContent = 'Thanks for choosing an environmentally friendlier option!';
        document.querySelector('.popup-container')?.appendChild(thankYou);
      } else if (score !== null && score < 3.0) {
        if (actions) actions.style.display = 'block';
        if (btn && !btn.dataset.bound) {
          btn.addEventListener('click', () => {
            onFindEcoAlternativesClick(name, link);
          }, { once: true });
          btn.dataset.bound = '1';
        }
      }
    } catch (e) {
      console.error('[EcoCart] Error in judgeOnly:', e);
      setEcoScaleText('Error');
    }
  }

  async function judgeThenSearchIfNeeded(name, link) {
    try {
      // Call /search which always judges first and may skip alternatives
      if (urlTitle) urlTitle.textContent = `URL: ${link || '(none)'}`;
      setEcoScaleText('Loading...');
      const payload = { product: { name, link }, limit: 5, model: 'gpt-4o-mini' };
      const url = `${BASE_URL}/search`;
      console.log('[EcoCart] Calling /search:', url, 'payload:', payload);
      const res = await fetch(`${BASE_URL}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      console.log('[EcoCart] /search status:', res.status);
      const raw = await res.text();
      console.log('[EcoCart] /search raw body:', raw);
      if (!res.ok) {
        setEcoScaleText(`Error (status ${res.status})`);
        throw new Error(`Search failed: ${res.status} body=${raw}`);
      }
      let data;
      try {
        data = JSON.parse(raw);
      } catch (e) {
        setEcoScaleText('Error (invalid JSON)');
        throw new Error('Search returned non-JSON');
      }

      // Update UI: prefer ecoscore if present, else impact
      const score = typeof data.ecoscore === 'number' ? data.ecoscore : null;
      if (score !== null) setEcoScaleText(String(score));
      else setEcoScaleText(data.impact || 'Unknown');

      // If ecoscore >= 3.0, hide swipe UI and show a thank-you message; 
      // If ecoscore < 3.0, hide swipe UI and show a button to reveal it on demand
      const swipeInterface = document.querySelector('.swipe-interface');
      if (score !== null && score >= 3.0) {
        if (swipeInterface) swipeInterface.style.display = 'none';
        const actions = document.querySelector('.ecoscore-actions');
        if (actions) actions.style.display = 'none';
        const btnHide = document.getElementById('find-eco-btn');
        if (btnHide) btnHide.style.display = 'none';
        const thankYou = document.createElement('div');
        thankYou.style.marginTop = '20px';
        thankYou.style.textAlign = 'center';
        thankYou.style.color = '#ffffff';
        thankYou.style.fontSize = '20px';
        thankYou.style.textShadow = '0 1px 2px rgba(0,0,0,0.2)';
        thankYou.textContent = 'Thanks for choosing an environmentally friendlier option!';
        document.querySelector('.popup-container')?.appendChild(thankYou);
      } else if (score !== null && score < 3.0) {
        if (swipeInterface) swipeInterface.style.display = 'none';
        const actions = document.querySelector('.ecoscore-actions');
        if (actions) actions.style.display = 'block';
        const btn = document.getElementById('find-eco-btn');
        if (btn) btn.style.display = 'inline-block';
        if (Array.isArray(data.results)) {
          console.log('Alternatives (preloaded):', data.results);
        }
        // Proceed immediately to fetch and render alternatives on this click flow
        onFindEcoAlternativesClick(name, link);
      } else if (Array.isArray(data.results)) {
        console.log('Alternatives:', data.results);
      }
    } catch (e) {
      console.error('[EcoCart] Error in judgeThenSearchIfNeeded:', e);
      setEcoScaleText('Error');
    }
  }

   // Check if URL is Amazon
   function isAmazonUrl(url) {
     if (!url) return false;
     try {
       const urlObj = new URL(url);
       return urlObj.hostname.includes('amazon.com') || 
              urlObj.hostname.includes('amazon.ca') || 
              urlObj.hostname.includes('amazon.co.uk') || 
              urlObj.hostname.includes('amazon.de') || 
              urlObj.hostname.includes('amazon.fr') || 
              urlObj.hostname.includes('amazon.it') || 
              urlObj.hostname.includes('amazon.es') || 
              urlObj.hostname.includes('amazon.co.jp') || 
              urlObj.hostname.includes('amazon.in') || 
              urlObj.hostname.includes('amazon.com.au');
     } catch (e) {
       return false;
     }
   }

   // Kick off once popup opens: get active tab and use tab.title as product name (user can refine later)
   (async () => {
     const healthy = await ensureBackend();
     if (!healthy) return;
     const { url, title } = await getActiveTabInfo();
     if (!url) {
       console.warn('[EcoCart] No active tab URL detected.');
       setEcoScaleText('Error (no URL)');
       return;
     }
     
     // Check if it's an Amazon URL
     if (!isAmazonUrl(url)) {
       console.log('[EcoCart] Non-Amazon URL detected:', url);
       setEcoScaleText('Website is not Supported');
       if (urlTitle) urlTitle.textContent = `URL: ${url}`;
       return;
     }
     
     console.log('[EcoCart] Proceeding with Amazon product:', { name: title || 'Current Page', link: url });
     judgeOnly(title || 'Current Page', url);
   })();
  
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
  
  // Try to load an image source; resolve true on success, false on error
  function tryLoadImage(img, src) {
    return new Promise((resolve) => {
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = src;
    });
  }

  function buildFaviconUrlFrom(firstUrl) {
    try {
      const u = new URL(firstUrl);
      return `https://www.google.com/s2/favicons?sz=128&domain=${u.hostname}`;
    } catch (_) {
      return '';
    }
  }

  async function insertPreviewImage(panelItem, first) {
    if (!panelItem || !first) return false;
    panelItem.innerHTML = '';
    const img = document.createElement('img');
    img.style.maxWidth = '100%';
    img.style.maxHeight = '100%';
    img.style.objectFit = 'contain';
    img.referrerPolicy = 'no-referrer';

    // Candidate sources: prefer provided image (forcing https), then domain favicon
    const candidates = [];
    if (first.image) {
      const forced = first.image.replace(/^http:/, 'https:');
      candidates.push(forced);
    }
    if (first.url) {
      const fav = buildFaviconUrlFrom(first.url);
      if (fav) candidates.push(fav);
    }

    for (const src of candidates) {
      const ok = await tryLoadImage(img, src);
      if (ok) {
        panelItem.appendChild(img);
        return true;
      }
    }

    // Fallback: text placeholder
    const placeholder = document.createElement('div');
    placeholder.style.padding = '10px';
    placeholder.style.textAlign = 'center';
    placeholder.style.color = '#666';
    placeholder.textContent = first.name || 'Alternative';
    panelItem.appendChild(placeholder);
    return false;
  }

  async function onFindEcoAlternativesClick(name, link) {
    try {
      const swipeInterface = document.querySelector('.swipe-interface');
      const actions = document.querySelector('.ecoscore-actions');
      const btn = document.getElementById('find-eco-btn');
      if (actions) actions.style.display = 'none';
      try { if (btn) btn.remove(); } catch (_) { if (btn) btn.style.display = 'none'; }
      if (swipeInterface) swipeInterface.style.display = 'flex';
      try { updateContentPositions(); } catch (_) {}
      try {
        const l = document.querySelector('.left-arrow');
        const r = document.querySelector('.right-arrow');
        if (l) l.style.display = 'flex';
        if (r) r.style.display = 'flex';
      } catch (_) {}

      setEcoScaleText('Finding alternatives...');
      const altPayload = { product: { name, link }, limit: 5, model: 'gpt-4o-mini' };
      const altRes = await fetch(`${BASE_URL}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(altPayload)
      });
      const altRaw = await altRes.text();
      console.log('[EcoCart] /search (find-eco) raw body:', altRaw);
      if (!altRes.ok) throw new Error(`alt search failed: ${altRes.status}`);
      let altData;
      try { altData = JSON.parse(altRaw); } catch (_) { throw new Error('alt non-JSON'); }

      const altSummary = document.querySelector('.alt-summary');
      const altNameEl = document.querySelector('.alt-name');
      const altScoreEl = document.querySelector('.alt-ecoscore');
      let panelItem = document.querySelector('.product-panel .product-content.current .content-item');
      if (!panelItem) panelItem = document.querySelector('.product-panel .content-item');
      if (altSummary && altNameEl && altScoreEl) {
        altSummary.style.display = 'block';
        const first = Array.isArray(altData.results) && altData.results.length > 0 ? altData.results[0] : null;
        if (first) {
          altNameEl.textContent = first.name || 'Alternative';
          // Put preview into the white box with robust fallback
          await insertPreviewImage(panelItem, first);

          // Compute and display NEW EcoScore for the alternative via /judge
          let newScore = null;
          try {
            if (first.url || first.name) {
              const judgeRes = await fetch(`${BASE_URL}/judge`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ product: { name: first.name || '', link: first.url || '' }, model: 'gpt-4o-mini' })
              });
              const judgeRaw = await judgeRes.text();
              console.log('[EcoCart] /judge (alt) raw body:', judgeRaw);
              if (judgeRes.ok) {
                try {
                  const judgeData = JSON.parse(judgeRaw);
                  if (typeof judgeData.ecoscore === 'number') newScore = judgeData.ecoscore;
                } catch (_) {}
              }
            }
          } catch (e) {
            console.warn('[EcoCart] Failed to compute alt ecoscore:', e);
          }

          if (newScore !== null) {
            setEcoScaleText(`New EcoScore: ${newScore}`);
            altScoreEl.textContent = `New EcoScore: ${newScore}`;
          } else {
            const fallbackScore = typeof altData.ecoscore === 'number' ? altData.ecoscore : null;
            if (fallbackScore !== null) setEcoScaleText(`New EcoScore: ${fallbackScore}`);
            altScoreEl.textContent = fallbackScore !== null ? `New EcoScore: ${fallbackScore}` : '';
          }

          // Attach link to green arrow
          const rightArrow = document.querySelector('.right-arrow');
          if (rightArrow && first.url) {
            rightArrow.style.cursor = 'pointer';
            rightArrow.addEventListener('click', () => {
              try { browser.tabs.create({ url: first.url }); } catch (e) {
                try { chrome.tabs.create({ url: first.url }); } catch (e2) {}
              }
            }, { once: true });
          }
        }
      }

      const addToCart = document.querySelector('.add-to-cart-section');
      if (addToCart) addToCart.style.display = 'block';
    } catch (err) {
      console.error('[EcoCart] Find alternatives failed:', err);
      setEcoScaleText('Error');
    }
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
