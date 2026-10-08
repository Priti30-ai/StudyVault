# StudyVault Backend

Backend service for **StudyVault** — Cloud-Based Student Document & Notes Management System.

---

## 1. Architecture Overview

Built with Node.js and Express, integrating MongoDB Atlas for document metadata storage and user accounts, with JWT-based authentication and bcrypt password hashing.

```text
backend/
├── src/
│   ├── config/          # Database connection (db.js)
│   ├── controllers/     # Authentication & business logic (authController.js)
│   ├── middleware/      # Auth, error, rate-limiting & 404 middlewares
│   ├── models/          # Mongoose data schemas (User.js)
│   ├── routes/          # API route definitions (auth.routes.js, health.routes.js)
│   ├── services/        # External cloud services (Reserved for AWS S3)
│   ├── utils/           # Helper utilities (jwt.js, password.js)
│   ├── app.js           # Express application configuration
│   └── server.js        # Server listener and database bootstrapper
├── tests/               # Automated test suites (health, auth, jwt, password)
├── .env.example         # Template for environment variables
├── .gitignore           # Git ignore rules for backend
├── package.json         # Package configuration and test scripts
└── README.md            # Backend documentation
```

---

## 2. Prerequisites

* **Node.js**: v18.0.0 or higher (v20+ recommended)
* **npm**: v9.0.0 or higher
* **MongoDB**: A running local MongoDB instance or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster

---

## 3. Installation

```bash
cd backend
npm install
```

---

## 4. Environment Variables

Copy `.env.example` to create your local `.env` file:

```bash
cp .env.example .env
```

Configurable variables:

| Variable | Description | Example / Default |
| --- | --- | --- |
| `PORT` | Port the backend server listens on | `5000` |
| `NODE_ENV` | Runtime environment (`development` / `production`) | `development` |
| `CLIENT_URL` | Allowed frontend URL for CORS origin validation | `http://localhost:5173` |
| `MONGODB_URI` | MongoDB connection string (Local or MongoDB Atlas) | `mongodb+srv://<user>:<password>@cluster0.mongodb.net/studyvault?retryWrites=true&w=majority` |
| `JWT_SECRET` | Strong secret key for signing JSON Web Tokens | `your_secure_random_jwt_secret_key` |
| `JWT_EXPIRES_IN`| Token lifespan / expiry duration | `7d` |

> [!CAUTION]
> Never commit `.env` or expose real database credentials / JWT secrets to Git.

---

## 5. MongoDB Atlas Setup Guide

1. Log in to [MongoDB Atlas](https://cloud.mongodb.com).
2. Create a free shared cluster (e.g. M0 tier).
3. Under **Security → Database Access**, create a database user with read/write permissions.
4. Under **Security → Network Access**, add your current IP address (or `0.0.0.0/0` for cloud deployment).
5. In **Database Deployments**, click **Connect** → **Drivers** (Node.js).
6. Copy the connection string into your `.env` as `MONGODB_URI` and replace `<password>` with your database user password.

---

## 6. Running Locally

### Development Mode (with hot reload via nodemon)

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

### Running Automated Tests

```bash
npm test
```

---

## 7. API Contract & Endpoints

### Standard Response Format

* **Success**:
  ```json
  {
    "success": true,
    "message": "Operation description",
    "data": {}
  }
  ```

* **Error**:
  ```json
  {
    "success": false,
    "message": "Error description"
  }
  ```

---

### Endpoints

#### 1. Service Health Check

* **Method**: `GET /api/health`
* **Access**: Public
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "StudyVault API is healthy"
  }
  ```

#### 2. Register New User

* **Method**: `POST /api/auth/register`
* **Access**: Public
* **Request Body**:
  ```json
  {
    "name": "Priti Ahire",
    "email": "priti@example.com",
    "password": "StrongPassword123"
  }
  ```
* **Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Registration successful",
    "data": {
      "user": {
        "id": "67a3f892b1234c0012ef4567",
        "name": "Priti Ahire",
        "email": "priti@example.com"
      },
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
  ```

#### 3. Log In

* **Method**: `POST /api/auth/login`
* **Access**: Public
* **Request Body**:
  ```json
  {
    "email": "priti@example.com",
    "password": "StrongPassword123"
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Login successful",
    "data": {
      "user": {
        "id": "67a3f892b1234c0012ef4567",
        "name": "Priti Ahire",
        "email": "priti@example.com"
      },
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
  ```

#### 4. Get Current User (`Me`)

* **Method**: `GET /api/auth/me`
* **Access**: Private (Requires valid JWT Bearer token)
* **Headers**:
  ```text
  Authorization: Bearer <token>
  ```
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Current user retrieved successfully",
    "data": {
      "user": {
        "id": "67a3f892b1234c0012ef4567",
        "name": "Priti Ahire",
        "email": "priti@example.com"
      }
    }
  }
  ```
* **Response (401 Unauthorized)**:
  ```json
  {
    "success": false,
    "message": "Authentication required"
  }
  ```

---

## 8. Security Specifications

* **Password Security**: Passwords are never stored in plain text; they are hashed using `bcryptjs` with 10 salt rounds.
* **JWT Tokens**: Signed with `JWT_SECRET` containing only the user's ID in the payload. Sensitive information like passwords or email hashes are never embedded in the token.
* **Data Sanitization**: The `User` model overrides `toJSON` and provides `toSafeObject()` so `passwordHash` and internal versioning (`__v`) are never serialized in API responses.
* **CORS Whitelisting**: Strict origin matching against `CLIENT_URL` prevents unauthorized cross-origin requests.
* **Rate Limiting**: Integrated `express-rate-limit` throttles brute-force login and registration attempts (100 requests per 15 minutes per IP).
* **HTTP Headers**: `helmet` enforces security headers (`X-Content-Type-Options: nosniff`, `Content-Security-Policy`, `X-Frame-Options: SAMEORIGIN`).
