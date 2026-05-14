# Firebase Password Reset Test Scripts

## `send-reset-email-test.js`
**What it does:** Calls the same Firebase REST API the app uses to send a password reset email.

**Run:**
```bash
node scripts/send-reset-email-test.js
# or: npm run test:reset-email
```

**Why use it:**
- Eliminates the app / React Native / Metro layer entirely
- Proves whether Firebase actually accepts the request
- Shows the EXACT HTTP response from Firebase
- Tells you whether the problem is Firebase config, missing user, or Gmail delivery

**Expected results:**
- `HTTP 200` → Firebase accepted. Email queued for delivery (or silently dropped if user doesn't exist)
- `HTTP 400/403` → Wrong API key, unauthorized domain, or missing user
- Network error → No internet or Firebase is down

---

## `generate-reset-link-admin.js`
**What it does:** Uses Firebase Admin SDK to generate a direct password reset link.

**Run:**
```bash
npm install -D firebase-admin
# then download service account (see below)
node scripts/generate-reset-link-admin.js
# or: npm run test:reset-link
```

**Why use it:**
- When the client says "success" but Gmail never receives the email
- Generates a real, clickable reset link you can send manually
- Bypasses Firebase's shared email IP pool entirely

**Setup:**
1. Go to Firebase Console → Project Settings → Service accounts
2. Click "Generate new private key"
3. Save the JSON as `scripts/serviceAccount.json`
4. **NEVER commit this file** — add `scripts/serviceAccount.json` to `.gitignore`

---

## `send-reset-via-resend.js` ⭐ RECOMMENDED
**What it does:** Replaces Firebase's default email delivery with Resend's dedicated infrastructure.

**Run:**
```bash
npm install -D resend firebase-admin
# then set up Resend (see below)
npm run send:reset-resend
# or: node scripts/send-reset-via-resend.js user@example.com
```

**Why use it:**
- **Guaranteed inbox delivery** — Resend uses dedicated IPs, not shared pools
- **Branded HTML emails** — Beautiful dark-theme template with your logo
- **Real delivery tracking** — Resend dashboard shows open/click/delivery status
- **Fast delivery** — Typically arrives within 1–10 seconds
- **No spam folder** — Proper domain verification + DKIM/SPF

**Setup:**
1. Sign up at https://resend.com
2. Create an API key → add to `.env`: `RESEND_API_KEY=re_your_key`
3. Verify a domain (e.g., `yourdomain.com`) or use `onboarding@resend.dev` for testing
4. Add to `.env`: `EMAIL_FROM=noreply@yourdomain.com`
5. Download `serviceAccount.json` from Firebase Console → Service accounts
6. Save to `scripts/serviceAccount.json`

**What happens:**
1. Firebase Admin SDK generates a real reset link
2. Resend sends a branded HTML email with CTA button + fallback link
3. Full delivery logging: Resend email ID, duration, acceptance status

---

## Troubleshooting Flow

### Quick Check (Firebase default delivery)
1. Run `npm run test:reset-email`
2. If HTTP 200 → Check Gmail Inbox/Spam/Promotions. Wait 1-60s.
3. If no email after 2 minutes → Run `npm run test:reset-link`
4. If link generates successfully → Copy it, send it via WhatsApp/Email to yourself
5. If Admin SDK fails with `auth/user-not-found` → The user does NOT exist in Firebase Auth. Create it.

### Production Solution (Resend delivery) ⭐
1. Set up Resend account + API key + domain verification
2. Run `npm run send:reset-resend`
3. Email arrives in inbox within seconds with branded template
4. Track delivery in Resend dashboard: https://resend.com/emails

### Full Production Setup (Cloud Function)
For automatic delivery without manual script execution, deploy the Cloud Function in `functions/sendPasswordReset.js`:
```bash
cd functions
npm install
firebase deploy --only functions
```
This intercepts Firebase Auth password reset events and sends via Resend automatically.
