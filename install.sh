#!/bin/bash
# ZAP Install Script — Ubuntu 24.04
# Installs ZAP: personal AI assistant powered by Claude

set -e

echo "⚡ ZAP Installer"
echo "================"
echo ""

# ── Check Node.js ────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
else
  echo "✓ Node.js $(node --version)"
fi

# ── Install dependencies ─────────────────────────────────────────────────────
echo ""
echo "Installing server dependencies..."
cd ~/zap/server
npm install --omit=dev

echo ""
echo "Installing client dependencies and building..."
cd ~/zap/client
npm install
npm run build

# ── .env setup ───────────────────────────────────────────────────────────────
cd ~/zap/server
if [ ! -f .env ]; then
  echo ""
  echo "Setting up environment..."
  cp .env.example .env

  read -p "Enter your Anthropic API key (sk-ant-...): " ANTHROPIC_KEY
  sed -i "s|sk-ant-api03-REPLACE_ME|$ANTHROPIC_KEY|" .env

  read -p "Enter your GitHub Personal Access Token (ghp_...): " GITHUB_KEY
  sed -i "s|ghp_REPLACE_ME|$GITHUB_KEY|" .env

  echo "✓ .env configured"
else
  echo "✓ .env already exists, skipping"
fi

# ── Serve static files from built client ─────────────────────────────────────
# Add static file serving to the server (production mode)
if [ ! -d ~/zap/server/public ]; then
  echo "Warning: client build not found in server/public"
fi

# ── PM2 (process manager) ────────────────────────────────────────────────────
if ! command -v pm2 &>/dev/null; then
  echo ""
  echo "Installing PM2 (process manager)..."
  sudo npm install -g pm2
fi

cd ~/zap/server
pm2 describe zap > /dev/null 2>&1 && pm2 restart zap || pm2 start index.js --name zap
pm2 save
# Configure pm2 to auto-start on reboot (capture the command pm2 prints and run it)
STARTUP_CMD=$(pm2 startup 2>&1 | grep "sudo" | tail -1)
if [ -n "$STARTUP_CMD" ]; then
  eval "$STARTUP_CMD" 2>/dev/null || true
fi

echo ""
echo "✅ ZAP is running!"
echo ""
echo "   Open your browser to: http://$(curl -s ifconfig.me):3001"
echo "   (or http://localhost:3001 if accessing from the VM itself)"
echo ""
echo "   To check status: pm2 status"
echo "   To view logs:    pm2 logs zap"
echo "   To stop:         pm2 stop zap"
echo "   To restart:      pm2 restart zap"
