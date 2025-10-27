// Load saved headers when popup opens
document.addEventListener('DOMContentLoaded', async () => {
  const data = await chrome.storage.sync.get(['headers', 'enabled']);

  const headers = data.headers || [];
  const enabled = data.enabled !== false; // Default to true

  document.getElementById('enabled').checked = enabled;
  renderHeaders(headers);
});

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

// Helper function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
