#!/usr/bin/env bash
# Deploy clearpaths-mcp to mardonius
# Usage: ssh phil@app.clearpaths.pro 'bash -s' < deploy/deploy.sh
#   or:  ssh phil@app.clearpaths.pro 'cd /var/www/clearpaths-mcp && bash deploy/deploy.sh'

set -euo pipefail

DEPLOY_DIR="/var/www/clearpaths-mcp"

echo "==> Pulling latest code..."
cd "$DEPLOY_DIR"
git pull origin main

echo "==> Installing dependencies..."
npm ci --production

echo "==> Building..."
npm run build

echo "==> Restarting service..."
sudo systemctl restart clearpaths-mcp

echo "==> Checking health..."
sleep 2
if curl -sf http://localhost:3001/health > /dev/null; then
  echo "==> Deploy complete. Service is healthy."
else
  echo "==> WARNING: Health check failed!"
  sudo journalctl -u clearpaths-mcp --no-pager -n 20
  exit 1
fi
