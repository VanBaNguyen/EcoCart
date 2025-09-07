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
    const s = String(text);
    const trimmed = s.trim();
    const hasLabel = /ecoscore/i.test(trimmed);
    const isNumeric = /^\d+(?:\.\d+)?$/.test(trimmed);
    if (ecoscaleTitle) {
      if (hasLabel) {
        ecoscaleTitle.textContent = trimmed;
      } else if (isNumeric) {
        ecoscaleTitle.textContent = `EcoScore: ${trimmed}`;
      } else {
        ecoscaleTitle.textContent = trimmed;
      }
    }
    // Color code the ecoscore and show warning if < 3
    try {
      const t = parseFloat(String(text).replace(/[^0-9.]/g, ''));
      ecoscaleTitle.classList.remove('ecoscore-low', 'ecoscore-mid', 'ecoscore-high');
      const warn = document.querySelector('.ecoscore-warning');
      if (!isNaN(t)) {
        if (t <= 2.5) {
          ecoscaleTitle.classList.add('ecoscore-low');
        } else if (t <= 3.5) {
          ecoscaleTitle.classList.add('ecoscore-mid');
        } else {
          ecoscaleTitle.classList.add('ecoscore-high');
        }
        if (warn) {
          if (t < 3) {
            warn.textContent = 'This product is not environmentally friendly.';
            warn.style.display = 'block';
          } else {
            warn.textContent = '';
            warn.style.display = 'none';
          }
        }
      } else if (warn) {
        warn.textContent = '';
        warn.style.display = 'none';
      }
    } catch (_) {}
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

  // Kick off once popup opens: try restore; otherwise judge-only
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
    
    // Try restoring prior state for this URL
    const restored = await tryRestoreAlternativesForUrl(url);
    if (restored) {
      return;
    }
    
    console.log('[EcoCart] Proceeding with Amazon product:', { name: title || 'Current Page', link: url });
    const productName = title || 'Current Page';
    try { prefetchAlternatives(productName, url); } catch (_) {}
    judgeOnly(productName, url);
  })();
  
  const productPanel = document.querySelector('.product-panel');
  const leftArrow = document.querySelector('.left-arrow');
  const rightArrow = document.querySelector('.right-arrow');
  const viewCartBtn = document.getElementById('view-cart-btn');
  const earthLogo = document.querySelector('.earth-logo');
  const helpPopover = document.querySelector('.help-popover');
  const contentPanels = document.querySelectorAll('.product-content');
  
  let currentIndex = 0;
  const totalPanels = contentPanels.length;
  let activePageUrl = '';
  let activeOriginalName = '';
  let activeOriginalLink = '';
  let currentAlternatives = null;
  let altScores = [];
  let alternativesFetchPromise = null;
  let prefetchedAltData = null;
  
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

  // Fetch the image as a blob and set as object URL to avoid remote loading issues
  async function tryLoadBlobImage(img, src) {
    try {
      const res = await fetch(src, { mode: 'cors' });
      if (!res.ok) return false;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      return new Promise((resolve) => {
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
      });
    } catch (_) {
      return false;
    }
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
      // Route through backend proxy to avoid CORS/cookie issues on Amazon
      candidates.push(`${BASE_URL}/image-proxy?url=${encodeURIComponent(forced)}`);
      candidates.push(forced);
    }
    // If we have the exact product page URL, try a direct product image heuristic
    if ((!first.image && !first.image_data_url) && first.url) {
      try {
        const u = new URL(first.url);
        // Some amazon pages expose images via a query param or predictable path; as a heuristic, add the page itself (proxy will extract)
        candidates.push(`${BASE_URL}/image-proxy?url=${encodeURIComponent(first.url)}`);
      } catch (_) {}
    }
    if (first.image_data_url) {
      candidates.unshift(first.image_data_url);
    }
    if (first.url) {
      const fav = buildFaviconUrlFrom(first.url);
      if (fav) candidates.push(fav);
    }

    for (const src of candidates) {
      let ok = await tryLoadImage(img, src);
      if (!ok) ok = await tryLoadBlobImage(img, src);
      if (ok) {
        panelItem.appendChild(img);
        return true;
      }
    }

    // Last resort: ask backend to extract and inline image for the specific product URL
    if (first.url) {
      try {
        const resp = await fetch(`${BASE_URL}/extract-image?url=${encodeURIComponent(first.url)}`);
        if (resp.ok) {
          const j = await resp.json();
          const inline = j && (j.image_data_url || j.image);
          if (inline) {
            const ok = await tryLoadImage(img, inline);
            if (!ok) {
              const ok2 = await tryLoadBlobImage(img, inline);
              if (ok2) {
                panelItem.appendChild(img);
                return true;
              }
            } else {
              panelItem.appendChild(img);
              return true;
            }
          }
        }
      } catch (_) {}
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

  // -------- Persistent state across popup sessions --------
  const STORAGE_KEY = 'ecocart_page_states';
  const CART_KEY = 'ecocart_cart_items';
  function storageGet(key) {
    return new Promise((resolve) => {
      try {
        if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
          browser.storage.local.get(key).then((data) => resolve(data || {})).catch(() => resolve({}));
        } else if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(key, (data) => resolve(data || {}));
        } else {
          resolve({});
        }
      } catch (_) { resolve({}); }
    });
  }
  function storageSet(obj) {
    return new Promise((resolve) => {
      try {
        if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
          browser.storage.local.set(obj).then(() => resolve(true)).catch(() => resolve(false));
        } else if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set(obj, () => resolve(true));
        } else {
          resolve(false);
        }
      } catch (_) { resolve(false); }
    });
  }
  async function loadAllStates() {
    const data = await storageGet(STORAGE_KEY);
    return (data && data[STORAGE_KEY]) || {};
  }
  async function saveAllStates(map) {
    return storageSet({ [STORAGE_KEY]: map });
  }
  function getPageKey(pageUrl) {
    try { return new URL(pageUrl).href; } catch (_) { return pageUrl || ''; }
  }
  async function loadPageState(pageUrl) {
    const map = await loadAllStates();
    return map[getPageKey(pageUrl)] || null;
  }
  async function savePageState(pageUrl, state) {
    const map = await loadAllStates();
    map[getPageKey(pageUrl)] = state;
    return saveAllStates(map);
  }

  async function loadCart() {
    const data = await storageGet(CART_KEY);
    return (data && data[CART_KEY]) || [];
  }

  async function saveCart(items) {
    return storageSet({ [CART_KEY]: items || [] });
  }

  function buildCartItemKey(item) {
    return `${item.url || ''}::${(item.name || '').toLowerCase()}`;
  }

  async function addCurrentToCart() {
    if (!currentAlternatives || !currentAlternatives[currentIndex]) return;
    const current = currentAlternatives[currentIndex];
    const items = await loadCart();
    const existingKeys = new Set(items.map(buildCartItemKey));
    const cand = {
      name: current.name || 'Alternative',
      url: current.url || '',
      image: current.image || '',
      score: Array.isArray(altScores) && typeof altScores[currentIndex] === 'number' ? altScores[currentIndex] : null
    };
    const key = buildCartItemKey(cand);
    if (!existingKeys.has(key)) {
      items.push(cand);
      await saveCart(items);
    }
  }

  async function renderCartView() {
    const cartContainer = document.querySelector('.cart-view');
    const cartList = document.querySelector('.cart-list');
    const swipeInterface = document.querySelector('.swipe-interface');
    const actions = document.querySelector('.ecoscore-actions');
    const altSummary = document.querySelector('.alt-summary');
    if (!cartContainer || !cartList) return;
    const items = await loadCart();
    cartList.innerHTML = '';
    for (const it of items) {
      const row = document.createElement('div');
      row.className = 'cart-item';
      const img = document.createElement('img');
      const src = it.image ? it.image.replace(/^http:/, 'https:') : (it.url ? buildFaviconUrlFrom(it.url) : '');
      if (src) img.src = src;
      const name = document.createElement('div');
      name.className = 'cart-item-name';
      name.textContent = (it.name || (it.url || 'Item')) + (it.price ? ` — ${it.price}` : '');
      row.appendChild(img);
      row.appendChild(name);
      if (it.url) {
        row.addEventListener('click', () => {
          try { browser.tabs.create({ url: it.url }); } catch (e) {
            try { chrome.tabs.create({ url: it.url }); } catch (e2) {}
          }
        });
      }
      cartList.appendChild(row);
    }
    cartContainer.style.display = 'block';
    if (swipeInterface) swipeInterface.style.display = 'none';
    if (actions) actions.style.display = 'none';
    if (altSummary) altSummary.style.display = 'none';
  }

  function hideCartView() {
    const cartContainer = document.querySelector('.cart-view');
    const swipeInterface = document.querySelector('.swipe-interface');
    const actions = document.querySelector('.ecoscore-actions');
    const altSummary = document.querySelector('.alt-summary');
    if (cartContainer) cartContainer.style.display = 'none';
    if (swipeInterface) swipeInterface.style.display = 'flex';
    if (altSummary) altSummary.style.display = 'block';
    if (actions) actions.style.display = 'block';
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

      // If we already prefetched, use it; otherwise, if fetching, await; else fetch now
      let altData = prefetchedAltData;
      if (!altData && alternativesFetchPromise) {
        setEcoScaleText('Loading Alternatives...');
        try { altData = await alternativesFetchPromise; } catch (_) { altData = null; }
      }
      if (!altData) {
        setEcoScaleText('Loading Alternatives...');
        const altPayload = { product: { name, link }, limit: 3, model: 'gpt-4o-mini' };
        const altRes = await fetch(`${BASE_URL}/search`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(altPayload)
        });
        const altRaw = await altRes.text();
        console.log('[EcoCart] /search (find-eco) raw body:', altRaw);
        if (!altRes.ok) throw new Error(`alt search failed: ${altRes.status}`);
        try { altData = JSON.parse(altRaw); prefetchedAltData = altData; } catch (_) { throw new Error('alt non-JSON'); }
      }
      if (altData) {
        await handleAlternativesData(altData, name, link);
      }

      const addToCart = document.querySelector('.add-to-cart-section');
      if (addToCart) addToCart.style.display = 'block';
    } catch (err) {
      console.error('[EcoCart] Find alternatives failed:', err);
      setEcoScaleText('Error');
    }
  }

  function getActivePanelCount() {
    if (Array.isArray(currentAlternatives) && currentAlternatives.length > 0) {
      return Math.min(currentAlternatives.length, totalPanels);
    }
    return 1;
  }

  async function renderAlternativesIntoPanels(alternatives) {
    const maxPanels = totalPanels;
    for (let i = 0; i < maxPanels; i++) {
      const panel = contentPanels[i];
      if (!panel) continue;
      const item = panel.querySelector('.content-item');
      if (!item) continue;
      if (alternatives && i < alternatives.length) {
        await insertPreviewImage(item, alternatives[i]);
      } else {
        item.innerHTML = '';
      }
    }
  }

  async function handleAlternativesData(altData, name, link) {
    const altSummary = document.querySelector('.alt-summary');
    const altNameEl = document.querySelector('.alt-name');
    const altScoreEl = document.querySelector('.alt-ecoscore');
    if (!(altSummary && altNameEl && altScoreEl)) return;
    altSummary.style.display = 'block';
    const alts = Array.isArray(altData.results) ? altData.results.slice(0, Math.min(totalPanels, 3)) : [];
    if (alts.length === 0) return;
    activePageUrl = link || '';
    activeOriginalName = name || '';
    activeOriginalLink = link || '';
    currentAlternatives = alts;
    altScores = new Array(alts.length).fill(null);
    await renderAlternativesIntoPanels(currentAlternatives);
    currentIndex = 0;
    updateContentPositions();
    await onIndexChanged();
    await savePageState(activePageUrl, {
      stage: 'alternatives',
      product: { name: activeOriginalName, link: activeOriginalLink },
      alternatives: currentAlternatives,
      altScores,
      currentIndex
    });
  }

  function prefetchAlternatives(name, link) {
    if (alternativesFetchPromise) return alternativesFetchPromise;
    const altPayload = { product: { name, link }, limit: 3, model: 'gpt-4o-mini' };
    alternativesFetchPromise = fetch(`${BASE_URL}/search`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(altPayload)
    }).then(async (r) => {
      const t = await r.text();
      if (!r.ok) throw new Error(`prefetch failed ${r.status}`);
      let data; try { data = JSON.parse(t); } catch (_) { throw new Error('prefetch non-JSON'); }
      prefetchedAltData = data;
      alternativesFetchPromise = null;
      return data;
    }).catch((e) => {
      console.warn('[EcoCart] prefetch alternatives failed:', e);
      alternativesFetchPromise = null;
      prefetchedAltData = null;
      return null;
    });
    return alternativesFetchPromise;
  }

  async function updateEcoScoreForIndex(index, originalName, originalLink) {
    try {
      const altSummary = document.querySelector('.alt-summary');
      const altNameEl = document.querySelector('.alt-name');
      const altScoreEl = document.querySelector('.alt-ecoscore');
      const current = currentAlternatives && currentAlternatives[index] ? currentAlternatives[index] : null;
      if (!current) return;
      if (altSummary && altNameEl && altScoreEl) {
        altNameEl.textContent = current.name || 'Alternative';
      }
      if (Array.isArray(altScores) && typeof altScores[index] === 'number') {
        const s = altScores[index];
        setEcoScaleText(`New EcoScore: ${s}`);
        if (altScoreEl) altScoreEl.textContent = `New EcoScore: ${s}`;
        return;
      }
      const judgeRes = await fetch(`${BASE_URL}/judge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: { name: current.name || originalName || '', link: current.url || '' }, model: 'gpt-4o-mini' })
      });
      const judgeRaw = await judgeRes.text();
      console.log('[EcoCart] /judge (alt idx) raw body:', judgeRaw);
      if (judgeRes.ok) {
        try {
          const judgeData = JSON.parse(judgeRaw);
          if (typeof judgeData.ecoscore === 'number') {
            altScores[index] = judgeData.ecoscore;
            setEcoScaleText(`New EcoScore: ${judgeData.ecoscore}`);
            if (altScoreEl) altScoreEl.textContent = `New EcoScore: ${judgeData.ecoscore}`;
            if (activePageUrl) {
              const state = await loadPageState(activePageUrl) || {};
              state.stage = 'alternatives';
              state.alternatives = currentAlternatives;
              state.altScores = altScores;
              state.currentIndex = currentIndex;
              state.product = state.product || { name: originalName, link: originalLink };
              await savePageState(activePageUrl, state);
            }
          }
        } catch (_) {}
      }
    } catch (e) {
      console.warn('[EcoCart] Failed to compute ecoscore for index', index, e);
    }
  }

  async function onIndexChanged() {
    const altSummary = document.querySelector('.alt-summary');
    const altNameEl = document.querySelector('.alt-name');
    const altScoreEl = document.querySelector('.alt-ecoscore');
    let altPriceEl = document.querySelector('.alt-price');
    if (!altPriceEl) {
      altPriceEl = document.createElement('div');
      altPriceEl.className = 'alt-price';
      altPriceEl.style.color = '#ffffff';
      altPriceEl.style.fontSize = '16px';
      altPriceEl.style.opacity = '0.95';
      altSummary && altSummary.appendChild(altPriceEl);
    }
    if (altSummary) altSummary.style.display = 'block';
    const activeCount = getActivePanelCount();
    if (!currentAlternatives || activeCount === 0) return;
    const current = currentAlternatives[currentIndex];
    if (altNameEl) altNameEl.textContent = current && current.name ? current.name : 'Alternative';
    if (altPriceEl) altPriceEl.textContent = current && current.price ? `Price: ${current.price}` : '';
    // Update right arrow: add to EcoCart
    if (rightArrow) {
      rightArrow.style.cursor = 'pointer';
      rightArrow.onclick = async () => {
        await addCurrentToCart();
      };
    }
    // Show cached score or compute
    if (Array.isArray(altScores) && typeof altScores[currentIndex] === 'number') {
      const s = altScores[currentIndex];
      setEcoScaleText(`New EcoScore: ${s}`);
      if (altScoreEl) altScoreEl.textContent = `New EcoScore: ${s}`;
    } else {
      if (altScoreEl) altScoreEl.textContent = '';
      await updateEcoScoreForIndex(currentIndex, activeOriginalName, activeOriginalLink);
    }
    // Persist current index
    if (activePageUrl) {
      await savePageState(activePageUrl, {
        stage: 'alternatives',
        product: { name: activeOriginalName, link: activeOriginalLink },
        alternatives: currentAlternatives,
        altScores,
        currentIndex
      });
    }
  }

  async function tryRestoreAlternativesForUrl(url) {
    const state = await loadPageState(url);
    if (!state || state.stage !== 'alternatives' || !Array.isArray(state.alternatives) || state.alternatives.length === 0) {
      return false;
    }
    activePageUrl = url;
    activeOriginalName = (state.product && state.product.name) || '';
    activeOriginalLink = (state.product && (state.product.link || state.product.url)) || '';
    currentAlternatives = state.alternatives.slice(0, totalPanels);
    altScores = Array.isArray(state.altScores) ? state.altScores.slice(0, currentAlternatives.length) : new Array(currentAlternatives.length).fill(null);
    const swipeInterface = document.querySelector('.swipe-interface');
    const actions = document.querySelector('.ecoscore-actions');
    const altSummary = document.querySelector('.alt-summary');
    if (actions) actions.style.display = 'none';
    if (swipeInterface) swipeInterface.style.display = 'flex';
    if (altSummary) altSummary.style.display = 'block';
    try { updateContentPositions(); } catch (_) {}
    try {
      const l = document.querySelector('.left-arrow');
      const r = document.querySelector('.right-arrow');
      if (l) l.style.display = 'flex';
      if (r) r.style.display = 'flex';
    } catch (_) {}
    await renderAlternativesIntoPanels(currentAlternatives);
    currentIndex = Math.max(0, Math.min(currentAlternatives.length - 1, typeof state.currentIndex === 'number' ? state.currentIndex : 0));
    updateContentPositions();
    const addToCart = document.querySelector('.add-to-cart-section');
    if (addToCart) addToCart.style.display = 'block';
    await onIndexChanged();
    return true;
  }

  // Update content positions
  function updateContentPositions() {
    const activeCount = getActivePanelCount();
    contentPanels.forEach((panel, index) => {
      panel.classList.remove('current', 'next', 'prev');
      if (index >= activeCount) {
        panel.style.display = 'none';
        return;
      } else {
        panel.style.display = '';
      }
      if (index === currentIndex) {
        panel.classList.add('current');
      } else if (index === (currentIndex + 1) % activeCount) {
        panel.classList.add('next');
      } else {
        panel.classList.add('prev');
      }
    });
  }
  
  // Slide to next content (green arrow - always left to right)
  function slideToNext() {
    const activeCount = getActivePanelCount();
    if (activeCount <= 1) return;
    const currentPanel = document.querySelector('.product-content.current');
    const nextIndex = (currentIndex + 1) % activeCount;
    const nextPanel = contentPanels[nextIndex];
    
    // Position next panel to the left (off-screen)
    nextPanel.style.transform = 'translateX(-100%)';
    nextPanel.style.zIndex = '3';
    
    // Force a reflow
    nextPanel.offsetHeight;
    
    // Slide current out to right, next in from left
    currentPanel.style.transform = 'translateX(100%)';
    nextPanel.style.transform = 'translateX(0)';
    
    setTimeout(async () => {
      currentIndex = nextIndex;
      updateContentPositions();
      await onIndexChanged();
    }, 600);
  }
  
  // Slide to previous content (red arrow - always right to left)
  function slideToPrev() {
    const activeCount = getActivePanelCount();
    if (activeCount <= 1) return;
    const currentPanel = document.querySelector('.product-content.current');
    const prevIndex = (currentIndex - 1 + activeCount) % activeCount;
    const prevPanel = contentPanels[prevIndex];
    
    // Position prev panel to the right (off-screen)
    prevPanel.style.transform = 'translateX(100%)';
    prevPanel.style.zIndex = '3';
    
    // Force a reflow
    prevPanel.offsetHeight;
    
    // Slide current out to left, prev in from right
    currentPanel.style.transform = 'translateX(-100%)';
    prevPanel.style.transform = 'translateX(0)';
    
    setTimeout(async () => {
      currentIndex = prevIndex;
      updateContentPositions();
      await onIndexChanged();
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
  
  // Left arrow hover effect (red arrow - skip)
  if (leftArrow && productPanel) {
    leftArrow.addEventListener('mouseenter', function() {
      productPanel.style.transition = 'none';
      productPanel.style.transform = 'translateX(-15px) rotate(-5deg)';
    });
    
    leftArrow.addEventListener('mouseleave', function() {
      smoothReturn();
    });
    
    // Left arrow click effect (skip current → go to next)
    leftArrow.addEventListener('click', function() {
      slideToNext();
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
    
    // Right arrow click effect (save to cart, then slide)
    rightArrow.addEventListener('click', async function() {
      await addCurrentToCart();
      slideToNext();
    });
  }

  if (viewCartBtn) {
    viewCartBtn.addEventListener('click', async function() {
      await renderCartView();
    });
  }

  // Help popover toggle
  function toggleHelpPopover(show) {
    if (!helpPopover) return;
    if (typeof show === 'boolean') {
      helpPopover.style.display = show ? 'block' : 'none';
    } else {
      helpPopover.style.display = helpPopover.style.display === 'block' ? 'none' : 'block';
    }
  }

  if (earthLogo && helpPopover) {
    earthLogo.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleHelpPopover();
    });
    // No explicit close button; rely on outside click and Escape
    // Close on outside click
    document.addEventListener('click', function(e) {
      if (!helpPopover) return;
      const target = e.target;
      if (helpPopover.style.display === 'block' && target instanceof Node && !helpPopover.contains(target) && target !== earthLogo) {
        toggleHelpPopover(false);
      }
    });
    // Close on Escape
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') toggleHelpPopover(false);
    });
  }

  // Back button inside cart view
  const cartBackBtn = document.querySelector('.cart-back-btn');
  if (cartBackBtn) {
    cartBackBtn.addEventListener('click', function() {
      hideCartView();
    });
  }

  // Clear cart button
  const cartClearBtn = document.querySelector('.cart-clear-btn');
  if (cartClearBtn) {
    cartClearBtn.addEventListener('click', async function() {
      await saveCart([]);
      await renderCartView();
    });
  }
  
  // Initialize content positions
  updateContentPositions();
});
