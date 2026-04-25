# Organza Store — VPS Deployment Guide

> **Stack:** Medusa v2 (backend) + Next.js (frontend) + PostgreSQL + Redis + Nginx + PM2 + GitHub Actions CI/CD
> **Server:** Ubuntu 20.04/22.04 on Contabo VPS

---

## Table of Contents

1. [Connect to VPS](#1-connect-to-vps)
2. [Initial Server Setup](#2-initial-server-setup)
3. [Install NVM & Node.js](#3-install-nvm--nodejs)
4. [Install Redis](#4-install-redis)
5. [Configure PostgreSQL](#5-configure-postgresql)
6. [Restore Database from Local](#6-restore-database-from-local)
7. [Install PM2](#7-install-pm2)
8. [Setup SSH Keys](#8-setup-ssh-keys)
9. [Create Environment Files](#9-create-environment-files)
10. [Create PM2 Ecosystem Config](#10-create-pm2-ecosystem-config)
11. [DNS Records (do this BEFORE Nginx SSL)](#11-dns-records)
12. [Configure Nginx (HTTP only first)](#12-configure-nginx)
13. [SSL with Certbot](#13-ssl-with-certbot)
14. [GitHub Actions CI/CD](#14-github-actions-cicd)
15. [Useful Commands](#15-useful-commands)
16. [Troubleshooting](#16-troubleshooting)

---

## 1. Connect to VPS

Open terminal on your laptop:

- **Mac** → `Command + Space` → type `Terminal`
- **Windows** → `Win + R` → type `cmd` or use Windows Terminal
- **Linux** → `Ctrl + Alt + T`

Connect to your VPS:

```bash
ssh root@your-vps-ip
```

First time you'll see a prompt — type `yes` and press Enter, then enter your root password (from Contabo welcome email).

### (Optional) Save SSH alias on your laptop

```bash
# Add to ~/.bashrc or ~/.zshrc on your laptop
alias vps="ssh root@your-vps-ip"
source ~/.bashrc
```

Now just type `vps` to connect.

### (Optional) Use SSH key instead of password

```bash
# On your laptop
ssh-keygen -t ed25519 -C "my-laptop"
ssh-copy-id root@your-vps-ip
```

Now you can connect without a password.

---

## 2. Initial Server Setup

```bash
apt update && apt upgrade -y
apt install -y git curl nano ufw

# Open required ports
ufw allow 22
ufw allow 80
ufw allow 443
ufw --force enable
```

---

## 3. Install NVM & Node.js

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc

nvm install 20
nvm use 20
nvm alias default 20

# Verify
node -v   # v20.x.x
npm -v
```

---

## 4. Install Redis

```bash
apt install -y redis-server

systemctl enable redis-server
systemctl start redis-server

# Verify
redis-cli ping   # PONG
```

---

## 5. Configure PostgreSQL

> Skip install if PostgreSQL is already installed on your VPS.

```bash
# Install if needed
apt install -y postgresql postgresql-contrib postgresql-client

systemctl enable postgresql
systemctl start postgresql
```

### Create database and user

```bash
sudo -u postgres psql
```

```sql
CREATE USER medusa_user WITH PASSWORD 'yourpassword';
CREATE DATABASE medusa_db OWNER medusa_user;
GRANT ALL PRIVILEGES ON DATABASE medusa_db TO medusa_user;
\q
```

### Verify connection

```bash
psql "postgres://medusa_user:yourpassword@localhost:5432/medusa_db" -c "SELECT 1;"
```

You should see `1` returned. If not, check `systemctl status postgresql` and your password.

---

## 6. Restore Database from Local

### On your local machine — dump the database:

```bash
pg_dump -U postgres -d your_local_db_name -F c -f medusa_backup.dump
```

### Transfer dump to VPS:

```bash
scp medusa_backup.dump root@your-vps-ip:/root/medusa_backup.dump
```

### On VPS — restore:

```bash
pg_restore -U medusa_user -d medusa_db /root/medusa_backup.dump
```

---

## 7. Install PM2

```bash
npm install -g pm2

# Enable auto-start on VPS reboot
pm2 startup
# Run the command it outputs, then:
pm2 save
```

---

## 8. Setup SSH Keys

You need **two SSH keys** for two different connection directions:

| Key | Initiator | Receiver | Private key location | Public key location |
|-----|-----------|----------|----------------------|---------------------|
| Deploy Key | VPS | GitHub | `/root/.ssh/deploy_key` (on VPS) | GitHub → Deploy keys |
| Actions Key | GitHub Actions | VPS | GitHub → Secrets | `/root/.ssh/authorized_keys` (on VPS) |

> **Rule of thumb:** the side that *initiates* the connection holds the **private** key; the side that *receives* it holds the **public** key.

### Key 1 — Deploy Key (lets VPS pull private GitHub repo)

```bash
ssh-keygen -t ed25519 -C "vps-deploy-key" -f ~/.ssh/deploy_key -N ""
cat ~/.ssh/deploy_key.pub
```

Copy the output → go to GitHub repo → **Settings → Deploy keys → Add deploy key**
- Title: `VPS`
- Key: paste the public key
- Allow read access only ✅

Configure SSH to use this key for GitHub:

```bash
nano ~/.ssh/config
```

```
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/deploy_key
```

Trust GitHub's host key (so it doesn't prompt during automated runs):

```bash
ssh-keyscan github.com >> ~/.ssh/known_hosts
```

Verify:

```bash
ssh -T git@github.com
# Expected: "Hi suhaibbaba! You've successfully authenticated..."
```

### Key 2 — GitHub Actions Key (lets Actions SSH into VPS)

```bash
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions -N ""
cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# Copy this private key — you'll paste it into GitHub secrets
cat ~/.ssh/github_actions
```

### Add GitHub Secrets

Go to repo → **Settings → Secrets and variables → Actions → New repository secret**

| Secret | Value |
|--------|-------|
| `VPS_HOST` | Your VPS IP (no `http://`, no trailing slash) |
| `VPS_USER` | `root` |
| `VPS_SSH_KEY` | Full private key from Key 2 (including `-----BEGIN/END-----` lines) |
| `VPS_PORT` | `22` |

---

## 9. Create Environment Files

> **Important:** Store `.env` files **outside** the cloned repo so they survive any `git clone` / `rm -rf` operation. We'll symlink them into the repo.

### Backend `.env`

```bash
nano /root/.env.backend
```

```env
DATABASE_URL=postgres://medusa_user:yourpassword@localhost:5432/medusa_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_jwt_secret_here
COOKIE_SECRET=your_cookie_secret_here
NODE_ENV=production
PORT=4100
STORE_CORS=https://organza-moda.com,https://www.organza-moda.com
ADMIN_CORS=https://api.organza-moda.com
AUTH_CORS=https://organza-moda.com,https://www.organza-moda.com,https://api.organza-moda.com
```

### Frontend `.env`

```bash
nano /root/.env.frontend
```

```env
NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://api.organza-moda.com
NODE_ENV=production
PORT=4101
```

### Create symlinks (after first clone)

After the first clone, link the env files into the repo:

```bash
ln -sf /root/.env.backend /root/organza-store/backend/.env
ln -sf /root/.env.frontend /root/organza-store/frontend/.env
```

---

## 10. Create PM2 Ecosystem Config

```bash
nano /root/ecosystem.config.js
```

```js
module.exports = {
  apps: [
    {
      name: "medusa",
      cwd: "/root/organza-store/backend/.medusa/server",
      script: "npm",
      args: "run start",
      env: {
        NODE_ENV: "production",
        PORT: 4100,
      },
      restart_delay: 3000,
      max_restarts: 10,
      autorestart: true,
      watch: false,
    },
    {
      name: "nextjs",
      cwd: "/root/organza-store/frontend",
      script: "npm",
      args: "run start",
      env: {
        NODE_ENV: "production",
        PORT: 4101,
      },
      restart_delay: 3000,
      max_restarts: 10,
      autorestart: true,
      watch: false,
    },
  ],
}
```

> ⚠️ The PM2 app names (`medusa`, `nextjs`) **must match** the names referenced in the GitHub Actions workflow (`pm2 reload --only medusa`).

---

## 11. DNS Records

> **Do this BEFORE configuring Nginx SSL.** Certbot needs the domains to resolve to your VPS IP for verification.

In your domain provider (Hostinger, Namecheap, Cloudflare, etc.):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | your VPS IP | 14400 |
| A | `www` | your VPS IP | 14400 |
| A | `api` | your VPS IP | 14400 |

> If your domain is using "parked" nameservers (e.g. `ns1.dns-parking.com`), change them to your provider's active nameservers (e.g. `ns1.hostinger.com`).

### Verify DNS propagation

Wait 5–30 minutes, then check from the VPS:

```bash
dig organza-moda.com +short
dig www.organza-moda.com +short
dig api.organza-moda.com +short
```

All three should return your VPS IP. **Don't proceed until they do.**

---

## 12. Configure Nginx

```bash
apt install -y nginx
systemctl enable nginx
systemctl start nginx
```

> **Important:** Start with HTTP-only configs. Certbot will add the SSL parts automatically in the next step. If you start with SSL config but no certificate, `nginx -t` will fail.

### Backend — `api.organza-moda.com` (HTTP-only initial config)

```bash
nano /etc/nginx/sites-available/api.organza-moda.com
```

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name api.organza-moda.com;

    location / {
        proxy_pass http://localhost:4100;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Frontend — `organza-moda.com` (HTTP-only initial config)

```bash
nano /etc/nginx/sites-available/organza-moda.com
```

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name organza-moda.com www.organza-moda.com;

    location / {
        proxy_pass http://localhost:4101;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Enable configs

```bash
ln -s /etc/nginx/sites-available/api.organza-moda.com /etc/nginx/sites-enabled/
ln -s /etc/nginx/sites-available/organza-moda.com /etc/nginx/sites-enabled/

# Remove default site if it exists
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl restart nginx
```

---

## 13. SSL with Certbot

```bash
apt install -y certbot python3-certbot-nginx

certbot --nginx -d organza-moda.com -d www.organza-moda.com -d api.organza-moda.com
```

When prompted:
- **Email:** your email address
- **Terms:** `Y`
- **Share email:** `N` (optional)
- **Redirect HTTP to HTTPS:** choose `2` (recommended)

Certbot will automatically:
- Generate certificates in `/etc/letsencrypt/live/organza-moda.com/`
- Add `listen 443 ssl` and certificate paths to your Nginx configs
- Add HTTP → HTTPS redirects
- Reload Nginx

### Enable HTTP/2 (optional but recommended)

After Certbot finishes, edit each site and add `http2` to the `listen 443` lines:

```bash
nano /etc/nginx/sites-available/api.organza-moda.com
```

Change:
```nginx
listen 443 ssl;
listen [::]:443 ssl;
```

To:
```nginx
listen 443 ssl http2;
listen [::]:443 ssl http2;
```

> ⚠️ **Do NOT use `http2 on;` directive** — that syntax requires Nginx ≥ 1.25.1. On Nginx 1.24 (default Ubuntu 22.04), use the `http2` parameter on the `listen` line as shown above.

Repeat for `organza-moda.com`, then:

```bash
nginx -t
systemctl reload nginx
```

### Auto-renewal

Certbot installs a systemd timer that auto-renews certificates. Verify it's active:

```bash
systemctl status certbot.timer
```

---

## 14. GitHub Actions CI/CD

Create these files in your local project and push them to trigger deployments.

### `.github/workflows/deploy-backend.yml`

```yaml
name: Deploy Backend

on:
  push:
    branches:
      - main
    paths:
      - 'backend/**'
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Pull latest code
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          port: ${{ secrets.VPS_PORT }}
          script: |
            if [ ! -d "/root/organza-store/.git" ]; then
              rm -rf /root/organza-store
              git clone git@github.com:suhaibbaba/organza-store.git /root/organza-store
            fi
            cd /root/organza-store
            git fetch origin main
            git reset --hard origin/main
            # Restore env symlinks (in case the repo was re-cloned)
            ln -sf /root/.env.backend /root/organza-store/backend/.env
            ln -sf /root/.env.frontend /root/organza-store/frontend/.env

      - name: Install dependencies
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          port: ${{ secrets.VPS_PORT }}
          script: |
            export NVM_DIR="$HOME/.nvm"
            source "$NVM_DIR/nvm.sh"
            cd /root/organza-store/backend
            npm install

      - name: Build Medusa
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          port: ${{ secrets.VPS_PORT }}
          timeout: 60s
          command_timeout: 20m
          script: |
            export NVM_DIR="$HOME/.nvm"
            source "$NVM_DIR/nvm.sh"
            cd /root/organza-store/backend
            npx medusa build
            cd .medusa/server
            npm install
            # The built server needs its own .env.production
            cp /root/.env.backend .env.production

      - name: Run migrations
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          port: ${{ secrets.VPS_PORT }}
          script: |
            export NVM_DIR="$HOME/.nvm"
            source "$NVM_DIR/nvm.sh"
            cd /root/organza-store/backend/.medusa/server
            NODE_ENV=production npx medusa db:migrate
            NODE_ENV=production npx medusa db:sync-links

      - name: Restart Medusa
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          port: ${{ secrets.VPS_PORT }}
          script: |
            export NVM_DIR="$HOME/.nvm"
            source "$NVM_DIR/nvm.sh"
            pm2 describe medusa > /dev/null 2>&1 \
              && pm2 reload /root/ecosystem.config.js --only medusa \
              || pm2 start /root/ecosystem.config.js --only medusa
            pm2 save
```

### `.github/workflows/deploy-frontend.yml`

```yaml
name: Deploy Frontend

on:
  push:
    branches:
      - main
    paths:
      - 'frontend/**'
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Pull latest code
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          port: ${{ secrets.VPS_PORT }}
          script: |
            if [ ! -d "/root/organza-store/.git" ]; then
              rm -rf /root/organza-store
              git clone git@github.com:suhaibbaba/organza-store.git /root/organza-store
            fi
            cd /root/organza-store
            git fetch origin main
            git reset --hard origin/main
            # Restore env symlinks (in case the repo was re-cloned)
            ln -sf /root/.env.backend /root/organza-store/backend/.env
            ln -sf /root/.env.frontend /root/organza-store/frontend/.env

      - name: Install dependencies
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          port: ${{ secrets.VPS_PORT }}
          script: |
            export NVM_DIR="$HOME/.nvm"
            source "$NVM_DIR/nvm.sh"
            cd /root/organza-store/frontend
            npm install

      - name: Build Next.js
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          port: ${{ secrets.VPS_PORT }}
          timeout: 60s
          command_timeout: 20m
          script: |
            export NVM_DIR="$HOME/.nvm"
            source "$NVM_DIR/nvm.sh"
            cd /root/organza-store/frontend
            npm run build

      - name: Restart Next.js
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          port: ${{ secrets.VPS_PORT }}
          script: |
            export NVM_DIR="$HOME/.nvm"
            source "$NVM_DIR/nvm.sh"
            pm2 describe nextjs > /dev/null 2>&1 \
              && pm2 reload /root/ecosystem.config.js --only nextjs \
              || pm2 start /root/ecosystem.config.js --only nextjs
            pm2 save
```

### Trigger a deployment manually

Go to repo → **Actions** → select workflow → **Run workflow** → choose `main` → **Run workflow**.

---

## 15. Useful Commands

### PM2

| Task | Command |
|------|---------|
| List all apps | `pm2 list` |
| Start all | `pm2 start /root/ecosystem.config.js` |
| Reload all | `pm2 reload /root/ecosystem.config.js` |
| Restart one | `pm2 restart medusa` |
| Stop one | `pm2 stop medusa` |
| Backend logs | `pm2 logs medusa` |
| Frontend logs | `pm2 logs nextjs` |
| Monitor CPU/RAM | `pm2 monit` |
| Save current state | `pm2 save` |

### Nginx

| Task | Command |
|------|---------|
| Test config | `nginx -t` |
| Reload | `systemctl reload nginx` |
| Restart | `systemctl restart nginx` |
| View error log | `tail -f /var/log/nginx/error.log` |
| View access log | `tail -f /var/log/nginx/access.log` |

### PostgreSQL

| Task | Command |
|------|---------|
| Open psql as postgres | `sudo -u postgres psql` |
| Connect to medusa_db | `psql -U medusa_user -d medusa_db -h localhost` |
| Check status | `systemctl status postgresql` |
| Test connection string | `psql "postgres://medusa_user:pass@localhost:5432/medusa_db" -c "SELECT 1;"` |

### Redis

| Task | Command |
|------|---------|
| Ping | `redis-cli ping` |
| Check status | `systemctl status redis-server` |
| Open CLI | `redis-cli` |

### Medusa migrations (run from `/root/organza-store/backend/.medusa/server`)

| Task | Command |
|------|---------|
| Run pending migrations | `NODE_ENV=production npx medusa db:migrate` |
| Sync module links | `NODE_ENV=production npx medusa db:sync-links` |
| Full DB setup (first time) | `NODE_ENV=production npx medusa db:setup` |
| Generate new migration | `npx medusa db:generate <module>` |

### Test endpoints

```bash
curl https://api.organza-moda.com/health   # {"status":"ok"}
curl https://organza-moda.com              # Next.js page
```

---

## 16. Troubleshooting

### Nginx: `unknown directive "http2"`

Your Nginx version is < 1.25.1 and doesn't support the standalone `http2 on;` directive. Use `http2` as a parameter on the `listen` line instead:

```nginx
listen 443 ssl http2;          # ✅ correct for Nginx 1.24
listen [::]:443 ssl http2;
```

### Certbot: `cannot load certificate ... No such file or directory`

The Nginx config references SSL certs that don't exist yet. Either:
- Comment out the `ssl_*` lines and the `listen 443 ssl` block, then run Certbot, **or**
- Use the HTTP-only initial config from section 12 above.

### Certbot: `NXDOMAIN looking up A for ...`

The domain doesn't have a DNS A record pointing to your VPS. Add it in your DNS provider (section 11), wait 5–15 minutes, verify with `dig`, then re-run Certbot.

### Git: `destination path already exists and is not an empty directory`

The deploy script tried to clone into an existing non-git folder. Fix:

```bash
rm -rf /root/organza-store
# Then re-run the workflow
```

### Medusa: `Unknown arguments: migrations, run`

You're using the old Medusa v1 command. Use:

```bash
NODE_ENV=production npx medusa db:migrate
NODE_ENV=production npx medusa db:sync-links
```

### Medusa: `Pg connection failed` / `redisUrl not found`

The `.env.production` file isn't being loaded. Check:

```bash
# Make sure the file exists in the built server folder
ls -la /root/organza-store/backend/.medusa/server/.env.production

# Check it has the right content
cat /root/organza-store/backend/.medusa/server/.env.production | grep -E "DATABASE_URL|REDIS_URL"

# If missing, copy it
cp /root/.env.backend /root/organza-store/backend/.medusa/server/.env.production
```

Also verify the database is reachable:

```bash
psql "$(grep DATABASE_URL /root/.env.backend | cut -d= -f2-)" -c "SELECT 1;"
```

### PM2 app keeps restarting

Check the logs:

```bash
pm2 logs medusa --lines 100
```

Common causes: missing `.env.production`, database not reachable, Redis not running, port already in use.

---

## Ports Reference

| Service | Port |
|---------|------|
| Medusa backend | `4100` |
| Next.js frontend | `4101` |
| PostgreSQL | `5432` |
| Redis | `6379` |
| Nginx HTTP | `80` |
| Nginx HTTPS | `443` |
| SSH | `22` |

---

## Flow Summary

```
git push backend/** → deploy-backend.yml → SSH into VPS
                                         → git fetch + reset --hard
                                         → restore env symlinks
                                         → npm install
                                         → medusa build
                                         → db:migrate + db:sync-links
                                         → pm2 reload medusa

git push frontend/** → deploy-frontend.yml → SSH into VPS
                                           → git fetch + reset --hard
                                           → restore env symlinks
                                           → npm install
                                           → next build
                                           → pm2 reload nextjs
```

---

## Setup Order Checklist

For a fresh VPS, follow this exact order:

- [ ] 1. Connect to VPS
- [ ] 2. Initial server setup (apt update, firewall)
- [ ] 3. Install Node.js via NVM
- [ ] 4. Install Redis
- [ ] 5. Install & configure PostgreSQL
- [ ] 6. Restore database (if migrating)
- [ ] 7. Install PM2
- [ ] 8. Setup SSH keys (both Deploy Key and Actions Key)
- [ ] 9. Create env files outside the repo (`/root/.env.backend`, `/root/.env.frontend`)
- [ ] 10. Create PM2 ecosystem config
- [ ] 11. **Add DNS records and wait for propagation**
- [ ] 12. Configure Nginx with HTTP-only configs
- [ ] 13. Run Certbot to add SSL automatically
- [ ] 14. (Optional) Add `http2` to listen lines
- [ ] 15. Push GitHub Actions workflow files
- [ ] 16. Trigger first deployment manually from Actions tab