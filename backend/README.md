# StudyVault Backend

Backend service for **StudyVault** — Cloud-Based Student Document & Notes Management System.

---

## 1. Architecture Overview

Built with Node.js and Express, implementing a hybrid cloud storage architecture:
* **MongoDB Atlas**: Stores user accounts and document metadata (file names, sizes, subjects, categories, tags, timestamps).
* **Amazon S3**: Stores the actual binary files in a private, encrypted bucket.

```text
                    StudyVault Client
                           │
                           ▼
                  Node.js / Express API
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
         MongoDB Atlas               AWS S3
      (Document Metadata)      (Private Object Store)
```

```text
backend/
├── src/
│   ├── config/          # Database (db.js) and AWS (aws.js) clients
│   ├── controllers/     # Auth & Document controllers
│   ├── middleware/      # Auth, upload, error, rate-limit & 404 middlewares
│   ├── models/          # Mongoose data schemas (User.js, Document.js)
│   ├── routes/          # API route definitions (auth, document, health)
│   ├── services/        # External cloud services (s3Service.js)
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
* **AWS Account**: An S3 bucket with an IAM user having least-privilege S3 permissions

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
| `AWS_REGION` | AWS region where the S3 bucket is hosted | `ap-south-1` |
| `AWS_ACCESS_KEY_ID` | IAM User access key ID | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | IAM User secret access key | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `AWS_S3_BUCKET` | Name of the private S3 bucket | `studyvault-bucket-name` |

> [!CAUTION]
> Never commit `.env` or expose real database credentials or AWS secrets to Git.

---

## 5. AWS S3 Setup & Bucket Security

### S3 Bucket Configuration
1. Open the [AWS Management Console](https://console.aws.amazon.com/s3/).
2. Create an S3 Bucket in your desired region (e.g., `ap-south-1`).
3. **Block Public Access**: Set to **ON** (Enable all 4 public access block settings).
4. **Bucket Encryption**: Enable SSE-S3 (Server-Side Encryption with Amazon S3 managed keys).
5. **Object Ownership**: Set to **Bucket owner enforced** (ACLs disabled).

### IAM Permissions Policy (Least Privilege)
Attach a policy restricting operations to the StudyVault bucket:
```json
{
  "Version": "2012-10-17",
  "Part": "StudyVaultS3Policy",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::studyvault-bucket-name/*"
    }
  ]
}
```

---

## 6. S3 Key Partitioning Structure

S3 objects are partitioned hierarchically by authenticated user ID with collision-resistant UUIDs:
```text
users/{userId}/{uuid}.{ext}
```
*Example*: `users/6ac7b3e8756f9a245201f936/58766975-8cac-49b3-9024-c34db51bbdda.pdf`

This guarantees:
1. No filename collisions between different users uploading files with the same name (e.g., `Notes.pdf`).
2. Clean logical isolation per student account.

---

## 7. Two-Phase Upload & Failure Rollback

1. **Upload Phase**: Multer receives the file into a memory buffer and streams it to AWS S3 using `PutObjectCommand`.
2. **Metadata Phase**: Upon S3 confirmation, document metadata is saved to MongoDB with `s3Key`.
3. **Rollback Handling**: If MongoDB creation fails after S3 upload succeeds, `s3Service.deleteFile(s3Key)` automatically executes to delete the uploaded S3 object, preventing orphaned storage files.

---

## 8. Running Locally

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

## 9. API Contract & Endpoints

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

### Endpoints Table

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Public | Service health status |
| `POST` | `/api/auth/register` | Public | Register student account |
| `POST` | `/api/auth/login` | Public | Log in & receive JWT |
| `GET` | `/api/auth/me` | Private | Retrieve authenticated student profile |
| `POST` | `/api/documents` | Private | Upload document file (multipart/form-data) |
| `GET` | `/api/documents` | Private | List documents with search, filters, favorites, and pagination |
| `GET` | `/api/documents/:id` | Private | Retrieve single document metadata |
| `GET` | `/api/documents/:id/download` | Private | Generate temporary presigned S3 download URL |
| `PUT` | `/api/documents/:id` | Private | Update allowed metadata fields |
| `PATCH` | `/api/documents/:id/favorite` | Private | Toggle document favorite status |
| `DELETE` | `/api/documents/:id` | Private | Delete document metadata and S3 object |
| `GET` | `/api/activity` | Private | Fetch user activity history with pagination and action filter |

---

### Document Endpoints Details

#### 1. Upload File & Metadata

* **Method**: `POST /api/documents`
* **Access**: Private (`Authorization: Bearer <token>`)
* **Content-Type**: `multipart/form-data`
* **Supported File Types**: `.pdf`, `.doc`, `.docx`, `.ppt`, `.pptx`, `.jpg`, `.jpeg`, `.png`
* **Maximum File Size**: 10 MB
* **Form Fields**:
  * `file`: Binary file (required)
  * `subject`: Subject name (required)
  * `semester`: Academic semester (required)
  * `category`: `Notes` \| `Assignment` \| `Question Paper` \| `Practical` \| `PPT` \| `Reference` \| `Other` (required)
  * `tags`: Comma-separated list or JSON array (optional)
* **Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Document uploaded successfully",
    "data": {
      "document": {
        "id": "6ac7b3e8756f9a245201f937",
        "userId": "6ac7b3e8756f9a245201f936",
        "originalFileName": "Cloud_Architecture_Notes.pdf",
        "s3Key": "users/6ac7b3e8756f9a245201f936/58766975-8cac-49b3-9024-c34db51bbdda.pdf",
        "fileType": "pdf",
        "mimeType": "application/pdf",
        "fileSize": 524288,
        "subject": "Cloud Computing",
        "semester": "6",
        "category": "Notes",
        "tags": ["aws", "s3", "cloud"],
        "isFavorite": false,
        "uploadedAt": "2026-10-08T15:16:56.285Z"
      }
    }
  }
  ```

#### 2. Generate Presigned Download URL

* **Method**: `GET /api/documents/:id/download`
* **Access**: Private (`Authorization: Bearer <token>`)
* **Behavior**: Generates a short-lived presigned URL (valid for 300 seconds) enabling the browser to directly stream the private file from S3 without exposing AWS credentials.
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Download URL generated successfully",
    "data": {
      "downloadUrl": "https://studyvault-bucket.s3.ap-south-1.amazonaws.com/users/...?...X-Amz-Signature=...",
      "expiresIn": 300
    }
  }
  ```
* **Response (404 Not Found)**: If document does not exist or belongs to another user.

#### 3. Toggle Favorite Status

* **Method**: `PATCH /api/documents/:id/favorite`
* **Access**: Private (`Authorization: Bearer <token>`)
* **Behavior**: Toggles the `isFavorite` flag on the specified document. Automatically records a `FAVORITE` or `UNFAVORITE` activity.
* **Response (200 OK - Favorited)**:
  ```json
  {
    "success": true,
    "message": "Document favorited successfully",
    "data": {
      "document": {
        "id": "6ac7b3e8756f9a245201f937",
        "isFavorite": true
      }
    }
  }
  ```
* **Response (200 OK - Unfavorited)**:
  ```json
  {
    "success": true,
    "message": "Document unfavorited successfully",
    "data": {
      "document": {
        "id": "6ac7b3e8756f9a245201f937",
        "isFavorite": false
      }
    }
  }
  ```

#### 4. Delete Document & Storage Object

* **Method**: `DELETE /api/documents/:id`
* **Access**: Private (`Authorization: Bearer <token>`)
* **Behavior**: Deletes the file from Amazon S3 and removes the metadata record from MongoDB. Automatically records a `DELETE` activity that persists in the audit trail.
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Document deleted successfully",
    "data": {}
  }
  ```

---

## 10. Activity Tracking API

### Activity Model Schema
Activities represent an append-only audit trail of student actions on documents:
* `userId`: ObjectId (ref: `User`, indexed, required)
* `documentId`: ObjectId (ref: `Document`, required)
* `action`: String enum (`UPLOAD`, `DOWNLOAD`, `DELETE`, `FAVORITE`, `UNFAVORITE`, `UPDATE`)
* `fileName`: String (stored at log time so record persists even if document is deleted)
* `createdAt`: Date (default: `Date.now`, indexed)

### Get User Activity History

* **Method**: `GET /api/activity`
* **Access**: Private (`Authorization: Bearer <token>`)
* **Query Parameters**:
  * `page`: Page number (default: `1`)
  * `limit`: Page size (default: `10`, max: `50`)
  * `action`: Filter by action type (`UPLOAD`, `DOWNLOAD`, `DELETE`, `FAVORITE`, `UNFAVORITE`, `UPDATE`)
* **Sorting**: Sorted newest first (`createdAt: -1`)
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Activity fetched successfully",
    "data": {
      "activities": [
        {
          "id": "6ac7b45e1b25622259e008ff",
          "userId": "6ac7b3e8756f9a245201f936",
          "documentId": "6ac7b3e8756f9a245201f937",
          "action": "FAVORITE",
          "fileName": "Cloud_Architecture_Notes.pdf",
          "createdAt": "2026-10-08T15:35:10.120Z"
        },
        {
          "id": "6ac7b45e1b25622259e008fe",
          "userId": "6ac7b3e8756f9a245201f936",
          "documentId": "6ac7b3e8756f9a245201f937",
          "action": "DOWNLOAD",
          "fileName": "Cloud_Architecture_Notes.pdf",
          "createdAt": "2026-10-08T15:34:02.450Z"
        },
        {
          "id": "6ac7b45e1b25622259e008fd",
          "userId": "6ac7b3e8756f9a245201f936",
          "documentId": "6ac7b3e8756f9a245201f937",
          "action": "UPLOAD",
          "fileName": "Cloud_Architecture_Notes.pdf",
          "createdAt": "2026-10-08T15:33:00.000Z"
        }
      ],
      "pagination": {
        "page": 1,
        "limit": 10,
        "total": 3,
        "pages": 1,
        "totalPages": 1
      }
    }
  }
  ```

---

## 11. Security & Ownership Summary

* **Private S3**: Bucket public access is permanently blocked. Files can never be downloaded without passing ownership checks.
* **Strict Multi-Tenant Isolation**: Queries strictly enforce `userId: req.userId`. User B can never view, favorite, download, or delete User A's documents or activities.
* **Non-Blocking Audit Logging**: Activity creation errors never cause primary document operations (uploads, downloads, deletes) to fail.
* **No Credential Exposure**: Client applications never interact directly with AWS or possess AWS secrets.
* **Rate Limiting & Security Headers**: Integrated Helmet protection and rate limiting shield all endpoints.
