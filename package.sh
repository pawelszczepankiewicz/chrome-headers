#!/bin/bash

# Package Chrome Extension for distribution
# This script creates a ZIP file suitable for Chrome Web Store upload

PACKAGE_NAME="custom-headers-extension.zip"

# Remove old package if it exists
if [ -f "$PACKAGE_NAME" ]; then
    echo "Removing old package..."
    rm "$PACKAGE_NAME"
fi

# Create the package
echo "Creating package..."
zip -r "$PACKAGE_NAME" . \
  -x "*.git*" \
  -x "*.DS_Store" \
  -x "generate-icons.html" \
  -x "DEPLOYMENT.md" \
  -x "package.sh" \
  -x "*.zip" \
  -x "*.crx" \
  -x "*.pem" \
  -x "node_modules/*"

if [ $? -eq 0 ]; then
    echo "✓ Package created successfully: $PACKAGE_NAME"
    echo ""
    echo "Package contents:"
    unzip -l "$PACKAGE_NAME"
    echo ""
    echo "You can now upload this file to the Chrome Web Store."
else
    echo "✗ Failed to create package"
    exit 1
fi
