# Firebase Password Reset Test Scripts

## `send-reset-email-test.js`
**What it does:** Calls the same Firebase REST API the app uses to send a password reset email.

**Run:**
```bash
node scripts/send-reset-email-test.js
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

## Troubleshooting Flow

1. Run `send-reset-email-test.js`
2. If HTTP 200 → Check Gmail Inbox/Spam/Promotions. Wait 1-60s.
3. If no email after 2 minutes → Run `generate-reset-link-admin.js`
4. If link generates successfully → Copy it, send it via WhatsApp/Email to yourself
5. If Admin SDK fails with `auth/user-not-found` → The user does NOT exist in Firebase Auth. Create it.
