# StudyVault — Production Deployment & Operations Guide

## 1. Prerequisites

- **AWS EC2 Instance**:
  - OS: Amazon Linux 2023 (or Ubuntu 22.04 LTS).
  - Instance Type: `t3.micro` (eligible for AWS Free Tier).
  - Region: `ap-southeast-2` (Sydney).
  - IAM Role attached: `StudyVaultEC2Role` (Instance Profile with S3 permissions).
- **Installed Software on EC2**:
  - Docker & Docker Compose (`docker-compose` or `docker compose`).
  - Git.
- **DNS & Networking**:
  - Dynamic DNS configured to EC2 Public IP (`studyvault-priti.duckdns.org` &rarr; `3.106.220.253`).
  - EC2 Security Group Inbound Rules:
    - Port 22 (SSH)
    - Port 80 (HTTP)
    - Port 443 (HTTPS)
  - Port 5000: Internal only (not exposed in Security Group).

---

## 2. Directory Layout on EC2

```
/home/ec2-user/StudyVault/
├── docker-compose.yml
├── backend/
│   ├── .env                 # Untracked production secrets (never committed)
│   ├── .env.example         # Reference placeholders
│   ├── Dockerfile
│   └── src/
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf           # Reverse proxy, SSL, and security headers
│   └── src/
└── docs/
```

---

## 3. Environment Variable Configuration

Create or verify the production environment file at `/home/ec2-user/StudyVault/backend/.env`:

```ini
PORT=5000
NODE_ENV=production
CLIENT_URL=https://studyvault-priti.duckdns.org
FRONTEND_URL=https://studyvault-priti.duckdns.org

MONGODB_URI=mongodb+srv://<db-user>:<db-password>@<cluster-url>/studyvault?retryWrites=true&w=majority

JWT_SECRET=<64-character-random-hex-secret>
JWT_EXPIRES_IN=7d

AWS_REGION=ap-southeast-2
AWS_S3_BUCKET=studyvault-priti-documents-2026
```

> **Note on AWS Credentials**: Do not set `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY`. The backend automatically inherits temporary rotating credentials from the attached `StudyVaultEC2Role` IAM instance profile.

---

## 4. Deployment Commands

### 4.1 Initial Setup / Update Code
```bash
# Connect to EC2 via PowerShell or terminal
ssh -i "$HOME\Downloads\StudyVault-Key.pem" ec2-user@3.106.220.253

# Navigate to project directory
cd /home/ec2-user/StudyVault

# Pull latest changes from GitHub
git pull origin feature/backend
```

### 4.2 Build and Launch Containers
```bash
# Rebuild and start in background
docker-compose up -d --build
```

### 4.3 Verify Container Status
```bash
# Check running containers
docker-compose ps

# Expected output:
# studyvault-backend    Up (healthy)    127.0.0.1:5000->5000/tcp
# studyvault-frontend   Up              0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
```

---

## 5. Health Checks & Verification

### 5.1 Local Health Checks on Host
```bash
# Verify backend API through Docker network / loopback
curl -i http://localhost:5000/api/health

# Verify frontend Nginx on port 80 (should return 301 redirect)
curl -i http://localhost/

# Verify frontend Nginx on port 443
curl -k -i https://localhost/
```

### 5.2 Public Endpoint Verification
```bash
# Test public HTTPS health
curl -i https://studyvault-priti.duckdns.org/api/health

# Test HTTP redirect to HTTPS
curl -i http://studyvault-priti.duckdns.org/
```

---

## 6. Certificate Management (Certbot & Let's Encrypt)

Certificates are mounted into the frontend container from external Docker volumes:
- `studyvault_certbot-webroot` &rarr; `/var/www/certbot`
- `studyvault_letsencrypt-data` &rarr; `/etc/letsencrypt`

### 6.1 Testing Certificate Renewal (Containerized)
Because Certbot runs in a dedicated Docker image on Amazon Linux 2023 without host dependencies:
```bash
# Dry run renewal check using existing Docker volumes
docker run --rm \
  -v studyvault_certbot-webroot:/var/www/certbot \
  -v studyvault_letsencrypt-data:/etc/letsencrypt \
  certbot/certbot renew --dry-run
```

### 6.2 Reloading Nginx after Renewal
```bash
docker exec studyvault-frontend nginx -s reload
```

### 6.3 Automated Renewal Setup via Systemd Timer (Amazon Linux 2023)
Create the systemd service `/etc/systemd/system/certbot-renew.service`:
```ini
[Unit]
Description=Certbot Automated TLS Renewal for StudyVault
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
ExecStart=/usr/bin/docker run --rm -v studyvault_certbot-webroot:/var/www/certbot -v studyvault_letsencrypt-data:/etc/letsencrypt certbot/certbot renew --webroot -w /var/www/certbot --quiet
ExecStartPost=/usr/bin/docker exec studyvault-frontend nginx -s reload
```

Create the companion timer `/etc/systemd/system/certbot-renew.timer`:
```ini
[Unit]
Description=Bi-monthly Timer for StudyVault TLS Renewal

[Timer]
OnCalendar=*-*-01,15 03:00:00
RandomizedDelaySec=3600
Persistent=true

[Install]
WantedBy=timers.target
```

Enable and start the timer:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now certbot-renew.timer
sudo systemctl list-timers --no-pager | grep certbot
```

---

## 7. Logs & Troubleshooting

| Goal | Command |
| :--- | :--- |
| View backend logs in real time | `docker-compose logs -f --tail=100 backend` |
| View frontend Nginx access/error logs | `docker-compose logs -f --tail=100 frontend` |
| Restart backend safely | `docker-compose restart backend` |
| Restart frontend safely | `docker-compose restart frontend` |
| Check memory & CPU usage | `docker stats --no-stream` |

---

## 8. Rollback Procedure

If a deployed update fails in production:
```bash
# 1. Revert to previous Git commit
git log -n 5 --oneline
git checkout <previous-commit-hash>

# 2. Rebuild and restart containers
docker-compose up -d --build

# 3. Verify health
curl -i http://localhost:5000/api/health
```
