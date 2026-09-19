# DocSpace Platform — Operational Scripts

This directory contains operational and process management scripts for the DocSpace full-stack platform.

---

## 📋 Available Scripts

| Script | Alias | Description |
|---|---|---|
| [`start-servers.sh`](start-servers.sh) | `start.sh` | Starts both Backend (FastAPI on `:8000`) and Frontend (Next.js on `:3000`), tracks PIDs in `.pids/`, and streams combined logs from `logs/`. |
| [`stop-servers.sh`](stop-servers.sh) | `stop.sh` | Gracefully terminates both platform servers using recorded PIDs and port inspection (`lsof`), with fallback `SIGKILL`. |
| [`start-tunnel.sh`](start-tunnel.sh) | `tunnel.sh` | Opens an SSH reverse tunnel via Pinggy to expose localhost:3000 (or custom port) publicly, writing the URL to `TUNNEL_URL.txt`. |

---

## ⚡ NPM Shortcuts (`package.json`)

You can run these scripts directly or via `npm run`:

```bash
# Start both servers and stream logs (foreground)
npm run servers:start
# or: ./scripts/start.sh

# Start both servers in background / daemon mode
npm run servers:start:bg
# or: ./scripts/start.sh --background

# Stop both servers
npm run servers:stop
# or: ./scripts/stop.sh

# Restart both servers
npm run servers:restart

# Stream live server logs
npm run servers:logs

# Launch Pinggy remote tunnel (port 3000)
npm run tunnel:pinggy
# or: ./scripts/tunnel.sh
```

---

## 🛠️ Usage Details

### 1. `start-servers.sh` / `start.sh`
- **Foreground mode** (default):
  ```bash
  ./scripts/start.sh
  ```
  Runs both servers, monitors their status, and displays live log output in your terminal. Press `Ctrl+C` to gracefully terminate both servers.

- **Background mode**:
  ```bash
  ./scripts/start.sh --background
  # or
  ./scripts/start.sh -d
  ```
  Spawns both processes detached, writes PIDs to `.pids/`, logs to `logs/`, and returns control to the terminal immediately.

### 2. `stop-servers.sh` / `stop.sh`
```bash
./scripts/stop.sh
```
1. Checks `.pids/backend.pid` and `.pids/frontend.pid` and sends `SIGTERM`.
2. Inspects ports `8000` and `3000` for listening processes to terminate any stray workers.
3. Issues `SIGKILL` if processes do not release ports within 0.5 seconds.
4. Cleans up stale PID files and verifies port availability.

### 3. `start-tunnel.sh` / `tunnel.sh`
```bash
# Default (port 3000)
./scripts/tunnel.sh

# Custom port (e.g., port 8000 for backend API)
./scripts/tunnel.sh 8000
```
- Establishes a secure Pinggy tunnel without requiring external CLI installations.
- Automatically saves the generated public HTTPS URL to `TUNNEL_URL.txt` at the project root.
- Provides a local web inspection dashboard at `http://localhost:4300`.
- Auto-reconnects in 3 seconds if the connection drops.
