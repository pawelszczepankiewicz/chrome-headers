// Initialize rules on install or update
chrome.runtime.onInstalled.addListener(() => {
  updateHeaderRules();
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateHeaders') {
    updateHeaderRules();
  }
});

// Update declarativeNetRequest rules based on stored headers
async function updateHeaderRules() {
  const data = await chrome.storage.sync.get(['headers', 'enabled']);
  const headers = data.headers || [];
  const enabled = data.enabled !== false;

  // Clear existing rules
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const ruleIdsToRemove = existingRules.map(rule => rule.id);

  if (ruleIdsToRemove.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: ruleIdsToRemove
    });
  }

  // If disabled or no headers, just remove all rules
  if (!enabled || headers.length === 0) {
    return;
  }

  // Group headers by domain
  const headersByDomain = {};
  headers.forEach(header => {
    const domain = header.domain || '__all__';
    if (!headersByDomain[domain]) {
      headersByDomain[domain] = [];
    }
    headersByDomain[domain].push(header);
  });

  const resourceTypes = [
    'main_frame',
    'sub_frame',
    'stylesheet',
    'script',
    'image',
    'font',
    'object',
    'xmlhttprequest',
    'ping',
    'csp_report',
    'media',
    'websocket',
    'webtransport',
    'webbundle',
    'other'
  ];

  // Create rules for each domain group
  const rules = [];
  let ruleId = 1;

  Object.entries(headersByDomain).forEach(([domain, domainHeaders]) => {
    const condition = {
      resourceTypes
    };

    if (domain === '__all__') {
      condition.urlFilter = '*';
    } else {
      // Match the specific domain and its subdomains
      condition.urlFilter = `||${domain}`;
    }

    rules.push({
      id: ruleId++,
      priority: domain === '__all__' ? 1 : 2, // Domain-specific rules have higher priority
      action: {
        type: 'modifyHeaders',
        requestHeaders: domainHeaders.map(header => ({
          header: header.name,
          operation: 'set',
          value: header.value
        }))
      },
      condition
    });
  });

  // Add the rules
  await chrome.declarativeNetRequest.updateDynamicRules({
    addRules: rules
  });
}
