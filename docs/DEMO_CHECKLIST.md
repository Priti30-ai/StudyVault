# StudyVault — College Demo Checklist & Presentation Guide

## 1. 5–7 Minute College Demonstration Plan

| Time | Phase | Action / Demonstration | Key Points to Explain |
| :---: | :--- | :--- | :--- |
| **0:00 - 1:00** | **Project Overview & Cloud Architecture** | Open browser to `https://studyvault-priti.duckdns.org`. Show the landing page and overview stats. | Explain the problem statement: students need secure, centralized access to academic notes. Mention full cloud deployment on AWS EC2, S3, MongoDB Atlas, and Docker. |
| **1:00 - 2:00** | **Secure Student Registration & Auth** | Click "Sign In", switch to "Create Account", register a test student (`demo.student@college.edu`). | Point out: bcrypt password hashing (10 salt rounds), JWT authentication, strict rate limiting against brute force, and automated session restoration via `/api/auth/me`. |
| **2:00 - 3:30** | **Document Upload & AWS S3 Storage** | Click "Upload Document", drag a lecture PDF, select Subject ("Cloud Computing") and Category ("Notes"). Submit upload. | **Crucial Cloud Point**: Explain that the binary file is NOT stored in MongoDB; it is streamed directly to private AWS S3 bucket (`studyvault-priti-documents-2026`) via AWS IAM Role temporary credentials. MongoDB stores only metadata and S3 key. |
| **3:30 - 4:30** | **S3 Download via Presigned URL** | Click the "Download" button on the document card. Show browser download starting. | **Security Highlight**: Explain that the S3 bucket is completely private (Block Public Access ON). The backend generates a temporary presigned URL valid for only 5 minutes (300 seconds), preventing hotlinking or unauthorized sharing. |
| **4:30 - 5:30** | **Search, Filtering, Edit & Audit Trail** | Search by subject, filter by category, edit document title, and star as favorite. Navigate to "Activity Log". | Show real-time analytical dashboard metrics and chronological audit trail logging every action (`UPLOAD`, `DOWNLOAD`, `UPDATE`, `FAVORITE`). |
| **5:30 - 6:30** | **Safe Deletion & S3 Cleanup** | Delete the document and confirm prompt. Check Activity log for `DELETE` event. | Explain transactional cleanup: deleting the document removes the binary object from AWS S3 first, then deletes metadata from MongoDB to prevent orphaned storage costs. |
| **6:30 - 7:00** | **Q&A & Cloud Architecture Recap** | Show the Mermaid architecture diagram and EC2 container status. | Highlight: Nginx TLS reverse proxy, IAM Least Privilege, multi-tenant IDOR isolation, and 99/99 automated test coverage. |

---

## 2. Recommended Presentation Screenshots

1. **Dashboard Overview**: Summary cards showing total documents, storage used (e.g. 4.2 MB), favorite count, category breakdown, and recent activity.
2. **Document Vault Grid View**: Academic document cards with subject badges, semester tags, download buttons, and star icons.
3. **Upload Modal**: Drag-and-drop interface with 10 MB limit check and category dropdown.
4. **Activity & Audit Log**: Chronological list of user events with timestamp badges and action pills.
5. **AWS Console S3 Bucket**: View of `studyvault-priti-documents-2026` showing partitioned key paths (`users/{userId}/{uuid}.pdf`) and private bucket settings.
6. **AWS EC2 Running Containers**: Terminal screenshot of `docker-compose ps` showing `studyvault-frontend` (Nginx) and `studyvault-backend` (Node.js) healthy.
7. **Automated Test Results**: Terminal screenshot showing 99/99 passing backend tests across 34 suites.

---

## 3. Key AWS Services & Security Decisions to Explain to Evaluators

1. **Why Amazon S3 over Database Storage?**
   - Databases are optimized for structured queries, not binary file blobs. Storing files in S3 reduces database RAM/disk costs, scales to petabytes automatically, and enables direct HTTPS streaming.
2. **Why Temporary Presigned URLs?**
   - Keeping the S3 bucket completely private prevents data scraping. Presigned URLs grant time-limited (300s) download access without exposing AWS credentials to the student or making the bucket public.
3. **Why AWS IAM Roles instead of Hardcoded AWS Keys?**
   - Hardcoded `AWS_ACCESS_KEY_ID` and `SECRET_ACCESS_KEY` pose severe leak risks if committed. By assigning `StudyVaultEC2Role` to the EC2 instance profile, the AWS SDK requests short-lived rotating credentials automatically via IMDSv2.
4. **Why Nginx as Reverse Proxy?**
   - Nginx handles TLS termination (Let's Encrypt certificates), serves static assets with Gzip compression, redirects HTTP to HTTPS, enforces upload limits (`client_max_body_size 15M`), and shields the Node.js API from direct public exposure.

---

## 4. Honest Project Limitations & Future Improvements

- **Current Limitations**:
  - The domain currently relies on a free dynamic DNS provider (`duckdns.org`), which triggered an external Google Safe Browsing reputation warning (resolved via False Positive Review or custom domain acquisition).
  - Hosted on a single EC2 instance (`t3.micro`); horizontal scaling would require an Application Load Balancer (ALB) and Auto Scaling Group (ASG).
- **Future Improvements**:
  - Transitioning from dynamic DNS to an institutional domain (e.g., `studyvault.dpu.edu.in`).
  - Integrating AWS CloudFront CDN for global caching of static assets and documents.
  - Adding PDF text extraction and search indexing using Amazon Textract.
  - Role-based access control (RBAC) separating Professors (who publish verified syllabi) from Students.
