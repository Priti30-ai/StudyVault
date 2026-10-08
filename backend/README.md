# StudyVault Backend

Backend service for **StudyVault** — Cloud-Based Student Document & Notes Management System.

---

## 1. Architecture Overview

Built with Node.js and Express, integrating MongoDB Atlas for document metadata storage and user accounts, with JWT-based authentication, bcrypt password hashing, and user-isolated Document CRUD operations.

```text
backend/
├── src/
│   ├── config/          # Database connection (db.js)
│   ├── controllers/     # Auth & Document controllers
│   ├── middleware/      # Auth, error, rate-limiting & 404 middlewares
│   ├── models/          # Mongoose data schemas (User.js, Document.js)
│   ├── routes/          # API route definitions (auth, document, health)
│   ├── services/        # External cloud services (Reserved for AWS S3)
│   ├── utils/           # Helper utilities (jwt.js, password.js)
│   ├── app.js           # Express application configuration
│   └── server.js        # Server listener and database bootstrapper
├── tests/               # Automated test suites (health, auth, document, jwt, password)
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

## 7. Data Models

### User Schema

* `name`: String, required, trimmed, min 2 / max 50 chars.
* `email`: String, required, trimmed, lowercase, unique, regex email validation.
* `passwordHash`: String, required (hashed with bcrypt).
* `timestamps`: `createdAt`, `updatedAt`.

### Document Schema

* `userId`: ObjectId (ref: User), required, indexed.
* `originalFileName`: String, required, trimmed.
* `s3Key`: String (optional, reserved for S3 phase).
* `fileType`: String (e.g., `pdf`, `docx`, `pptx`).
* `mimeType`: String (e.g., `application/pdf`).
* `fileSize`: Number (in bytes).
* `subject`: String, required, trimmed.
* `semester`: String, required, trimmed.
* `category`: String, required, enum: `['Notes', 'Assignment', 'Question Paper', 'Practical', 'PPT', 'Reference', 'Other']`.
* `tags`: Array of strings, trimmed and deduplicated.
* `isFavorite`: Boolean, default `false`.
* `uploadedAt`: Date, default `Date.now`.
* `timestamps`: `createdAt`, `updatedAt`.

**Compound Indexes**:
* `{ userId: 1, subject: 1 }`
* `{ userId: 1, semester: 1 }`
* `{ userId: 1, category: 1 }`
* `{ userId: 1, uploadedAt: -1 }`

---

## 8. API Contract & Endpoints

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

### Authentication Endpoints

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
* **Access**: Private (Requires `Authorization: Bearer <token>`)
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

---

### Document Endpoints (Protected by JWT)

#### 5. Create Document Metadata

* **Method**: `POST /api/documents`
* **Access**: Private (`Authorization: Bearer <token>`)
* **Request Body**:
  ```json
  {
    "originalFileName": "DBMS_Unit_3_Notes.pdf",
    "subject": "DBMS",
    "semester": "3",
    "category": "Notes",
    "tags": ["mongodb", "sql", "normalization"],
    "fileType": "pdf",
    "mimeType": "application/pdf",
    "fileSize": 524288
  }
  ```
* **Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Document created successfully",
    "data": {
      "document": {
        "id": "67a4d1a0b1234c0012ef7890",
        "userId": "67a3f892b1234c0012ef4567",
        "originalFileName": "DBMS_Unit_3_Notes.pdf",
        "subject": "DBMS",
        "semester": "3",
        "category": "Notes",
        "tags": ["mongodb", "sql", "normalization"],
        "isFavorite": false,
        "uploadedAt": "2026-10-08T15:00:00.000Z",
        "createdAt": "2026-10-08T15:00:00.000Z",
        "updatedAt": "2026-10-08T15:00:00.000Z"
      }
    }
  }
  ```

#### 6. List Documents with Search, Filters & Pagination

* **Method**: `GET /api/documents`
* **Access**: Private (`Authorization: Bearer <token>`)
* **Query Parameters**:
  * `search`: Case-insensitive search across file name, subject, or tags (`?search=sql`)
  * `subject`: Filter by subject (`?subject=DBMS`)
  * `semester`: Filter by semester (`?semester=3`)
  * `category`: Filter by category (`?category=Notes`)
  * `page`: Page number (default: `1`)
  * `limit`: Items per page (default: `10`, max: `50`)
  * *Combined Example*: `GET /api/documents?search=normalization&subject=DBMS&semester=3&category=Notes&page=1&limit=10`
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Documents retrieved successfully",
    "data": {
      "documents": [ ... ],
      "pagination": {
        "page": 1,
        "limit": 10,
        "total": 25,
        "totalPages": 3
      }
    }
  }
  ```

#### 7. Get Single Document

* **Method**: `GET /api/documents/:id`
* **Access**: Private (`Authorization: Bearer <token>`)
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Document retrieved successfully",
    "data": {
      "document": { ... }
    }
  }
  ```
* **Response (404 Not Found)**:
  ```json
  {
    "success": false,
    "message": "Document not found"
  }
  ```

#### 8. Update Document Metadata

* **Method**: `PUT /api/documents/:id`
* **Access**: Private (`Authorization: Bearer <token>`)
* **Allowed Update Fields**: `originalFileName`, `subject`, `semester`, `category`, `tags`
* **Request Body**:
  ```json
  {
    "originalFileName": "DBMS_Unit_3_Final.pdf",
    "category": "Reference",
    "tags": ["sql", "normalization", "transactions"]
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Document updated successfully",
    "data": {
      "document": { ... }
    }
  }
  ```

#### 9. Delete Document Metadata

* **Method**: `DELETE /api/documents/:id`
* **Access**: Private (`Authorization: Bearer <token>`)
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Document deleted successfully",
    "data": {}
  }
  ```

---

## 9. Security & Ownership Enforcement

* **Strict User Isolation**: Every document query strictly incorporates `userId: req.userId`. Users can never access, list, modify, or delete another user's documents.
* **Information Leakage Prevention**: Attempting to query, update, or delete another user's document returns a generic `404 Document not found` rather than revealing document existence.
* **Spoofing Prevention**: `userId` is pulled directly from the verified JWT token (`req.userId`); any `userId` sent in the request body is discarded.
* **Protected Immutability**: Critical fields (`userId`, `s3Key`, `uploadedAt`, `createdAt`) are protected from updates via `PUT /api/documents/:id`.
* **Password Security**: Passwords hashed with `bcryptjs` (10 salt rounds); raw passwords never stored or logged.
* **Rate Limiting**: Integrated `express-rate-limit` prevents brute-force traffic (bypassed in test environment).
* **HTTP Security**: Enforced using `helmet` headers and strict CORS origin matching against `CLIENT_URL`.
