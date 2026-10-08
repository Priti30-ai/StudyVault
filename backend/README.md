# StudyVault Backend

Backend service for StudyVault — Cloud-Based Student Document & Notes Management System.

## Architecture Overview

Built with Node.js and Express, providing RESTful APIs for student document management, authentication, and cloud storage integration.

```text
backend/
├── src/
│   ├── config/          # Configuration files (DB, AWS, environment)
│   ├── controllers/     # Route controllers / business logic
│   ├── middleware/      # Custom Express middleware (auth, error, rate-limiting)
│   ├── models/          # Mongoose data models
│   ├── routes/          # Express route definitions
│   ├── services/        # External services (AWS S3, email, etc.)
│   ├── utils/           # Utility functions and helpers
│   ├── app.js           # Express application setup
│   └── server.js        # Server entry point
├── tests/               # Backend test suites
├── .env.example         # Example environment variables
├── .gitignore           # Git ignore file for backend
├── package.json         # Dependencies and scripts
└── README.md            # Backend documentation
```

## Getting Started

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Available variables:

| Variable | Description | Default |
| --- | --- | --- |
| `PORT` | Port the server listens on | `5000` |
| `NODE_ENV` | Environment mode (`development` / `production`) | `development` |
| `CLIENT_URL` | Allowed frontend origin for CORS | `http://localhost:5173` |

### 3. Run Development Server

```bash
npm run dev
```

### 4. Run Production Server

```bash
npm start
```

## Available Endpoints (Phase 1)

* `GET /api/health` — Service health check endpoint
  * Returns: `{ "success": true, "message": "StudyVault API is healthy" }`
