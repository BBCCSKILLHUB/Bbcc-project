# 🏛️ BBCC SKILL HUB (v3.0 Next-Gen)

Central Academic Board & Digital Institute Network Platform.

---

## 🚀 Features

- **Master Academic Portal (`/`):**
  - Celestial Obsidian Gold & Aurora UI
  - Partner Coaching Institutes Network with direct 1-click visit
  - E-Library Vault (Strictly 3D Realistic Academic Textbook Covers — Zero raw PDF preview)
  - In-App `#docCheckoutDock` with direct Razorpay UPI / Cards / NetBanking payments
  - Direct file download after payment completion
  - Institute Affiliation Desk (Online application form)

- **Dedicated Institute Microsite (`/institute/:id` or `/center/:id`):**
  - Dynamic branding (Logo, Director photo, Address, Socials)
  - Prominent **`[🏠 BBCC Main Board Portal]`** return button on desktop and persistent mobile bottom dock
  - Certified teaching faculty showcase
  - Institute study notes direct downloads
  - Student admission inquiry desk

- **Institute Director Studio (`/director`):**
  - Faculty management
  - Study notes publishing
  - Admission inquiries inbox
  - Center profile & contacts
  - **Automated Suspension Lockout & Instant Online Unblock:** 100% automated unblocking via Razorpay without manual admin review!

- **Super Admin Command Console (`/admin`):**
  - **Razorpay Gateway Settings:** Enter Key ID & Key Secret, live connection test
  - Institute management (register, suspend with dues, unblock)
  - E-Library notes publisher (set prices in ₹)
  - Payment transactions & revenue ledger
  - Affiliation applications desk

- **Unified Portal Sign In (`/login`):**
  - Multi-role switcher for Directors and Super Admin

---

## 🛠️ Tech Stack & Deployment

- **Backend:** Node.js, Express.js
- **Database:** MongoDB Atlas (Mongoose ODM)
- **Payment Gateway:** Razorpay Standard Checkout SDK
- **Authentication:** JWT (JSON Web Tokens) & bcryptjs
- **Cloud Hosting:** 100% compatible with Render (`PORT = process.env.PORT || 5000`)

---

## 📦 Environment Variables

```env
PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/bbcc_portal
JWT_SECRET=your_secret_jwt_key
RAZORPAY_KEY_ID=rzp_live_your_key_id
RAZORPAY_KEY_SECRET=your_razorpay_secret
```

---

## 🏃 Run Locally

```bash
npm install
npm start
```

Visit: `http://localhost:5000`
Super Admin Default Login: `admin` / `admin123`
