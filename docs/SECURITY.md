# StudyVault — Application Security, Threat Model & Incident Response

## 1. Security Architecture Overview

StudyVault implements a defense-in-depth security model across the application, network, and cloud storage layers. Designed as an academic notes management platform, the system prioritizes student data confidentiality, multi-tenant isolation, and protection against unauthorized file access.

---

## 2. Threat Model & Mitigations

| Threat | Risk Level | Mitigation in StudyVault |
| :--- | :--- | :--- |
| **Insecure Direct Object Reference (IDOR)** | **High** | Every query and update (`GET`, `PUT`, `PATCH`, `DELETE`) enforces dual-condition MongoDB lookup: `{ _id: id, userId: req.userId }`. Users cannot read, download, modify, or delete another user's documents. |
| **S3 Data Leakage / Public Exposure** | **High** | S3 bucket has Block Public Access ON (all 4 settings). No direct public URLs are generated. File downloads use temporary presigned URLs with 300-second expiration. |
| **Credential Theft via Plaintext Transit** | **High** | Nginx enforces HTTP-to-HTTPS 301 redirection. All communication uses TLS 1.2/1.3 with Let's Encrypt certificates. |
| **Brute-Force & Credential Stuffing** | **Medium** | Dedicated rate limiter on `/api/auth/register` and `/api/auth/login` (15 requests per 15 minutes per IP). Generic 401 response for non-existent users and incorrect passwords prevents account enumeration. |
| **NoSQL Injection** | **Medium** | Inputs are sanitized and coerced to explicit string types; regex special characters in search parameters are escaped with `escapeRegex()` before querying to prevent ReDoS. |
| **Path Traversal in Uploads** | **Medium** | Filenames are sanitized using `path.basename()`. S3 storage keys are generated using cryptographically random UUIDs (`users/{userId}/{uuid}.ext`). Null bytes (`\0`) and invalid characters are rejected. |
| **Malicious File Execution** | **Medium** | Permitted file extensions and MIME types are whitelisted (`application/pdf`, images, text). Files are stored on S3, never executed on the host, and served with `Content-Type` matching the uploaded file. |
| **Secret Leakage in Version Control** | **Critical** | `.gitignore` and `.dockerignore` strictly exclude `.env`, `.env.*`, `*.pem`, `*.key`. S3 access on EC2 uses IAM instance profile (`StudyVaultEC2Role`) instead of static AWS keys. |

---

## 3. Chrome Deceptive Site Warning — Forensic Incident Analysis

### 3.1 Incident Description & Live Verification
During browser authentication on `https://studyvault-priti.duckdns.org`, Google Chrome displayed:
> *"You just entered your password on a deceptive site. To secure your accounts, Chrome recommends checking your saved passwords."*
accompanied by a red "Dangerous" badge in the browser address bar.

Live verification on the **Google Safe Browsing Transparency Report** confirmed the official status:
- **Verdict:** *"Some pages on this site are unsafe"*
- **Classification Details:** *"The site studyvault-priti.duckdns.org contains harmful content, including pages that try to trick visitors into sharing personal info or downloading software."*

### 3.2 Forensic Audit Findings
A comprehensive static code analysis and server audit yielded the following conclusions:
1. **Zero Malicious Code**: No obfuscated JavaScript, unauthorized redirects, third-party trackers, credential-harvesting scripts, or hidden form inputs exist in the codebase.
2. **Proper Cryptographic Transmission**: Login and registration requests are transmitted exclusively via HTTPS to the same-origin `/api/auth/*` endpoint. Passwords are never logged, printed, or sent to third-party endpoints.
3. **Password Storage**: Passwords are hashed with `bcryptjs` using 10 salt rounds before storage in MongoDB Atlas.

### 3.3 Root Cause Analysis
The warning originates from **external browser reputation heuristics**, not internal application compromise:
1. **Dynamic DNS Domain Reputation (DuckDNS)**:
   - Free dynamic DNS services (such as `*.duckdns.org`) are frequently exploited by malicious actors for ephemeral phishing campaigns.
   - Google Safe Browsing employs automated web crawlers and heuristic classifiers. When a brand-new, unrated subdomain on DuckDNS hosts an authentication form (`<input type="password">`, "Email", "Password", "Sign In"), automated systems flag it as suspicious social engineering / potential credential harvesting.
2. **Chrome Password Protection (Password Reuse Detection)**:
   - When a student enters a password that is already saved in Chrome Password Manager for another site (e.g., Google account, personal email, college portal) on an unfamiliar domain lacking established domain reputation, Chrome flags the transaction as potentially deceptive password reuse.

### 3.4 Verification & Remediation Procedure for Domain Owner

To resolve the domain flag through official Google channels:

1. **Verify Status on Google Safe Browsing Transparency Report**:
   - Visit: [https://transparencyreport.google.com/safe-browsing/search](https://transparencyreport.google.com/safe-browsing/search)
   - Search: `studyvault-priti.duckdns.org`
   - Review current categorization (Unsafe, Social Engineering, or Malware).

2. **Claim Property in Google Search Console**:
   - Navigate to [https://search.google.com/search-console/](https://search.google.com/search-console/).
   - Add property: `https://studyvault-priti.duckdns.org`.
   - Verify ownership via HTML file upload (place in `/usr/share/nginx/html/` on frontend container) or DNS verification.

3. **Check Security Issues Tab**:
   - In Search Console, click **Security & Manual Actions** &rarr; **Security Issues**.
   - Review sample URLs flagged by Google's automated scanner.

4. **Request an Official Google Review**:
   - Click **Request Review** in Search Console.
   - Detail in the review explanation:
     > *"StudyVault is an academic document management student project for cloud computing coursework. The site uses HTTPS with Let's Encrypt and standard bcrypt authentication for registered students. There is no brand impersonation or credential phishing. Please review and remove the false-positive classification."*
   - Alternatively, report false positive directly at: [https://safebrowsing.google.com/safebrowsing/report_error/](https://safebrowsing.google.com/safebrowsing/report_error/).

5. **Production Hardening Recommendation**:
   - For long-term production deployments, transition from free dynamic DNS subdomains (`duckdns.org`) to a verified custom domain name (e.g. `studyvault.edu` or a custom `.com`/`.dev` domain) with established WHOIS records and domain age.

---

## 4. Cloud Infrastructure Security

### 4.1 AWS IAM Least Privilege (Live Verified)
- The EC2 instance (`i-05151c96b878e27d4`) assumes `StudyVaultEC2Role` through an EC2 Instance Profile:
  - **Instance Profile ARN:** `arn:aws:iam::366366122474:instance-profile/StudyVaultEC2Role`
  - **Assumed Role ARN:** `arn:aws:sts::366366122474:assumed-role/StudyVaultEC2Role/i-05151c96b878e27d4`
- The attached policy grants strictly the minimal object-level permissions required for document operations:
  - `s3:PutObject`
  - `s3:GetObject`
  - `s3:DeleteObject`
  - `s3:ListBucket` (scoped to `studyvault-priti-documents-2026/users/`)
- Administrative S3 permissions (`GetBucketLocation`, `GetBucketPublicAccessBlock`, `GetEncryptionConfiguration`, `PutBucketPolicy`) are intentionally denied.

### 4.2 Security Group & Network Firewall Configuration
- **Inbound Rules:**
  - Port 22 (SSH): Restricted to authorized administrator IP.
  - Port 80 (HTTP): Open (`0.0.0.0/0`) for Let's Encrypt renewal challenges and HTTP-to-HTTPS redirect.
  - Port 443 (HTTPS): Open (`0.0.0.0/0`) to public web traffic for secure TLS access.
  - Port 5000: Bound strictly to `127.0.0.1:5000:5000` on the EC2 host via `docker-compose.yml`. Even if a cloud security group inadvertently allows port 5000, external traffic cannot connect to the backend because it listens only on localhost loopback. All external API requests must enter via the Nginx reverse proxy over HTTPS.
- **Outbound Rules:** All traffic allowed for S3 API calls, MongoDB Atlas connections, and system updates.

---

## 5. Credential Rotation & Incident Protocol

In the event of suspected credential exposure or security alerts:
1. **JWT Secret Rotation**: Update `JWT_SECRET` in `backend/.env` and restart backend container. This immediately invalidates all active student tokens.
2. **MongoDB Atlas User Rotation**: Create a new database user with fresh password in MongoDB Atlas Console, update `MONGODB_URI` in `backend/.env`, restart container, and delete the deprecated database user.
3. **AWS IAM Policy Review**: Re-verify IAM role permissions in AWS IAM Console to ensure no unneeded actions or broad resource wildcards exist.
