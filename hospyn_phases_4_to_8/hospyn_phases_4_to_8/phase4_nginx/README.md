# Phase 4 — Nginx Security Headers Fix

## What This Fixes
The audit identified that nginx.conf was missing critical security headers (audit finding H-4):
- No Content-Security-Policy (XSS attacks could exfiltrate patient data)
- No Strict-Transport-Security (HTTPS not enforced by browser)
- No X-Frame-Options (clickjacking risk)
- No X-Content-Type-Options (MIME sniffing risk)
- No Referrer-Policy
- No Permissions-Policy

## How to Apply

**Option A — Replace entire file (recommended):**
```bash
cp phase4_nginx/nginx.conf nginx.conf
git add nginx.conf
git commit -m "fix(nginx): add security headers — CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy"
```

**Option B — Manually add just the headers:**
Open your existing `nginx.conf` and add these lines inside every `server {}` block:

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://api.hospyn.com; object-src 'none'; frame-ancestors 'none';" always;
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;
```

## Manual Steps Required
None — this is a pure file replacement.

## Verify It Works
After applying and restarting nginx:
```bash
docker-compose restart nginx
curl -I http://localhost:8000/health
# Look for these headers in the response:
# content-security-policy: ...
# strict-transport-security: ...
# x-frame-options: DENY
# x-content-type-options: nosniff
```

## Notes
- The CSP `'unsafe-inline'` for scripts/styles is acceptable for now but should be tightened once you add nonce-based CSP in a future sprint.
- The notification-service upstream block is included here (Phase 3 service).
- `server_tokens off` hides your nginx version from attackers.
