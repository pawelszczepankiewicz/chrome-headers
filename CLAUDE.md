# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome Extension (Manifest V3) that allows users to add custom HTTP headers to all browser requests. It uses the `declarativeNetRequest` API for header modification.

## Architecture

- **background.js**: Service worker that manages `declarativeNetRequest` rules. Listens for messages from the popup and updates header rules based on stored configuration.
- **popup.js / popup.html / popup.css**: UI for the extension popup. Allows users to add/remove headers and toggle the extension on/off.
- **manifest.json**: Chrome extension manifest (v3) defining permissions and entry points.

Data flow:
1. User configures headers in popup UI
2. Settings saved to `chrome.storage.sync`
3. Popup sends message to background service worker
4. Background worker updates `declarativeNetRequest` dynamic rules

## Development Commands

### Load extension for testing
1. Navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select this directory

### Package for distribution
```bash
zip -r custom-headers-extension.zip . -x "*.git*" "generate-icons.html" "DEPLOYMENT.md" "*.zip"
```

### Generate icons
Open `generate-icons.html` in a browser and click "Download All" to generate required icon files (icon16.png, icon48.png, icon128.png).

## Key APIs Used

- `chrome.declarativeNetRequest`: For modifying HTTP request headers
- `chrome.storage.sync`: For persisting user configuration
- `chrome.runtime.onMessage`: For popup-to-background communication
