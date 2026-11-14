# Deployment and development environment

Status: Windows development setup is verified on the build machine. The server
stack is fully specified; `services/api` is implemented in Sprint 2, so
`docker compose build` is not expected to succeed before that sprint.

## 1. Windows development environment (verified 2026-11-14)

| Tool | Verified version / path | Notes |
|---|---|---|
| Windows | 10.0.26300 (Windows 11) | WebView2 present |
| Node.js | v26.13.0 | Node 22+ required |
| pnpm | 12.18.0 | workspace package manager |
| Rust | 1.100.0 stable-x86_64-pc-windows-msvc | rustup default |
| mpv | 0.42.0 at `C:\Program Files\MPV Player\mpv.exe` | FFmpeg N-128504 |
| Git | installed | |
| Docker Desktop | installed | backend only |
| GPU | AMD Radeon (Ryzen 7 5700U, 2 GB shared) | 4K likely via D3D11VA; 8K not assumed |

### Install

```powershell
# Node.js LTS (if missing)
winget install --id OpenJS.NodeJS.LTS --exact --accept-package-agreements --accept-source-agreements

# pnpm
corepack enable
corepack prepare pnpm@12.18.0 --activate

# Rust
winget install --id Rustlang.Rustup --exact --accept-package-agreements --accept-source-agreements
rustup default stable-msvc

# Visual Studio Build Tools + Windows SDK (needs elevation)
winget install --id Microsoft.VisualStudio.2022.BuildTools --exact `
  --accept-package-agreements --accept-source-agreements `
  --override "--wait --quiet --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"

# mpv
winget install --id shinchiro.mpv --exact --accept-package-agreements --accept-source-agreements

# Docker Desktop (backend development)
winget install --id Docker.DockerDesktop --exact --accept-package-agreements --accept-source-agreements
```

Verify:

```powershell
node --version
pnpm --version
rustc --version
cargo --version
mpv --version
docker --version
docker compose version
```

If `mpv` is not on `PATH`, set the absolute path for the app:

```powershell
[Environment]::SetEnvironmentVariable(
  "ABSOLUTE_CINEMA_MPV",
  "C:\Program Files\MPV Player\mpv.exe",
  "User"
)
```

### Build the desktop app

```powershell
cd C:\Users\muazs\Downloads\Absolute-Cinema
pnpm install
pnpm dev          # Tauri + Vite dev
pnpm build        # release installer
```

Outputs:

```text
apps/desktop/src-tauri/target/release/bundle/msi/*.msi
apps/desktop/src-tauri/target/release/bundle/nsis/*-setup.exe
```

The first Rust build downloads and compiles the Tauri dependency graph; expect
several minutes. Subsequent builds are incremental.

### mpv packaging policy (MVP)

The installer does **not** bundle mpv. The app detects a user-installed mpv
(PATH, `C:\Program Files\MPV Player\mpv.exe`, or `ABSOLUTE_CINEMA_MPV`). This
avoids redistributing a GPLv2+ binary without a compliance plan. If bundling is
approved later, ship the mpv license, source offer/URL, and a reproducible
build note; do not silently copy `mpv.exe` into the installer.

### Code signing and updates

- Buy a code-signing certificate (OV/EV) before public distribution.
- Configure `bundle.windows.certificateThumbprint` and timestamp server in
  `tauri.conf.json`; never commit the certificate or password.
- Auto-update (`tauri-plugin-updater`) is a Sprint 7 feature. It requires a
  signed manifest, HTTPS hosting, and a rollback plan. Unsigned auto-updates
  are not acceptable.

## 2. VPS baseline

- Ubuntu 24.04 LTS, 2 vCPU, 2–4 GB RAM, 30–40 GB SSD.
- A registered domain with:
  - `api.example.com` → VPS IPv4 (and AAAA if IPv6 is configured).
  - `turn.example.com` → same VPS.
- Ports: 22/tcp (restricted), 80/tcp, 443/tcp, 3478/tcp+udp,
  49160–49200/udp. Optional: 443/udp for HTTP/3.
- Do **not** expose 3000 (API) or 5432 (PostgreSQL) publicly.

Sizing note: signaling, chat and room state for two-person rooms are tiny. The
server does not relay video. TURN relays audio only when a direct P2P path
fails, at roughly 40–64 kbps per call.

## 3. First-time server setup

### 3.1 SSH and base packages

```bash
ssh root@SERVER_IP
apt update && apt upgrade -y
apt install -y git ufw curl ca-certificates openssl
```

Create a non-root operator:

```bash
adduser --disabled-password --gecos "" cinema
usermod -aG sudo cinema
rsync --archive --chown=cinema:cinema ~/.ssh /home/cinema
```

Harden SSH (`/etc/ssh/sshd_config.d/99-absolute-cinema.conf`):

```text
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
```

```bash
systemctl restart ssh
```

From now on use `ssh cinema@SERVER_IP`.

### 3.2 Firewall

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp
sudo ufw allow 49160:49200/udp
sudo ufw --force enable
sudo ufw status verbose
```

Docker caveat: Docker publishes container ports through its own iptables
rules, which can bypass UFW. This compose file publishes only 80/443 and runs
coturn on the host network; PostgreSQL and the API are `expose`d only. Verify
after startup that nothing else is listening publicly:

```bash
sudo ss -lntup
```

If you later publish another port, add an explicit `DOCKER-USER` rule or use
`ufw-docker`; do not assume UFW covers it.

### 3.3 Docker (official apt repository)

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker cinema
```

Log out and back in so the group applies. Verify:

```bash
docker --version
docker compose version
```

### 3.4 Clone and configure

```bash
sudo mkdir -p /opt/absolute-cinema
sudo chown cinema:cinema /opt/absolute-cinema
git clone <REPOSITORY_URL> /opt/absolute-cinema
cd /opt/absolute-cinema/infra

cp .env.example .env
chmod 600 .env
```

Generate secrets:

```bash
openssl rand -base64 36   # POSTGRES_PASSWORD
openssl rand -base64 48   # TURN_SECRET
```

Edit `.env`:

```env
NODE_ENV=production
API_DOMAIN=api.example.com
TURN_REALM=turn.example.com
PUBLIC_IPV4=203.0.113.10
POSTGRES_DB=absolute_cinema
POSTGRES_USER=absolute_cinema
POSTGRES_PASSWORD=<generated>
TURN_SECRET=<generated>
ROOM_TTL_HOURS=24
CHAT_RETENTION_HOURS=24
```

Never commit `.env`. The repository `.gitignore` excludes it.

### 3.5 DNS and TLS

Create the A/AAAA records before starting Caddy. Caddy obtains and renews
certificates automatically over HTTP-01/TLS-ALPN when ports 80/443 are reachable.

```bash
dig +short api.example.com
dig +short turn.example.com
```

### 3.6 Deploy

```bash
cd /opt/absolute-cinema/infra
docker compose build
docker compose up -d
docker compose ps
```

The `migrate` service runs `node dist/db/migrate.js` once and must exit 0
before the API starts. The API healthcheck must become healthy before Caddy
starts.

Manual migration/debug:

```bash
docker compose run --rm migrate
docker compose logs -f migrate
```

### 3.7 Verify

```bash
curl -fsS https://api.example.com/v1/health | jq
docker compose logs --tail=100 api
docker compose logs --tail=100 caddy
```

Expected health response:

```json
{"status":"ok","version":"0.1.0","time":"...","db":"ok"}
```

## 4. Coturn

The compose service renders `coturn/turnserver.conf.template` at startup with
`TURN_SECRET`, `TURN_REALM` and `PUBLIC_IPV4`. It uses host networking because
the relay port range must be reachable directly.

Key settings:

- `use-auth-secret` + `static-auth-secret`: time-limited credentials only.
- `external-ip`: mandatory behind NAT/cloud networking.
- `min-port`/`max-port`: must match the firewall range.
- `no-cli`, `no-multicast-peers`, `denied-peer-ip`: reduce abuse.
- `stale-nonce=600`: rotate nonces.

Check it is listening:

```bash
sudo ss -lunp | grep -E '3478|4916|4917|4918|4919|4920'
docker compose logs --tail=100 coturn
```

### TURN reachability test

Generate a credential exactly as the API will:

```bash
EXPIRY=$(( $(date +%s) + 3600 ))
USERNAME="${EXPIRY}:test"
CRED=$(printf '%s' "$USERNAME" | openssl dgst -sha1 -hmac "$TURN_SECRET" -binary | base64)

docker run --rm --network host coturn/coturn:4.19.0-r0-debian \
  turnutils_uclient -u "$USERNAME" -w "$CRED" -p 3478 -v turn.example.com
```

A successful allocation proves UDP reachability and secret agreement. Repeat
with `-t` for TCP if UDP is blocked by the network. Voice falls back to
TURN/TCP when needed.

### TURN security notes

- The TURN secret is equivalent to a relay credential. Rotate it by updating
  `.env`, restarting `coturn` and `api`, and letting old credentials expire.
- Do not enable `no-auth` or a static user/password.
- Do not expose the coturn CLI or Prometheus port publicly.
- TLS TURN (5349) is optional; if enabled, mount certificates and open 5349.

## 5. Operations

### Logs

```bash
docker compose logs -f api
docker compose logs -f caddy
docker compose logs -f coturn
docker compose ps
```

Caddy access logs are written inside the container at `/data/access.log`
(JSON, rotated). Do not log query strings containing tokens; the API redacts
them and Caddy's default JSON access log includes the path—avoid putting
secrets in URLs (invite tokens are in the desktop deep link, not API URLs).

### Backups

Daily logical backup:

```bash
sudo mkdir -p /var/backups/absolute-cinema
sudo chown cinema:cinema /var/backups/absolute-cinema

docker compose exec -T postgres pg_dump \
  -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc \
  > "/var/backups/absolute-cinema/absolute-cinema-$(date +%F).dump"
```

Cron (as `cinema`):

```cron
15 3 * * * cd /opt/absolute-cinema/infra && docker compose exec -T postgres pg_dump -U absolute_cinema -d absolute_cinema -Fc > /var/backups/absolute-cinema/absolute-cinema-$(date +\%F).dump
30 3 * * * find /var/backups/absolute-cinema -type f -mtime +14 -delete
```

Restore drill (staging, never blindly on production):

```bash
docker compose stop api
docker compose exec -T postgres pg_restore \
  -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists \
  < /var/backups/absolute-cinema/absolute-cinema-2026-11-14.dump
docker compose start api
```

Also back up the Caddy data volume if you want to avoid re-issuing
certificates; it is not required for correctness.

### Updates

```bash
cd /opt/absolute-cinema
git pull --ff-only
cd infra
docker compose build
docker compose up -d
docker compose ps
curl -fsS https://api.example.com/v1/health
```

Rollback:

```bash
git log --oneline -5
git checkout <known-good-sha>
docker compose build
docker compose up -d
```

Database migrations must be backward compatible for one release (expand →
deploy → contract) so a rollback does not break the schema.

### Restart / reboot

Docker services use `restart: unless-stopped`; after a reboot:

```bash
docker compose ps
curl -fsS https://api.example.com/v1/health
```

### Resource checks

```bash
docker stats --no-stream
free -h
df -h
```

Expected idle: API < 100 MB RSS, PostgreSQL < 150 MB, Caddy < 50 MB, coturn
< 50 MB. Video traffic is zero.

## 6. Troubleshooting

| Symptom | Check |
|---|---|
| Caddy certificate fails | DNS A/AAAA, ports 80/443, `docker compose logs caddy` |
| WebSocket closes immediately | Caddy proxy, API auth ticket expiry, clock skew |
| API unhealthy | `docker compose logs api`, `DATABASE_URL`, migration exit code |
| TURN allocation fails | `external-ip`, firewall UDP range, secret match, `turnutils_uclient` |
| Voice connects but no audio | browser/OS mic permission, muted track, ICE state, TURN test |
| Room resume fails | room TTL/expiry, snapshot row, server clock |
| High drift | clock confidence, RTT, buffering, correction thresholds |
| Port already in use | `ss -lntup`, stop conflicting service |
| Disk full | old Docker images `docker image prune`, logs, backups |

## 7. Windows profiling procedure

Baseline before optimization:

```powershell
# Idle with app open and video paused
1..12 | ForEach-Object {
  Get-Process absolute-cinema, mpv -ErrorAction SilentlyContinue |
    Select-Object ProcessName, @{n='RAM_MB';e={[math]::Round($_.WorkingSet64/1MB,1)}}, CPU
  Start-Sleep -Seconds 5
}
```

GPU/decoder evidence:

```powershell
# While a 4K file plays, query mpv over its IPC pipe from the app's diagnostics panel:
# hwdec-current, video-params, frame-drop-count, decoder-frame-drop-count
```

UI frame rate: WebView2 DevTools → Performance → record 10 s of scrubber
interaction. Target 60 fps, no long tasks > 50 ms.

Sync evidence: Sprint 3 adds a client-side CSV export of
`timestamp, driftMs, rttMs, clockConfidence, buffering`. Two-machine runs are
the acceptance source; single-machine tests are not evidence of network sync.

Windows Performance Recorder (optional, for deep CPU/GPU analysis):

```powershell
wpr -start CPU -start GPU
# reproduce for 60 seconds
wpr -stop C:\Temp\absolute-cinema.etl
```

Open the ETL in Windows Performance Analyzer.
