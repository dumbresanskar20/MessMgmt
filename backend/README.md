# Mess Management System - Backend API

Production-ready Express REST API & Socket.IO server powering the Mess Management System, built with MySQL and Prisma ORM.

## Features
- **Database**: MySQL database abstraction via Prisma ORM with atomic transaction-based daily token generation (`B-001`, `L-001`).
- **Authentication**: JWT access & refresh tokens, bcrypt password hashing, Zod schema validation.
- **Student Auth**: Email OTP verification (Nodemailer with dev mock fallback), account lockout after 5 failed login attempts.
- **Admin Auth & RBAC**: Super Admin & Staff roles. Forced password-set links for staff setup. Audit tracking (`created_by_id`, `last_login_at`).
- **Payments**: Razorpay Order Creation & Webhook signature verification.
- **Token System**: Daily sequential order tokens reset per meal type per day.
- **Real-Time**: Socket.IO server with JWT-authenticated stream for Kitchen Screen live order updates.
- **Security**: `express-rate-limit`, CORS origin white-listing.

---

## Setup & Running Locally

### 1. Prerequisites
- Node.js (v18+)
- MySQL database instance (e.g. Aiven MySQL for development or any standard MySQL host)

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Update key variables in `.env`:
- `DATABASE_URL`: Your MySQL connection string (e.g. `mysql://avnadmin:<password>@<host>.aivencloud.com:<port>/defaultdb?ssl-mode=REQUIRED`)
- `RAZORPAY_KEY_ID` & `RAZORPAY_KEY_SECRET`: Your Razorpay Sandbox keys
- `JWT_SECRET`: Secret string for token signing
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`: Your Cloudinary credentials

### 3. Installation & Prisma Client Generation
```bash
npm install
npx prisma generate
```

### 4. Database Migration & Seeding
Apply migrations to your MySQL database and seed initial data:
```bash
npx prisma migrate dev --name init
npm run seed
```

Default credentials created by seed:
- **Super Admin**: `admin@mess.com` / `Admin@123`
- **Test Student**: `student@test.com` / `Student@123`

### 5. Running Server
```bash
# Production mode
npm start

# Development mode with auto-reload
npm run dev
```

The API will run at `http://localhost:5000`. Health check endpoint: `http://localhost:5000/api/health`.

---

## Switching MySQL Hosts (Portability Guide)

This backend database layer is built using standard ANSI SQL / Prisma ORM and is completely host-agnostic. The application code contains zero host-specific logic, certificates, or proprietary connection code.

### Moving from Aiven to domainz.in (or any cPanel MySQL host):

1. **Update `DATABASE_URL`**: Change the connection string in your deployment environment (e.g., Render, Railway, or VPS `.env` file):
   ```env
   # From Aiven (development):
   # DATABASE_URL="mysql://avnadmin:pass@host.aivencloud.com:25049/defaultdb?ssl-mode=REQUIRED"

   # To domainz.in / cPanel MySQL (production):
   DATABASE_URL="mysql://username:password@domainz.in:3306/database_name"
   ```
2. **Apply Migrations**: Run the Prisma migration deploy command against the new MySQL database:
   ```bash
   npx prisma migrate deploy
   ```
3. **Re-seed (Optional)**: If setting up a fresh production database:
   ```bash
   npm run seed
   ```

No backend code changes or redeployments are required when switching database providers — only updating the `DATABASE_URL` environment variable.
