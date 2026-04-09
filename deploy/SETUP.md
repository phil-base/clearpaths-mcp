# Server Setup Guide — Mardonius

One-time setup for deploying clearpaths-mcp on mardonius alongside the clearpaths app.

## Prerequisites

- Node.js 18+ installed on mardonius
- Apache modules: `proxy`, `proxy_http`, `rewrite`, `ssl`

## 1. DNS

Add a CNAME record for `mcp.clearpaths.pro` pointing to `mardonius.duckdns.org`.

If DNS for `clearpaths.pro` is managed via Cloudflare (or similar):

1. Add a CNAME record: `mcp` → `mardonius.duckdns.org`
2. Set proxy status to **DNS only** (grey cloud) — Let's Encrypt needs to reach Apache directly for the HTTP-01 challenge.

Verify propagation before proceeding:

```bash
dig mcp.clearpaths.pro +short
# Should resolve to mardonius's IP
```

## 2. Install Node.js (if not present)

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # should be 22.x
```

## 3. Clone the repo

```bash
sudo mkdir -p /var/www/clearpaths-mcp
sudo chown phil:phil /var/www/clearpaths-mcp
git clone git@github.com:phil-base/clearpaths-mcp.git /var/www/clearpaths-mcp
cd /var/www/clearpaths-mcp
npm ci --production
npm run build
```

## 4. Install the systemd service

```bash
sudo cp deploy/clearpaths-mcp.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable clearpaths-mcp
sudo systemctl start clearpaths-mcp

# Verify
sudo systemctl status clearpaths-mcp
curl http://localhost:3001/health
```

## 5. Configure Apache reverse proxy

```bash
# Enable required modules
sudo a2enmod proxy proxy_http rewrite ssl headers

# Install the vhost
sudo cp deploy/apache-mcp.clearpaths.pro.conf /etc/apache2/sites-available/mcp.clearpaths.pro.conf

# Get SSL cert first (before enabling the HTTPS vhost)
sudo certbot certonly --apache -d mcp.clearpaths.pro

# Enable the site
sudo a2ensite mcp.clearpaths.pro.conf
sudo systemctl reload apache2
```

## 6. Verify

```bash
# Local health check
curl http://localhost:3001/health

# Public health check
curl https://mcp.clearpaths.pro/health
```

## Client configuration

Users connect by adding this to their Claude Desktop or Claude Code MCP config:

```json
{
  "mcpServers": {
    "clearpaths": {
      "url": "https://mcp.clearpaths.pro/mcp",
      "headers": {
        "Authorization": "Bearer <your-clearpaths-api-token>"
      }
    }
  }
}
```

## Logs

```bash
# Live logs
sudo journalctl -u clearpaths-mcp -f

# Recent errors
sudo journalctl -u clearpaths-mcp --no-pager -n 50
```

## Subsequent deploys

```bash
cd /var/www/clearpaths-mcp && bash deploy/deploy.sh
```
