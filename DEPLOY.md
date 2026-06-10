# 🚀 Raj Suppliers ID Portal — Deployment Guide

## ⏱ You can be live in under 30 minutes

---

## OPTION A — Railway.app (Recommended — Fastest)

### Step 1 — Push code to GitHub

```bash
# On your computer, open terminal in the project folder
git init
git add .
git commit -m "Initial deploy"

# Create a new repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/rajsuppliers-portal.git
git branch -M main
git push -u origin main
```

### Step 2 — Deploy on Railway

1. Go to **https://railway.app** → Sign up / Log in
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select your `rajsuppliers-portal` repository
4. Railway auto-detects Node.js and deploys ✅

### Step 3 — Add PostgreSQL Database

1. In your Railway project dashboard, click **"New"** → **"Database"** → **"PostgreSQL"**
2. Railway automatically sets `DATABASE_URL` in your environment ✅

### Step 4 — Set Environment Variables

In Railway dashboard → your web service → **"Variables"** tab, add:

| Variable | Value |
|---|---|
| `JWT_SECRET` | (copy from below — generate one) |
| `JWT_EXPIRES_IN` | `7d` |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | `https://your-app.railway.app` |

**Generate JWT_SECRET** — run this in any terminal:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Copy the output and paste as `JWT_SECRET`.

### Step 5 — Run Database Setup

In Railway dashboard → your web service → **"Settings"** tab → **"Deploy"** section:

Temporarily change **Start Command** to:
```
npm run db:setup
```
Click **"Deploy"** — wait for it to finish (you'll see ✅ in logs).

Then change Start Command back to:
```
npm start
```
And deploy again.

### Step 6 — Connect your domain

1. Railway dashboard → your service → **"Settings"** → **"Networking"**
2. Click **"Custom Domain"** → enter your domain e.g. `portal.rajsuppliers.com`
3. Railway shows you a **CNAME record** to add
4. Go to your domain registrar (GoDaddy / Namecheap / Cloudflare):
   - Add a **CNAME** record:
     - **Name/Host**: `portal` (or `@` for root domain)
     - **Value**: the Railway CNAME shown
5. Wait 5–30 minutes for DNS to propagate
6. Update `FRONTEND_URL` variable to `https://portal.rajsuppliers.com`

### Step 7 — Done! 🎉

Visit your domain. Login with:
- **Super Admin**: admin@rajsuppliers.com / admin123
- **Biz Admin**: john@rajsuppliers.com / biz123
- **School Admin**: sarah@rajsuppliers.com / school123
- **Staff**: mike@rajsuppliers.com / staff123

> ⚠️ **Change all passwords immediately after first login!**

---

## OPTION B — Render.com

### Step 1 — Push to GitHub
Same as Railway Step 1 above.

### Step 2 — Deploy on Render

1. Go to **https://render.com** → Sign up / Log in
2. Click **"New"** → **"Blueprint"**
3. Connect your GitHub repo
4. Render reads `render.yaml` and automatically creates:
   - ✅ Web service (Node.js app)
   - ✅ PostgreSQL database
   - ✅ All environment variables linked

### Step 3 — Add JWT_SECRET

In Render dashboard → your web service → **"Environment"**:
- Add `JWT_SECRET` = (generate as shown above)

### Step 4 — Run Database Setup

In Render dashboard → your web service → **"Shell"** tab:
```bash
npm run db:setup
```

### Step 5 — Connect your domain

1. Render dashboard → your service → **"Custom Domains"**
2. Add your domain → Render gives you a CNAME
3. Add CNAME at your registrar (same as Railway Step 6)
4. Update `FRONTEND_URL` to your domain

---

## 🔑 Login Credentials (Demo Seed Data)

| Role | Email | Password | Access Level |
|---|---|---|---|
| Super Admin | admin@rajsuppliers.com | admin123 | Everything |
| Business Admin | john@rajsuppliers.com | biz123 | Own region + schools |
| School Admin | sarah@rajsuppliers.com | school123 | Own school only |
| Staff | mike@rajsuppliers.com | staff123 | Students + cards only |

---

## 🗄️ Database Tables Created

| Table | Purpose |
|---|---|
| `businesses` | Regional business partners |
| `schools` | Schools under each business |
| `users` | All system users with roles |
| `students` | Student records per school |
| `id_cards` | Issued ID cards |
| `orders` | Product orders with payment & print status |
| `pricing` | Tag pricing (global + per-business) |
| `pricing_addons` | Add-on pricing (holder, hook, fitting etc.) |
| `activity_logs` | Full audit trail |

---

## 🔧 API Endpoints Reference

### Auth
```
POST   /api/auth/login       → Login, returns JWT token
GET    /api/auth/me          → Get current user profile
PUT    /api/auth/profile     → Update name/phone
PUT    /api/auth/password    → Change password
```

### Businesses (Super Admin only)
```
GET    /api/businesses       → List all businesses
POST   /api/businesses       → Create business
PUT    /api/businesses/:id   → Update business
DELETE /api/businesses/:id   → Delete business
```

### Schools
```
GET    /api/schools          → List (scoped by role)
POST   /api/schools          → Create school
PUT    /api/schools/:id      → Update school
DELETE /api/schools/:id      → Delete school
```

### Students
```
GET    /api/students         → List (scoped by role)
POST   /api/students         → Add student
PUT    /api/students/:id     → Edit student
DELETE /api/students/:id     → Delete student
```

### ID Cards
```
GET    /api/cards            → List cards (scoped)
POST   /api/cards            → Issue new card
PUT    /api/cards/:id/revoke   → Revoke card
PUT    /api/cards/:id/activate → Re-activate card
DELETE /api/cards/:id        → Delete card
```

### Orders
```
GET    /api/orders           → List orders (scoped)
GET    /api/orders/stats     → Revenue & count stats
POST   /api/orders           → Create order
PUT    /api/orders/:id/pay   → Record payment (unlocks print)
PUT    /api/orders/:id/print → Mark as printed
DELETE /api/orders/:id       → Delete order
```

### Pricing
```
GET    /api/pricing          → Get all pricing
PUT    /api/pricing/tags/:id    → Update tag price
PUT    /api/pricing/addons/:id  → Update add-on price
POST   /api/pricing/save     → Bulk save pricing
```

### Users
```
GET    /api/users            → List users (scoped)
POST   /api/users            → Add user
PUT    /api/users/:id        → Edit user
DELETE /api/users/:id        → Delete user
```

---

## 🛡️ Security Notes

1. **JWT tokens** expire in 7 days — users auto-logged out after that
2. **Passwords** are hashed with bcrypt (12 rounds) — never stored plain
3. **Rate limiting** — 20 login attempts per 15 min, 300 API calls per min
4. **Role middleware** on every route — users can only access their own data
5. **CORS** locked to your `FRONTEND_URL` in production
6. **Helmet.js** sets security headers automatically

---

## 💰 Pricing (Railway Free Tier)

| Resource | Free Allowance |
|---|---|
| Web Service | $5 credit/month (enough for ~500 hours) |
| PostgreSQL | 1 GB storage free |
| Bandwidth | 100 GB/month |

For production with heavy use, upgrade to Railway Hobby ($5/month) or Render Starter ($7/month).

---

## 🆘 Troubleshooting

**"Cannot connect to database"**
→ Check `DATABASE_URL` is set. In Railway it's auto-set when you add PostgreSQL.

**"Invalid token" on all requests**
→ `JWT_SECRET` not set. Add it in environment variables.

**White screen / blank page**
→ Check browser console. Usually a network error to `/api/`. Verify `FRONTEND_URL` matches your actual domain.

**Database not seeded**
→ Run `npm run db:setup` in the Railway/Render shell, then restart the service.

**Port error**
→ Make sure `PORT` env variable is NOT hardcoded. The code uses `process.env.PORT` automatically.

---

## 📞 Support

Email: support@rajsuppliers.com
