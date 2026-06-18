# Hospyn V2 Web — Firebase Hosting Deploy Guide

## Prerequisites
```bash
npm install -g firebase-tools   # if not already installed
firebase login
```

---

## 1. Check / Update firebase.json

Your `firebase.json` should have a `hosting` entry (or array) for `hospyn-v2-web`.

**Example firebase.json (multi-app setup):**
```json
{
  "hosting": [
    {
      "target": "hospyn-v2-web",
      "public": "hospyn-v2-web/dist",
      "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
      "rewrites": [
        {
          "source": "**",
          "destination": "/index.html"
        }
      ],
      "headers": [
        {
          "source": "**/*.@(js|css)",
          "headers": [
            { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
          ]
        },
        {
          "source": "**",
          "headers": [
            { "key": "X-Frame-Options", "value": "DENY" },
            { "key": "X-Content-Type-Options", "value": "nosniff" },
            { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
          ]
        }
      ]
    }
  ]
}
```

> The `"rewrites": [{ "source": "**", "destination": "/index.html" }]` is required for
> React Router (client-side routing) — without it, direct links to /privacy-policy etc.
> will 404 on Firebase.

---

## 2. Check .firebaserc

Your `.firebaserc` must map the `hospyn-v2-web` target to a Firebase project:

```json
{
  "projects": {
    "default": "<your-firebase-project-id>"
  },
  "targets": {
    "<your-firebase-project-id>": {
      "hosting": {
        "hospyn-v2-web": ["<your-firebase-hosting-site-name>"]
      }
    }
  }
}
```

If not set up yet, run:
```bash
# From ahp-end-game-new/
firebase target:apply hosting hospyn-v2-web <your-hosting-site-name>
```

---

## 3. Build the App

```bash
# From the hospyn-v2-web directory
cd ahp-end-game-new/hospyn-v2-web
npm run build
# Output goes to: ahp-end-game-new/hospyn-v2-web/dist/
```

---

## 4. Deploy

```bash
# From ahp-end-game-new/ (where firebase.json lives)
cd ahp-end-game-new

# Deploy only the hospyn-v2-web hosting target
firebase deploy --only hosting:hospyn-v2-web
```

**Expected output:**
```
=== Deploying to '<your-firebase-project-id>'...
i  deploying hosting
i  hosting[hospyn-v2-web]: beginning deploy...
i  hosting[hospyn-v2-web]: found 42 files in hospyn-v2-web/dist
✔  hosting[hospyn-v2-web]: file upload complete
✔  Deploy complete!

Hosting URL: https://<your-site>.web.app
```

---

## 5. Verify Legal Routes After Deploy

After deploy, confirm these URLs return your pages (not 404):
```
https://<your-site>.web.app/privacy-policy
https://<your-site>.web.app/terms-of-service
```

If you get 404s, the `rewrites` rule in firebase.json is missing — add it as shown in Step 1.

---

## 6. Custom Domain (optional)

```bash
firebase hosting:channel:deploy preview --only hosting:hospyn-v2-web
# For production custom domain, configure in Firebase Console → Hosting → Add custom domain
```
