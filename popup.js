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
    const domainText = header.domain ? `<span class="header-domain">${escapeHtml(header.domain)}</span>` : '<span class="header-domain all-domains">All domains</span>';
    headerDiv.innerHTML = `
      <div class="header-info">
        <span class="header-name">${escapeHtml(header.name)}:</span>
        <span class="header-value">${escapeHtml(header.value)}</span>
        ${domainText}
      </div>
      <div class="header-actions">
        <button class="edit-button" data-index="${index}">Edit</button>
        <button class="delete-button" data-index="${index}">Delete</button>
      </div>
    `;
    headersList.appendChild(headerDiv);
  });

  // Add edit listeners
  document.querySelectorAll('.edit-button').forEach(button => {
    button.addEventListener('click', async (e) => {
      const index = parseInt(e.target.getAttribute('data-index'));
      const data = await chrome.storage.sync.get(['headers']);
      const headers = data.headers || [];
      const header = headers[index];

      // Populate form with header data
      document.getElementById('headerName').value = header.name;
      document.getElementById('headerValue').value = header.value;
      document.getElementById('headerDomain').value = header.domain || '';
      document.getElementById('editIndex').value = index;

      // Update form UI for edit mode
      document.getElementById('formTitle').textContent = 'Edit Header';
      document.getElementById('addButton').textContent = 'Update Header';
      document.getElementById('cancelEditButton').style.display = 'block';

      // Scroll to form
      document.getElementById('headerForm').scrollIntoView({ behavior: 'smooth' });
    });
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

// Reset form to add mode
function resetForm() {
  document.getElementById('headerName').value = '';
  document.getElementById('headerValue').value = '';
  document.getElementById('headerDomain').value = '';
  document.getElementById('editIndex').value = '-1';
  document.getElementById('formTitle').textContent = 'Add New Header';
  document.getElementById('addButton').textContent = 'Add Header';
  document.getElementById('cancelEditButton').style.display = 'none';
}

// Add or update header
document.getElementById('addButton').addEventListener('click', async () => {
  const nameInput = document.getElementById('headerName');
  const valueInput = document.getElementById('headerValue');
  const domainInput = document.getElementById('headerDomain');
  const editIndexInput = document.getElementById('editIndex');

  const name = nameInput.value.trim();
  const value = valueInput.value.trim();
  const domain = domainInput.value.trim();
  const editIndex = parseInt(editIndexInput.value);

  if (!name || !value) {
    alert('Please enter both header name and value');
    return;
  }

  const data = await chrome.storage.sync.get(['headers']);
  const headers = data.headers || [];

  const headerData = { name, value };
  if (domain) {
    headerData.domain = domain;
  }

  if (editIndex >= 0) {
    // Update existing header
    headers[editIndex] = headerData;
  } else {
    // Add new header
    headers.push(headerData);
  }

  await chrome.storage.sync.set({ headers });

  resetForm();
  renderHeaders(headers);

  // Update background script
  chrome.runtime.sendMessage({ action: 'updateHeaders' });
});

// Cancel edit
document.getElementById('cancelEditButton').addEventListener('click', () => {
  resetForm();
});

// Toggle enabled state
document.getElementById('enabled').addEventListener('change', async () => {
  const enabled = document.getElementById('enabled').checked;
  await chrome.storage.sync.set({ enabled });

  // Update background script
  chrome.runtime.sendMessage({ action: 'updateHeaders' });
});

// ============================================
// SEO Analysis
// ============================================
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
  data.hostname = window.location.hostname;

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

  // Social Preview Section
  html += '<div class="seo-section">';
  html += '<div class="seo-section-title">Social Preview</div>';
  html += '<div class="social-preview">';

  // Facebook Preview
  html += '<div class="social-preview-label">Facebook / LinkedIn</div>';
  html += '<div class="social-preview-card facebook">';
  const fbImage = data.og['og:image'];
  if (fbImage) {
    html += `<div class="social-preview-image" style="background-image: url('${escapeHtml(fbImage)}')"></div>`;
  } else {
    html += '<div class="social-preview-image">No image set</div>';
  }
  html += '<div class="social-preview-content">';
  html += `<div class="social-preview-site">${escapeHtml(data.hostname || '')}</div>`;
  html += `<div class="social-preview-title">${escapeHtml(data.og['og:title'] || data.title || 'No title')}</div>`;
  html += `<div class="social-preview-desc">${escapeHtml(data.og['og:description'] || data.description || 'No description')}</div>`;
  html += '</div></div>';

  // Twitter Preview
  html += '<div class="social-preview-label">Twitter / X</div>';
  html += '<div class="social-preview-card twitter">';
  const twImage = data.twitter['twitter:image'] || data.og['og:image'];
  if (twImage) {
    html += `<div class="social-preview-image" style="background-image: url('${escapeHtml(twImage)}')"></div>`;
  } else {
    html += '<div class="social-preview-image">No image set</div>';
  }
  html += '<div class="social-preview-content">';
  html += `<div class="social-preview-site">${escapeHtml(data.hostname || '')}</div>`;
  html += `<div class="social-preview-title">${escapeHtml(data.twitter['twitter:title'] || data.og['og:title'] || data.title || 'No title')}</div>`;
  html += `<div class="social-preview-desc">${escapeHtml(data.twitter['twitter:description'] || data.og['og:description'] || data.description || 'No description')}</div>`;
  html += '</div></div>';

  html += '</div></div>';

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

// ============================================
// Sitemap Checker
// ============================================
document.getElementById('checkSitemapButton').addEventListener('click', async () => {
  const resultsDiv = document.getElementById('sitemapResults');
  resultsDiv.innerHTML = '<p class="seo-loading">Checking sitemap and robots.txt...</p>';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      resultsDiv.innerHTML = '<div class="seo-error">Cannot check this page. Please navigate to a regular webpage.</div>';
      return;
    }

    const url = new URL(tab.url);
    const baseUrl = `${url.protocol}//${url.hostname}`;

    // Check robots.txt and sitemap in parallel
    const [robotsResult, sitemapResult] = await Promise.all([
      fetchWithTimeout(`${baseUrl}/robots.txt`),
      fetchWithTimeout(`${baseUrl}/sitemap.xml`)
    ]);

    // Parse robots.txt for sitemap references
    let sitemapsFromRobots = [];
    if (robotsResult.success) {
      const lines = robotsResult.content.split('\n');
      lines.forEach(line => {
        const match = line.match(/^sitemap:\s*(.+)/i);
        if (match) {
          sitemapsFromRobots.push(match[1].trim());
        }
      });
    }

    renderSitemapResults({
      baseUrl,
      robots: robotsResult,
      sitemap: sitemapResult,
      sitemapsFromRobots
    });
  } catch (error) {
    resultsDiv.innerHTML = `<div class="seo-error">Error: ${escapeHtml(error.message)}</div>`;
  }
});

async function fetchWithTimeout(url, timeout = 5000) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'text/plain, application/xml, text/xml' }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { success: false, status: response.status, url };
    }

    const content = await response.text();
    return { success: true, status: response.status, content, url };
  } catch (error) {
    if (error.name === 'AbortError') {
      return { success: false, status: 'timeout', url };
    }
    return { success: false, status: 'error', error: error.message, url };
  }
}

function renderSitemapResults(data) {
  const resultsDiv = document.getElementById('sitemapResults');
  let html = '';

  // Robots.txt Section
  html += '<div class="seo-section">';
  html += '<div class="seo-section-title">Robots.txt</div>';

  html += '<div class="seo-item">';
  html += '<div class="seo-label">Status</div>';
  if (data.robots.success) {
    html += '<span class="sitemap-status success">Found</span>';
    html += `<div class="sitemap-url">${escapeHtml(data.robots.url)}</div>`;
  } else {
    html += `<span class="sitemap-status error">Not Found (${data.robots.status})</span>`;
  }
  html += '</div>';

  if (data.robots.success && data.robots.content) {
    html += '<div class="seo-item">';
    html += '<div class="seo-label">Content</div>';
    html += `<div class="robots-content">${escapeHtml(data.robots.content.substring(0, 1500))}${data.robots.content.length > 1500 ? '\n...(truncated)' : ''}</div>`;
    html += '</div>';
  }

  html += '</div>';

  // Sitemap Section
  html += '<div class="seo-section">';
  html += '<div class="seo-section-title">Sitemap.xml</div>';

  html += '<div class="seo-item">';
  html += '<div class="seo-label">Default Location</div>';
  if (data.sitemap.success) {
    html += '<span class="sitemap-status success">Found</span>';
    html += `<div class="sitemap-url">${escapeHtml(data.sitemap.url)}</div>`;

    // Parse sitemap to get URL count
    const urlMatches = data.sitemap.content.match(/<url>/gi);
    const sitemapMatches = data.sitemap.content.match(/<sitemap>/gi);

    if (urlMatches || sitemapMatches) {
      html += '<div class="seo-item" style="margin-top: 10px">';
      html += '<div class="seo-label">Contents</div>';
      if (urlMatches) {
        html += `<div class="seo-value good">${urlMatches.length} URLs found</div>`;
      }
      if (sitemapMatches) {
        html += `<div class="seo-value good">${sitemapMatches.length} sub-sitemaps found (sitemap index)</div>`;
      }
      html += '</div>';
    }
  } else {
    html += `<span class="sitemap-status error">Not Found (${data.sitemap.status})</span>`;
    html += `<div class="sitemap-url">${escapeHtml(data.baseUrl)}/sitemap.xml</div>`;
  }
  html += '</div>';

  // Sitemaps from robots.txt
  if (data.sitemapsFromRobots.length > 0) {
    html += '<div class="seo-item">';
    html += '<div class="seo-label">Sitemaps in robots.txt</div>';
    html += '<div class="seo-value">';
    data.sitemapsFromRobots.forEach(sitemap => {
      html += `<div class="sitemap-url" style="margin-bottom: 6px">${escapeHtml(sitemap)}</div>`;
    });
    html += '</div></div>';
  }

  html += '</div>';

  // Recommendations
  html += '<div class="seo-section">';
  html += '<div class="seo-section-title">Recommendations</div>';

  const recommendations = [];

  if (!data.robots.success) {
    recommendations.push({ type: 'error', text: 'Create a robots.txt file to control crawler access' });
  }

  if (!data.sitemap.success && data.sitemapsFromRobots.length === 0) {
    recommendations.push({ type: 'error', text: 'Create a sitemap.xml to help search engines discover your pages' });
  }

  if (data.robots.success && data.sitemapsFromRobots.length === 0) {
    recommendations.push({ type: 'warning', text: 'Add Sitemap directive to robots.txt' });
  }

  if (data.sitemap.success) {
    recommendations.push({ type: 'success', text: 'Sitemap is accessible and properly configured' });
  }

  if (data.robots.success) {
    recommendations.push({ type: 'success', text: 'Robots.txt is accessible' });
  }

  recommendations.forEach(rec => {
    html += `<div class="seo-item"><span class="sitemap-status ${rec.type}">${escapeHtml(rec.text)}</span></div>`;
  });

  html += '</div>';

  resultsDiv.innerHTML = html;
}

// ============================================
// Pixel Detector
// ============================================
document.getElementById('detectPixelsButton').addEventListener('click', async () => {
  const resultsDiv = document.getElementById('pixelsResults');
  resultsDiv.innerHTML = '<p class="seo-loading">Detecting tracking pixels...</p>';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      resultsDiv.innerHTML = '<div class="seo-error">Cannot analyze this page. Please navigate to a regular webpage.</div>';
      return;
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: detectTrackingPixels
    });

    if (results && results[0] && results[0].result) {
      renderPixelsResults(results[0].result);
    } else {
      resultsDiv.innerHTML = '<div class="seo-error">Failed to detect tracking pixels.</div>';
    }
  } catch (error) {
    resultsDiv.innerHTML = `<div class="seo-error">Error: ${escapeHtml(error.message)}</div>`;
  }
});

function detectTrackingPixels() {
  const pixels = [];
  const html = document.documentElement.outerHTML;
  const scripts = Array.from(document.querySelectorAll('script')).map(s => s.src + ' ' + (s.textContent || ''));
  const allContent = html + ' ' + scripts.join(' ');

  // Google Analytics (UA)
  const uaMatch = allContent.match(/UA-\d{4,10}-\d{1,4}/g);
  if (uaMatch) {
    pixels.push({
      name: 'Google Analytics (UA)',
      icon: 'google',
      ids: [...new Set(uaMatch)]
    });
  }

  // Google Analytics 4 (GA4)
  const ga4Match = allContent.match(/G-[A-Z0-9]{10,}/g);
  if (ga4Match) {
    pixels.push({
      name: 'Google Analytics 4',
      icon: 'google',
      ids: [...new Set(ga4Match)]
    });
  }

  // Google Tag Manager
  const gtmMatch = allContent.match(/GTM-[A-Z0-9]{4,8}/g);
  if (gtmMatch) {
    pixels.push({
      name: 'Google Tag Manager',
      icon: 'gtm',
      ids: [...new Set(gtmMatch)]
    });
  }

  // Google Ads
  const gadsMatch = allContent.match(/AW-\d{9,11}/g);
  if (gadsMatch) {
    pixels.push({
      name: 'Google Ads',
      icon: 'google',
      ids: [...new Set(gadsMatch)]
    });
  }

  // Facebook Pixel
  const fbMatch = allContent.match(/fbq\s*\(\s*['"]init['"]\s*,\s*['"](\d{15,16})['"]/g);
  const fbIds = [];
  if (fbMatch) {
    fbMatch.forEach(m => {
      const id = m.match(/['"](\d{15,16})['"]/);
      if (id) fbIds.push(id[1]);
    });
  }
  // Also check for pixel ID in connect.facebook.net URLs
  const fbPixelMatch = allContent.match(/connect\.facebook\.net/);
  if (fbPixelMatch || fbIds.length > 0) {
    pixels.push({
      name: 'Meta Pixel (Facebook)',
      icon: 'facebook',
      ids: fbIds.length > 0 ? [...new Set(fbIds)] : ['Detected']
    });
  }

  // Twitter Pixel
  const twMatch = allContent.match(/twq\s*\(\s*['"]init['"]\s*,\s*['"]([a-z0-9]+)['"]/gi);
  if (twMatch || allContent.includes('static.ads-twitter.com')) {
    const twIds = [];
    if (twMatch) {
      twMatch.forEach(m => {
        const id = m.match(/['"]([a-z0-9]+)['"]\s*\)/i);
        if (id) twIds.push(id[1]);
      });
    }
    pixels.push({
      name: 'Twitter Pixel',
      icon: 'twitter',
      ids: twIds.length > 0 ? [...new Set(twIds)] : ['Detected']
    });
  }

  // LinkedIn Insight Tag
  const liMatch = allContent.match(/_linkedin_partner_id\s*=\s*["']?(\d+)["']?/);
  if (liMatch || allContent.includes('snap.licdn.com')) {
    pixels.push({
      name: 'LinkedIn Insight',
      icon: 'linkedin',
      ids: liMatch ? [liMatch[1]] : ['Detected']
    });
  }

  // Pinterest Tag
  const pinMatch = allContent.match(/pintrk\s*\(\s*['"]load['"]\s*,\s*['"](\d+)['"]/);
  if (pinMatch || allContent.includes('ct.pinterest.com')) {
    pixels.push({
      name: 'Pinterest Tag',
      icon: 'pinterest',
      ids: pinMatch ? [pinMatch[1]] : ['Detected']
    });
  }

  // TikTok Pixel
  const ttMatch = allContent.match(/ttq\.load\s*\(\s*['"]([A-Z0-9]+)['"]/i);
  if (ttMatch || allContent.includes('analytics.tiktok.com')) {
    pixels.push({
      name: 'TikTok Pixel',
      icon: 'tiktok',
      ids: ttMatch ? [ttMatch[1]] : ['Detected']
    });
  }

  // Snapchat Pixel
  const snapMatch = allContent.match(/snaptr\s*\(\s*['"]init['"]\s*,\s*['"]([a-f0-9-]+)['"]/i);
  if (snapMatch || allContent.includes('sc-static.net')) {
    pixels.push({
      name: 'Snapchat Pixel',
      icon: 'snapchat',
      ids: snapMatch ? [snapMatch[1]] : ['Detected']
    });
  }

  // Hotjar
  const hjMatch = allContent.match(/hjid\s*:\s*(\d+)|h\.hotjar\.com.*\/(\d+)/);
  if (hjMatch || allContent.includes('hotjar.com')) {
    pixels.push({
      name: 'Hotjar',
      icon: 'hotjar',
      ids: hjMatch ? [hjMatch[1] || hjMatch[2]] : ['Detected']
    });
  }

  // HubSpot
  const hsMatch = allContent.match(/js\.hs-scripts\.com\/(\d+)/);
  if (hsMatch || allContent.includes('js.hs-scripts.com') || allContent.includes('js.hsforms.net')) {
    pixels.push({
      name: 'HubSpot',
      icon: 'hubspot',
      ids: hsMatch ? [hsMatch[1]] : ['Detected']
    });
  }

  // Segment
  if (allContent.includes('cdn.segment.com') || allContent.includes('analytics.js')) {
    const segMatch = allContent.match(/analytics\.load\s*\(\s*['"]([A-Za-z0-9]+)['"]/);
    pixels.push({
      name: 'Segment',
      icon: 'segment',
      ids: segMatch ? [segMatch[1]] : ['Detected']
    });
  }

  // Mixpanel
  const mpMatch = allContent.match(/mixpanel\.init\s*\(\s*['"]([a-f0-9]+)['"]/i);
  if (mpMatch || allContent.includes('cdn.mxpnl.com') || allContent.includes('mixpanel.com')) {
    pixels.push({
      name: 'Mixpanel',
      icon: 'mixpanel',
      ids: mpMatch ? [mpMatch[1]] : ['Detected']
    });
  }

  // Amplitude
  if (allContent.includes('cdn.amplitude.com') || allContent.includes('amplitude.getInstance')) {
    pixels.push({
      name: 'Amplitude',
      icon: 'amplitude',
      ids: ['Detected']
    });
  }

  // Microsoft Clarity
  const clarityMatch = allContent.match(/clarity\.ms.*project['":\s]+['"]?([a-z0-9]+)/i);
  if (clarityMatch || allContent.includes('clarity.ms')) {
    pixels.push({
      name: 'Microsoft Clarity',
      icon: 'clarity',
      ids: clarityMatch ? [clarityMatch[1]] : ['Detected']
    });
  }

  return pixels;
}

function renderPixelsResults(pixels) {
  const resultsDiv = document.getElementById('pixelsResults');
  let html = '';

  if (pixels.length === 0) {
    html = '<div class="seo-section"><div class="seo-section-title">Results</div>';
    html += '<p class="empty">No tracking pixels detected on this page</p>';
    html += '</div>';
    resultsDiv.innerHTML = html;
    return;
  }

  html += '<div class="seo-section">';
  html += `<div class="seo-section-title">Found ${pixels.length} Tracking Tool${pixels.length > 1 ? 's' : ''}</div>`;

  pixels.forEach(pixel => {
    html += '<div class="pixel-item">';
    html += `<div class="pixel-icon ${pixel.icon}">${pixel.name.charAt(0)}</div>`;
    html += '<div class="pixel-info">';
    html += `<div class="pixel-name">${escapeHtml(pixel.name)}</div>`;
    html += `<div class="pixel-id">${pixel.ids.map(id => escapeHtml(id)).join(', ')}</div>`;
    html += '</div>';
    html += '<span class="pixel-status found">Found</span>';
    html += '</div>';
  });

  html += '</div>';

  // Summary by category
  html += '<div class="seo-section">';
  html += '<div class="seo-section-title">Summary</div>';

  const categories = {
    'Analytics': ['Google Analytics (UA)', 'Google Analytics 4', 'Mixpanel', 'Amplitude', 'Segment'],
    'Tag Managers': ['Google Tag Manager'],
    'Advertising': ['Google Ads', 'Meta Pixel (Facebook)', 'Twitter Pixel', 'LinkedIn Insight', 'Pinterest Tag', 'TikTok Pixel', 'Snapchat Pixel'],
    'Heatmaps & Session Recording': ['Hotjar', 'Microsoft Clarity'],
    'Marketing Automation': ['HubSpot']
  };

  Object.entries(categories).forEach(([category, tools]) => {
    const found = pixels.filter(p => tools.includes(p.name));
    if (found.length > 0) {
      html += '<div class="seo-item">';
      html += `<div class="seo-label">${category}</div>`;
      html += `<div class="seo-value">${found.map(p => escapeHtml(p.name)).join(', ')}</div>`;
      html += '</div>';
    }
  });

  html += '</div>';

  resultsDiv.innerHTML = html;
}

// ============================================
// Helper Functions
// ============================================
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
