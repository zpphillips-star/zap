# ZAP ⚡

Personal AI assistant powered by Claude (Anthropic). Clean, fast, no Microsoft dependencies.

## What it is

- **Chat UI** — streaming responses from Claude
- **GitHub** — see your repos, PRs, and issues in the sidebar
- **Notes** — quick scratch pad that persists
- **Memory** — remembers conversation context across sessions

## Requirements

- Ubuntu 20.04+ (or any Linux)
- Node.js 18+ (installer handles this)
- Anthropic API key
- GitHub Personal Access Token (optional)

## Install (on your VM)

```bash
# Clone the repo
git clone https://github.com/zpphillips-star/zap.git ~/zap

# Run the installer
bash ~/zap/install.sh
```

That's it. The installer:
1. Installs Node.js if needed
2. Installs dependencies
3. Builds the UI
4. Asks for your API keys
5. Starts ZAP with PM2 (auto-restarts on reboot)

## Access

Once running, open a browser and go to:
```
http://YOUR_VM_IP:3001
```

Find your VM's IP in the Azure Portal.

## Manual start (without PM2)

```bash
cd ~/zap/server
node index.js
```

## Configuration

Edit `~/zap/server/.env`:

```
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-5
GITHUB_TOKEN=ghp_...
PORT=3001
```

## Open port 3001 on Azure

In Azure Portal → Your VM → Networking → Add inbound port rule → Port 3001, TCP.

## Tech stack

- **Backend:** Node.js + Express + Anthropic SDK
- **Frontend:** React + Vite
- **No Microsoft, no Copilot, no GitHub Copilot SDK**
