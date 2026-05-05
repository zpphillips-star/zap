# ZAP ⚡

Personal AI assistant powered by Claude (Anthropic). Clean, fast, no Microsoft dependencies.

## What it is

- **Chat UI** — streaming responses from Claude
- **GitHub** — see your repos, PRs, and issues in the sidebar
- **Notes** — quick scratch pad that persists
- **Memory** — remembers conversation context across sessions

## Requirements

- Ubuntu 20.04+ (or any Linux)
- Node.js 20+ (installer handles this)
- Anthropic API key
- GitHub Personal Access Token (optional)

## Install (on your VM)

```bash
# Clone the repo (any directory works — installer uses its own location)
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
# Run from wherever you cloned the repo
cd /path/to/zap/server
node index.js
```

## Configuration

Edit `server/.env` inside the clone directory:

```
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-5-20250929
GITHUB_TOKEN=ghp_...
PORT=3001
```

## Open port 3001 on Azure (REQUIRED)

**This step is mandatory or ZAP won't load in your browser.**

1. Go to [portal.azure.com](https://portal.azure.com)
2. Find your VM → click **Networking** in the left sidebar
3. Click **Add inbound port rule**
4. Set: **Destination port = 3001**, Protocol = TCP, Action = Allow
5. Hit **Add**

Then open `http://YOUR_VM_IP:3001` in any browser.

## If ZAP stops after a VM reboot

SSH into the VM and run:
```bash
pm2 list          # check if ZAP is running
pm2 restart zap   # restart it
pm2 startup       # copy/run the command it prints to auto-start forever
```

## Tech stack

- **Backend:** Node.js + Express + Anthropic SDK
- **Frontend:** React + Vite
- **No Microsoft, no Copilot, no GitHub Copilot SDK**
