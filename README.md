# StudyVault — Cloud-Based Academic Notes & Document Management System

![StudyVault Architecture](https://img.shields.io/badge/AWS-EC2%20%7C%20S3%20%7C%20IAM-FF9900?logo=amazon-aws)
![Node.js](https://img.shields.io/badge/Backend-Node.js%2020%20%7C%20Express-339933?logo=node.js)
![React](https://img.shields.io/badge/Frontend-React%2018%20%7C%20Vite-61DAFB?logo=react)
![Database](https://img.shields.io/badge/Database-MongoDB%20Atlas-47A248?logo=mongodb)
![Tests](https://img.shields.io/badge/Tests-99%2F99%20Passing-brightgreen)
![License](https://img.shields.io/badge/License-ISC-blue)

StudyVault is a secure, cloud-based academic document management platform engineered for students to upload, organize, search, analyze, and retrieve academic notes, question papers, and study resources. Deployed on AWS EC2 with Amazon S3 file storage and MongoDB Atlas metadata management, StudyVault provides enterprise-grade data isolation, time-limited presigned downloads, and audit trail logging.

---

## 1. Key Features

- **Secure Student Authentication**: Email and password registration with bcrypt hashing (10 rounds), JSON Web Tokens (JWT), session recovery via `/api/auth/me`, and rate-limiting against brute force attacks.
- **Direct Cloud Document Storage**: Academic documents (PDF, DOCX, TXT, images) are streamed to a private AWS S3 bucket partitioned by user ID (`users/{userId}/{uuid}.pdf`).
- **Temporary Presigned S3 Downloads**: Private S3 objects are downloaded through temporary cryptographic URLs valid for only 300 seconds, preventing link sharing or unauthorized downloads.
- **Live Search & Filter Engine**: Debounced search by document title, subject, or tag, paired with category and semester filters and server-side pagination.
- **Analytics Dashboard**: Aggregated overview metrics (total documents, total bytes stored, favorites count, category distributions, recent files).
- **Activity & Audit Trail**: Real-time logging of user actions (`UPLOAD`, `DOWNLOAD`, `UPDATE`, `DELETE`, `FAVORITE`, `UNFAVORITE`).
- **Multi-Tenant Data Isolation**: Strict user-level authorization checks ensuring students cannot access, edit, download, or delete other users' documents.
- **Automated Orphan Cleanup**: S3 rollback mechanisms delete binary files if database writes fail, and document deletions purge S3 binaries first to prevent orphaned storage.

---

## 2. Technology Stack

| Layer | Technologies & Services |
| :--- | :--- |
| **Frontend** | React 18, Vite 5, Lucide Icons, Vanilla CSS Design System |
| **Backend API** | Node.js 20, Express 4, Multer, Helmet, Morgan, Express-Rate-Limit |
| **Database** | MongoDB Atlas (M0 Replica Set in AWS Sydney) |
| **Storage** | Amazon S3 (`studyvault-priti-documents-2026` in `ap-southeast-2`) |
| **Cloud Compute** | AWS EC2 `t3.micro` (Amazon Linux 2023) |
| **IAM Security** | EC2 Instance Profile (`StudyVaultEC2Role`) with least-privilege S3 policy |
| **Reverse Proxy & TLS**| Nginx Alpine, Let's Encrypt SSL/TLS, Certbot webroot challenge |
| **Containerization**| Docker, Multi-Stage Dockerfiles, Docker Compose |
| **Testing** | Node.js Test Runner, Supertest (34 test suites, 99 tests) |

---

## 3. System Architecture

```mermaid
graph TD
    User["Student Browser"] -->|HTTPS :443| Nginx["Nginx Reverse Proxy & Static Host"]
    User -.->|HTTP :80| Redirect["HTTP 301 Redirect"]
    Redirect -.-> User

    subgraph "AWS EC2 Instance (Amazon Linux 2023 - Sydney)"
        subgraph "Docker Compose"
            Nginx -->|Static Assets| ReactApp["React 18 Production Bundle"]
            Nginx -->|Proxy Pass /api/*| ExpressAPI["Express.js API Container (:5000)"]
        end
        ExpressAPI -->|IAM Instance Profile: StudyVaultEC2Role| IMDS["EC2 IMDSv2 (Temporary Credentials)"]
    end

    subgraph "Cloud Data & Storage"
        ExpressAPI -->|TLS Mongoose Connection| Atlas[("MongoDB Atlas")]
        ExpressAPI -->|PutObject / DeleteObject| S3Bucket[("Private Amazon S3 Bucket")]
        ExpressAPI -.->|Generate Presigned URL (300s)| User
        User -->|Direct Download| S3Bucket
    end
```

---

## 4. Local Development Setup

### 4.1 Prerequisites
- Node.js &ge; 20.x
- npm &ge; 10.x
- Git

### 4.2 Installation

```bash
# Clone the repository
git clone https://github.com/Priti30-ai/StudyVault.git
cd StudyVault

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 4.3 Environment Configuration

Create a `.env` file in the `backend/` directory based on `backend/.env.example`:

```ini
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
FRONTEND_URL=http://localhost:5173

MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-url>/studyvault?retryWrites=true&w=majority

JWT_SECRET=replace_with_a_long_random_secret_for_local_dev
JWT_EXPIRES_IN=7d

AWS_REGION=ap-southeast-2
AWS_S3_BUCKET=studyvault-priti-documents-2026
```

### 4.4 Running Locally

```bash
# Start backend API (from backend/ directory)
npm run dev

# Start frontend dev server (from frontend/ directory in another terminal)
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## 5. Automated Tests and Build Verification

```bash
# Run backend regression tests (99/99 tests across 34 suites)
cd backend
npm test

# Run frontend production build
cd ../frontend
npm run build
```

---

## 6. AWS Production Deployment Architecture

The production environment runs on an **AWS EC2 `t3.micro`** instance in Sydney (`ap-southeast-2`):

```bash
# Connect to EC2
ssh -i "$HOME\Downloads\StudyVault-Key.pem" ec2-user@3.106.220.253

# Pull latest changes and deploy
cd /home/ec2-user/StudyVault
git pull origin feature/backend
docker-compose up -d --build

# Verify container status
docker-compose ps
```

- **Live URL**: [https://studyvault-priti.duckdns.org](https://studyvault-priti.duckdns.org)
- **API Health**: [https://studyvault-priti.duckdns.org/api/health](https://studyvault-priti.duckdns.org/api/health)

---

## 7. Security Controls

1. **IAM Least Privilege**: The backend uses an IAM Instance Profile (`StudyVaultEC2Role`) granting only `PutObject`, `GetObject`, `DeleteObject`, and `ListBucket` on the private bucket. No AWS keys are saved on disk.
2. **Private S3 Storage**: S3 Block Public Access is enabled across all 4 settings. File retrieval requires temporary HMAC-SHA256 presigned URLs valid for 5 minutes.
3. **Defense-in-Depth Network Isolation**: Backend port 5000 is bound only to `127.0.0.1:5000` on the EC2 host. All external traffic must enter through Nginx on HTTPS port 443.
4. **Input Sanitization & Injection Defense**: Path traversal sanitization with `path.basename()`, regex character escaping for search queries, NoSQL injection resistance, and Helmet HTTP security headers.
5. **Rate Limiting**: Anti-brute-force rate limiting on login/registration endpoints (15 req/15 min).

---

## 8. Documentation Index

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — Comprehensive technical architecture, component breakdown, and sequence diagrams.
- [docs/SECURITY.md](docs/SECURITY.md) — Threat model, security controls, IAM policies, and forensic analysis of the Chrome deceptive site warning.
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — EC2 deployment instructions, Docker Compose configuration, Let's Encrypt renewal, and recovery.
- [docs/TESTING.md](docs/TESTING.md) — Automated test suite results, manual verification steps, and regression coverage.
- [docs/DEMO_CHECKLIST.md](docs/DEMO_CHECKLIST.md) — 5–7 minute college project evaluation plan, screenshot suggestions, and presentation tips.

---

## 9. Project Limitations & Future Scope

- **Domain Reputation**: The project currently uses a free dynamic DNS subdomain (`duckdns.org`). For institutional deployment, migrating to an institutional top-level domain (e.g. `.edu` or `.com`) eliminates public heuristics flags.
- **Horizontal Scalability**: Currently running on a single EC2 host with Docker Compose. Future iterations can incorporate an AWS Application Load Balancer (ALB) and Auto Scaling Groups (ASG).
- **OCR Search**: Future versions can leverage Amazon Textract to index text inside uploaded PDF notes for full-text search.
