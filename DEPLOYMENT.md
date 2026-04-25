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
11. [Configure Nginx](#11-configure-nginx)
12. [SSL with Certbot](#12-ssl-with-certbot)
13. [GitHub Actions CI/CD](#13-github-actions-cicd)
14. [Useful Commands](#14-useful-commands)

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
apt install -y git curl nano
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
apt install -y postgresql postgresql-contrib

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
\q
```

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

You need **two SSH keys**:
- **Deploy Key** — lets VPS pull your private GitHub repo
- **Actions Key** — lets GitHub Actions SSH into your VPS

### Key 1 — Deploy Key (private repo access)

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

Trust GitHub's host key:

```bash
ssh-keyscan github.com >> ~/.ssh/known_hosts
```

### Key 2 — GitHub Actions Key (lets Actions SSH into VPS)

```bash
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions -N ""
cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys

# Copy this private key — you'll paste it into GitHub secrets
cat ~/.ssh/github_actions
```

### Add GitHub Secrets

Go to repo → **Settings → Secrets and variables → Actions → New repository secret**

| Secret | Value |
|--------|-------|
| `VPS_HOST` | Your VPS IP (no http://, no trailing slash) |
| `VPS_USER` | `root` |
| `VPS_SSH_KEY` | Full private key from Key 2 (including header/footer) |
| `VPS_PORT` | `22` |

---

## 9. Create Environment Files

### Backend `.env`

```bash
mkdir -p /root/organza-store/backend
nano /root/organza-store/backend/.env
```

```env
DATABASE_URL=postgres://medusa_user:yourpassword@localhost:5432/medusa_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_jwt_secret_here
COOKIE_SECRET=your_cookie_secret_here
NODE_ENV=production
PORT=4100
```

### Frontend `.env`

```bash
mkdir -p /root/organza-store/frontend
nano /root/organza-store/frontend/.env
```

```env
NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://api.organza-moda.com
NODE_ENV=production
PORT=4101
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

---

## 11. Configure Nginx

```bash
apt install -y nginx
systemctl enable nginx
systemctl start nginx
```

### Backend — `api.organza-moda.com`

```bash
nano /etc/nginx/sites-available/api.organza-moda.com
```

```nginx
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name api.organza-moda.com;

    ssl_certificate /etc/letsencrypt/live/organza-moda.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/organza-moda.com/privkey.pem;

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

server {
    listen 80;
    listen [::]:80;
    server_name api.organza-moda.com;
    return 301 https://$host$request_uri;
}
```

### Frontend — `organza-moda.com`

```bash
nano /etc/nginx/sites-available/organza-moda.com
```

```nginx
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name organza-moda.com www.organza-moda.com;

    ssl_certificate /etc/letsencrypt/live/organza-moda.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/organza-moda.com/privkey.pem;

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

server {
    listen 80;
    listen [::]:80;
    server_name organza-moda.com www.organza-moda.com;
    return 301 https://$host$request_uri;
}
```

### Enable configs

```bash
ln -s /etc/nginx/sites-available/api.organza-moda.com /etc/nginx/sites-enabled/
ln -s /etc/nginx/sites-available/organza-moda.com /etc/nginx/sites-enabled/

nginx -t
systemctl restart nginx
```

### DNS Records

Add these in your domain provider's DNS panel:

| Type | Name | Value |
|------|------|-------|
| A | `@` | your VPS IP |
| A | `www` | your VPS IP |
| A | `api` | your VPS IP |

---

## 12. SSL with Certbot

```bash
apt install -y certbot python3-certbot-nginx

certbot --nginx -d organza-moda.com -d www.organza-moda.com -d api.organza-moda.com
```

Certbot auto-renews — no manual action needed.

---

## 13. GitHub Actions CI/CD

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
              git clone git@github.com:suhaibbaba/organza-store.git /root/organza-store
            fi
            cd /root/organza-store
            git pull origin main

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
            if [ package.json -nt node_modules ]; then
              npm install
            fi

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
            if [ /root/organza-store/backend/package.json -nt node_modules ]; then
              npm install
            fi
            cp /root/organza-store/backend/.env .env.production

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
            NODE_ENV=production npx medusa migrations run

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
              git clone git@github.com:suhaibbaba/organza-store.git /root/organza-store
            fi
            cd /root/organza-store
            git pull origin main

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
            if [ package.json -nt node_modules ]; then
              npm install
            fi

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

---

## 14. Useful Commands

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

### Nginx

| Task | Command |
|------|---------|
| Test config | `nginx -t` |
| Reload | `systemctl reload nginx` |
| Restart | `systemctl restart nginx` |

### PostgreSQL

| Task | Command |
|------|---------|
| Open psql | `sudo -u postgres psql` |
| Check status | `systemctl status postgresql` |

### Redis

| Task | Command |
|------|---------|
| Ping | `redis-cli ping` |
| Check status | `systemctl status redis-server` |

### Test endpoints

```bash
curl https://api.organza-moda.com/health   # {"status":"ok"}
curl https://organza-moda.com              # Next.js page
```

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
                                         → git pull
                                         → npm install (if needed)
                                         → medusa build
                                         → migrations run
                                         → pm2 reload medusa

git push frontend/** → deploy-frontend.yml → SSH into VPS
                                           → git pull
                                           → npm install (if needed)
                                           → next build
                                           → pm2 reload nextjs
```
