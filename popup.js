// Load saved headers when popup opens
document.addEventListener('DOMContentLoaded', async () => {
  const data = await chrome.storage.sync.get(['headers', 'enabled']);

  const headers = data.headers || [];
  const enabled = data.enabled !== false; // Default to true

  document.getElementById('enabled').checked = enabled;
  renderHeaders(headers);

  // Setup tab switching
  setupTabs();
});

// Setup tab switching functionality
function setupTabs() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.getAttribute('data-tab');

      // Update button states
      tabButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');

      // Update content visibility
      tabContents.forEach(content => content.classList.remove('active'));
      document.getElementById(`${targetTab}-tab`).classList.add('active');
    });
  });
}

// Render the list of headers
function renderHeaders(headers) {
  const headersList = document.getElementById('headersList');
  headersList.innerHTML = '';

  if (headers.length === 0) {
    headersList.innerHTML = '<p class="empty">No headers configured</p>';
    return;
  }

  headers.forEach((header, index) => {
    const headerDiv = document.createElement('div');
    headerDiv.className = 'header-item';
    headerDiv.innerHTML = `
      <div class="header-info">
        <span class="header-name">${escapeHtml(header.name)}:</span>
        <span class="header-value">${escapeHtml(header.value)}</span>
      </div>
      <button class="delete-button" data-index="${index}">Delete</button>
    `;
    headersList.appendChild(headerDiv);
  });

  // Add delete listeners
  document.querySelectorAll('.delete-button').forEach(button => {
    button.addEventListener('click', async (e) => {
      const index = parseInt(e.target.getAttribute('data-index'));
      const data = await chrome.storage.sync.get(['headers']);
      const headers = data.headers || [];
      headers.splice(index, 1);
      await chrome.storage.sync.set({ headers });
      renderHeaders(headers);

      // Update background script
      chrome.runtime.sendMessage({ action: 'updateHeaders' });
    });
  });
}

// Add new header
document.getElementById('addButton').addEventListener('click', async () => {
  const nameInput = document.getElementById('headerName');
  const valueInput = document.getElementById('headerValue');

  const name = nameInput.value.trim();
  const value = valueInput.value.trim();

  if (!name || !value) {
    alert('Please enter both header name and value');
    return;
  }

  const data = await chrome.storage.sync.get(['headers']);
  const headers = data.headers || [];

  headers.push({ name, value });
  await chrome.storage.sync.set({ headers });

  nameInput.value = '';
  valueInput.value = '';

  renderHeaders(headers);

  // Update background script
  chrome.runtime.sendMessage({ action: 'updateHeaders' });
});

// Save enabled state
document.getElementById('saveButton').addEventListener('click', async () => {
  const enabled = document.getElementById('enabled').checked;
  await chrome.storage.sync.set({ enabled });

  // Update background script
  chrome.runtime.sendMessage({ action: 'updateHeaders' });

  // Show feedback
  const button = document.getElementById('saveButton');
  const originalText = button.textContent;
  button.textContent = 'Saved!';
  setTimeout(() => {
    button.textContent = originalText;
  }, 1000);
});

// Toggle enabled state
document.getElementById('enabled').addEventListener('change', async () => {
  const enabled = document.getElementById('enabled').checked;
  await chrome.storage.sync.set({ enabled });

  // Update background script
  chrome.runtime.sendMessage({ action: 'updateHeaders' });
});

// SEO Analysis
document.getElementById('analyzeSeoButton').addEventListener('click', async () => {
  const resultsDiv = document.getElementById('seoResults');
  resultsDiv.innerHTML = '<p class="seo-loading">Analyzing page...</p>';

  try {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      resultsDiv.innerHTML = '<div class="seo-error">Cannot analyze this page. Please navigate to a regular webpage.</div>';
      return;
    }

    // Inject and execute content script
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractSeoData
    });

    if (results && results[0] && results[0].result) {
      renderSeoResults(results[0].result);
    } else {
      resultsDiv.innerHTML = '<div class="seo-error">Failed to extract SEO data from this page.</div>';
    }
  } catch (error) {
    resultsDiv.innerHTML = `<div class="seo-error">Error: ${escapeHtml(error.message)}</div>`;
  }
});

// Function to extract SEO data (runs in page context)
function extractSeoData() {
  const data = {};

  // Basic Meta
  data.title = document.title || null;
  data.titleLength = data.title ? data.title.length : 0;

  const metaDesc = document.querySelector('meta[name="description"]');
  data.description = metaDesc ? metaDesc.getAttribute('content') : null;
  data.descriptionLength = data.description ? data.description.length : 0;

  const metaKeywords = document.querySelector('meta[name="keywords"]');
  data.keywords = metaKeywords ? metaKeywords.getAttribute('content') : null;

  // Canonical URL
  const canonical = document.querySelector('link[rel="canonical"]');
  data.canonical = canonical ? canonical.getAttribute('href') : null;

  // Robots
  const robots = document.querySelector('meta[name="robots"]');
  data.robots = robots ? robots.getAttribute('content') : null;

  // Open Graph
  data.og = {};
  const ogTags = ['og:title', 'og:description', 'og:image', 'og:url', 'og:type', 'og:site_name'];
  ogTags.forEach(tag => {
    const el = document.querySelector(`meta[property="${tag}"]`);
    data.og[tag] = el ? el.getAttribute('content') : null;
  });

  // Twitter Card
  data.twitter = {};
  const twitterTags = ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image', 'twitter:site'];
  twitterTags.forEach(tag => {
    const el = document.querySelector(`meta[name="${tag}"]`);
    data.twitter[tag] = el ? el.getAttribute('content') : null;
  });

  // Headings
  data.headings = {
    h1: Array.from(document.querySelectorAll('h1')).map(h => h.textContent.trim()),
    h2: Array.from(document.querySelectorAll('h2')).map(h => h.textContent.trim()),
    h3: Array.from(document.querySelectorAll('h3')).map(h => h.textContent.trim())
  };

  // Images without alt
  const allImages = document.querySelectorAll('img');
  const imagesWithoutAlt = Array.from(allImages).filter(img => !img.getAttribute('alt') || img.getAttribute('alt').trim() === '');
  data.images = {
    total: allImages.length,
    withoutAlt: imagesWithoutAlt.length
  };

  // Links
  const allLinks = document.querySelectorAll('a[href]');
  const internalLinks = [];
  const externalLinks = [];
  const currentHost = window.location.hostname;

  allLinks.forEach(link => {
    try {
      const url = new URL(link.href);
      if (url.hostname === currentHost) {
        internalLinks.push(link.href);
      } else if (url.protocol.startsWith('http')) {
        externalLinks.push(link.href);
      }
    } catch (e) {
      // Invalid URL
    }
  });

  data.links = {
    internal: internalLinks.length,
    external: externalLinks.length
  };

  // Language
  data.lang = document.documentElement.getAttribute('lang') || null;

  // Viewport
  const viewport = document.querySelector('meta[name="viewport"]');
  data.viewport = viewport ? viewport.getAttribute('content') : null;

  // Charset
  const charset = document.querySelector('meta[charset]') || document.querySelector('meta[http-equiv="Content-Type"]');
  data.charset = charset ? (charset.getAttribute('charset') || charset.getAttribute('content')) : null;

  // Structured Data
  const jsonLd = document.querySelectorAll('script[type="application/ld+json"]');
  data.structuredData = jsonLd.length;

  // Page URL
  data.url = window.location.href;

  return data;
}

// Render SEO results
function renderSeoResults(data) {
  const resultsDiv = document.getElementById('seoResults');
  let html = '';

  // Basic Meta Section
  html += '<div class="seo-section">';
  html += '<div class="seo-section-title">Basic Meta</div>';

  // Title
  html += '<div class="seo-item">';
  html += '<div class="seo-label">Title</div>';
  if (data.title) {
    const titleClass = data.titleLength >= 30 && data.titleLength <= 60 ? 'good' : 'warning';
    html += `<div class="seo-value">${escapeHtml(data.title)}</div>`;
    html += `<div class="seo-label" style="margin-top:4px">Length: <span class="${titleClass}">${data.titleLength} chars</span> (recommended: 30-60)</div>`;
  } else {
    html += '<div class="seo-value missing">Missing title tag</div>';
  }
  html += '</div>';

  // Description
  html += '<div class="seo-item">';
  html += '<div class="seo-label">Meta Description</div>';
  if (data.description) {
    const descClass = data.descriptionLength >= 120 && data.descriptionLength <= 160 ? 'good' : 'warning';
    html += `<div class="seo-value">${escapeHtml(data.description)}</div>`;
    html += `<div class="seo-label" style="margin-top:4px">Length: <span class="${descClass}">${data.descriptionLength} chars</span> (recommended: 120-160)</div>`;
  } else {
    html += '<div class="seo-value missing">Missing meta description</div>';
  }
  html += '</div>';

  // Keywords
  if (data.keywords) {
    html += '<div class="seo-item">';
    html += '<div class="seo-label">Meta Keywords</div>';
    html += `<div class="seo-value">${escapeHtml(data.keywords)}</div>`;
    html += '</div>';
  }

  // Canonical
  html += '<div class="seo-item">';
  html += '<div class="seo-label">Canonical URL</div>';
  html += data.canonical
    ? `<div class="seo-value">${escapeHtml(data.canonical)}</div>`
    : '<div class="seo-value missing">No canonical URL set</div>';
  html += '</div>';

  // Robots
  html += '<div class="seo-item">';
  html += '<div class="seo-label">Robots</div>';
  html += data.robots
    ? `<div class="seo-value">${escapeHtml(data.robots)}</div>`
    : '<div class="seo-value">Not specified (default: index, follow)</div>';
  html += '</div>';

  html += '</div>';

  // Headings Section
  html += '<div class="seo-section">';
  html += '<div class="seo-section-title">Headings</div>';

  ['h1', 'h2', 'h3'].forEach(tag => {
    const headings = data.headings[tag];
    html += '<div class="seo-item">';
    html += `<div class="seo-label">${tag.toUpperCase()} <span class="seo-count">(${headings.length})</span></div>`;
    if (headings.length > 0) {
      html += '<div class="seo-value">';
      headings.slice(0, 5).forEach(h => {
        html += `<div class="seo-tag">${escapeHtml(h.substring(0, 50))}${h.length > 50 ? '...' : ''}</div>`;
      });
      if (headings.length > 5) {
        html += `<div class="seo-tag">+${headings.length - 5} more</div>`;
      }
      html += '</div>';
    } else {
      const cls = tag === 'h1' ? 'missing' : '';
      html += `<div class="seo-value ${cls}">No ${tag.toUpperCase()} tags found</div>`;
    }
    html += '</div>';
  });

  html += '</div>';

  // Open Graph Section
  html += '<div class="seo-section">';
  html += '<div class="seo-section-title">Open Graph</div>';

  const ogFields = [
    { key: 'og:title', label: 'Title' },
    { key: 'og:description', label: 'Description' },
    { key: 'og:image', label: 'Image' },
    { key: 'og:type', label: 'Type' }
  ];

  ogFields.forEach(field => {
    html += '<div class="seo-item">';
    html += `<div class="seo-label">${field.label}</div>`;
    html += data.og[field.key]
      ? `<div class="seo-value">${escapeHtml(data.og[field.key])}</div>`
      : '<div class="seo-value missing">Not set</div>';
    html += '</div>';
  });

  html += '</div>';

  // Twitter Card Section
  html += '<div class="seo-section">';
  html += '<div class="seo-section-title">Twitter Card</div>';

  const twitterFields = [
    { key: 'twitter:card', label: 'Card Type' },
    { key: 'twitter:title', label: 'Title' },
    { key: 'twitter:description', label: 'Description' },
    { key: 'twitter:image', label: 'Image' }
  ];

  twitterFields.forEach(field => {
    html += '<div class="seo-item">';
    html += `<div class="seo-label">${field.label}</div>`;
    html += data.twitter[field.key]
      ? `<div class="seo-value">${escapeHtml(data.twitter[field.key])}</div>`
      : '<div class="seo-value missing">Not set</div>';
    html += '</div>';
  });

  html += '</div>';

  // Technical Section
  html += '<div class="seo-section">';
  html += '<div class="seo-section-title">Technical</div>';

  // Language
  html += '<div class="seo-item">';
  html += '<div class="seo-label">Language</div>';
  html += data.lang
    ? `<div class="seo-value good">${escapeHtml(data.lang)}</div>`
    : '<div class="seo-value missing">No lang attribute set</div>';
  html += '</div>';

  // Viewport
  html += '<div class="seo-item">';
  html += '<div class="seo-label">Viewport</div>';
  html += data.viewport
    ? `<div class="seo-value good">${escapeHtml(data.viewport)}</div>`
    : '<div class="seo-value missing">No viewport meta tag</div>';
  html += '</div>';

  // Charset
  html += '<div class="seo-item">';
  html += '<div class="seo-label">Charset</div>';
  html += data.charset
    ? `<div class="seo-value">${escapeHtml(data.charset)}</div>`
    : '<div class="seo-value missing">Not specified</div>';
  html += '</div>';

  // Structured Data
  html += '<div class="seo-item">';
  html += '<div class="seo-label">Structured Data (JSON-LD)</div>';
  html += data.structuredData > 0
    ? `<div class="seo-value good">${data.structuredData} schema(s) found</div>`
    : '<div class="seo-value">No structured data found</div>';
  html += '</div>';

  html += '</div>';

  // Content Stats Section
  html += '<div class="seo-section">';
  html += '<div class="seo-section-title">Content Stats</div>';

  // Images
  html += '<div class="seo-item">';
  html += '<div class="seo-label">Images</div>';
  html += `<div class="seo-value">Total: ${data.images.total}`;
  if (data.images.withoutAlt > 0) {
    html += ` | <span class="warning">Missing alt: ${data.images.withoutAlt}</span>`;
  } else if (data.images.total > 0) {
    html += ' | <span class="good">All have alt text</span>';
  }
  html += '</div></div>';

  // Links
  html += '<div class="seo-item">';
  html += '<div class="seo-label">Links</div>';
  html += `<div class="seo-value">Internal: ${data.links.internal} | External: ${data.links.external}</div>`;
  html += '</div>';

  html += '</div>';

  resultsDiv.innerHTML = html;
}

// Helper function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
