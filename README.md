# StudyVault

Cloud-Based Student Document & Notes Management System

StudyVault is a cloud-based academic document management system that allows students to securely upload, organize, search, manage, and download their academic documents and notes.

## Technology Stack

- React + Vite + Tailwind CSS
- Node.js + Express
- MongoDB Atlas
- AWS S3
- Docker
- AWS ECS Fargate
- AWS CloudWatch
- JWT + bcrypt

## Team

- Member 1: Frontend
- Member 2: Backend, Database & Cloud

## Backend Containerization (Docker)

The StudyVault backend is containerized using a hardened, multi-stage Node.js 20 Alpine image running as a non-root user (`node`).

### 1. Build Docker Image
```bash
docker build -t studyvault-backend ./backend
```

### 2. Run with Runtime Configuration
Pass environment variables from your local untracked `backend/.env` file:
```bash
docker run --env-file ./backend/.env -p 5000:5000 studyvault-backend
```

### 3. Run with Docker Compose
```bash
docker compose up --build
```

### Architecture Notes
- **External Managed Services**: The backend connects to external MongoDB Atlas and AWS S3 via runtime environment variables; no database or file storage is hosted inside the container.
- **Zero Embedded Secrets**: The Docker image contains no `.env` files or credentials. All secrets are injected strictly at runtime.
- **Health Monitoring**: Built-in container healthcheck monitors `GET /api/health`.
