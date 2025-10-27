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

  // Create new rules for each header
  const rules = [{
    id: 1,
    priority: 1,
    action: {
      type: 'modifyHeaders',
      requestHeaders: headers.map(header => ({
        header: header.name,
        operation: 'set',
        value: header.value
      }))
    },
    condition: {
      urlFilter: '*',
      resourceTypes: [
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
      ]
    }
  }];

  // Add the rules
  await chrome.declarativeNetRequest.updateDynamicRules({
    addRules: rules
  });
}
