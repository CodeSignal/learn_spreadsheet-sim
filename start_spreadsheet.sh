#!/bin/bash

# Exit on error
set -e

# 1. Ensure Node.js is installed
if ! command -v node >/dev/null 2>&1; then
    echo "❌ Node.js is not installed. Please install it before running this script."
    exit 1
fi

# 2. Ensure npm is installed
if ! command -v npm >/dev/null 2>&1; then
    echo "❌ npm is not installed. Please install it before running this script."
    exit 1
fi



# 3. Install missing packages
echo "📦 Installing required npm packages..."

npm install -g pm2

npm install dotenv express axios

echo "✅ Packages installed."

# 4. Start proxy (if not already)
pm2 start proxyServer.js --name proxy-service || true

# 5. Run setup.js
echo "🚀 Running setup.js..."
node setup.js
