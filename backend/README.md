# Mess Management System - Backend API

Production-ready Express REST API & Socket.IO server powering the Mess Management System.

## Features
- **Authentication**: JWT access & refresh tokens, bcrypt password hashing, Zod schema validation.
- **Student Auth**: Email OTP verification (Nodemailer with dev mock fallback), account lockout after 5 failed login attempts.
- **Admin Auth & RBAC**: Super Admin & Staff roles. Forced password-set links for staff setup. Audit tracking (`created_by`, `last_login_at`).
- **Payments**: Razorpay Order Creation & Webhook signature verification.
- **Token System**: Daily sequential order tokens (`B-001`, `L-001`) reset per meal type.
- **Real-Time**: Socket.IO server with JWT-authenticated stream for Kitchen Screen live order updates.
- **Security**: `express-rate-limit`, CORS origin white-listing.

---

## Setup & Running Locally

### 1. Prerequisites
- Node.js (v18+)
- MongoDB Atlas cluster URL (or local MongoDB instance)

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Update the following key variables in `.env`:
- `ATLAS_URI`: Your MongoDB Atlas connection string (e.g. `mongodb+srv://<user>:<password>@cluster0.mongodb.net/mess_management`)
- `RAZORPAY_KEY_ID` & `RAZORPAY_KEY_SECRET`: Your Razorpay Sandbox keys
- `JWT_SECRET`: Secret string for token signing
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`: Your Cloudinary credentials

### Cloudinary Media Storage Setup
1. Create a free account at [cloudinary.com](https://cloudinary.com).
2. Go to your **Cloudinary Dashboard** to find your **Cloud Name**, **API Key**, and **API Secret**.
3. Add these credentials to your `backend/.env` file:
   ```env
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```
4. Menu item images will automatically upload to the `mess-management/menu-items` folder on Cloudinary, and deleting/updating items will clean up old files automatically.

### 3. Installation
```bash
npm install
```

### 4. Database Seeding
Seed initial Super Admin, default meal windows, and sample menu items:
```bash
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
