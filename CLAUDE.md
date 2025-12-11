# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Developer Helper** is a Chrome Extension (Manifest V3) providing tools for developers and marketing teams:
- Custom HTTP headers injection
- SEO metadata analysis with social preview
- Sitemap and robots.txt checker
- Tracking pixel detector

## Architecture

- **background.js**: Service worker managing `declarativeNetRequest` rules for custom headers.
- **popup.js**: Main application logic with 4 tabs (Headers, SEO, Sitemap, Pixels). Uses `chrome.scripting.executeScript` to inject analysis functions into pages.
- **popup.html**: UI structure with tab navigation.
- **popup.css**: Styling with glassmorphism design.
- **manifest.json**: Extension manifest (v3) with permissions.

### Tab Functionality

1. **Headers Tab**: Add/remove custom HTTP headers applied to all requests via `declarativeNetRequest`
2. **SEO Tab**: Analyzes page metadata (title, description, OG tags, Twitter cards, headings, images, links) and shows social preview
3. **Sitemap Tab**: Fetches and analyzes `/robots.txt` and `/sitemap.xml` from current domain
4. **Pixels Tab**: Detects 15+ tracking tools (GA, GTM, Meta Pixel, LinkedIn, TikTok, Hotjar, etc.)

### Data Flow

**Headers feature:**
1. User configures headers in popup → saved to `chrome.storage.sync`
2. Popup sends message to background service worker
3. Background updates `declarativeNetRequest` dynamic rules

**Analysis features (SEO, Pixels):**
1. User clicks analyze button
2. `chrome.scripting.executeScript` injects function into active tab
3. Function extracts data from page DOM
4. Results returned and rendered in popup

**Sitemap feature:**
1. Popup fetches `/robots.txt` and `/sitemap.xml` directly via `fetch()`
2. Parses content and displays results

## Development Commands

### Load extension for testing
1. Navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select this directory

### Package for distribution
```bash
zip -r developer-helper-extension.zip . -x "*.git*" -x "*.DS_Store" -x "generate-icons.html" -x "DEPLOYMENT.md" -x "CLAUDE.md" -x "package.sh" -x "*.zip" -x "*.crx" -x "*.pem" -x ".claude/*" -x "*.xcf" -x "banner-*.png"
```

## Key APIs Used

- `chrome.declarativeNetRequest`: Modifying HTTP request headers
- `chrome.scripting.executeScript`: Injecting analysis scripts into pages
- `chrome.storage.sync`: Persisting header configuration
- `chrome.tabs.query`: Getting active tab for analysis
- `chrome.runtime.onMessage`: Popup-to-background communication

## Permissions

- `declarativeNetRequest`: Required for header modification
- `activeTab`: Required to analyze current page content
- `scripting`: Required to inject analysis scripts
- `storage`: Required to save header configuration
- `host_permissions (<all_urls>)`: Required for headers to apply to all sites
