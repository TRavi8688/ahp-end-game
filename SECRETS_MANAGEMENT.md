# 🔐 SECRETS MANAGEMENT GUIDE - PRODUCTION DEPLOYMENT

**⚠️ CRITICAL**: Never commit secrets to git. Always use environment-based secrets management.

---

## 1️⃣ GENERATE PRODUCTION SECRETS (Do This Locally, Never on Server)

### Step 1: Generate JWT Key Pair (RSA 2048-bit)

```bash
# Generate private key
openssl genrsa -out jwt_private.pem 2048

# Generate corresponding public key
openssl rsa -in jwt_private.pem -pubout -out jwt_public.pem

# Display for copying (keep these SECRET!)
cat jwt_private.pem    # Copy entire output including BEGIN/END lines
cat jwt_public.pem     # Copy entire output

# DELETE from disk after copying
rm jwt_private.pem jwt_public.pem ssl_error_rsa_key_parse
```

### Step 2: Generate Encryption Key (256-bit / 32 bytes)

```bash
# Generate random 32-byte key (base64 encoded)
openssl rand -base64 32
# Example output: "h8K2mP9vQ4xRsT5uW7yZaB3cD6eF1gJ2kL4nM6oP8q8="
```

### Step 3: Generate Secret Key (256-bit)

```bash
# Generate random hex string
openssl rand -hex 32
# Example output: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0"
```

### Step 4: Generate Database Password (256-bit)

```bash
# Generate random 20+ character password
openssl rand -base64 20
# Example output: "xY8aB2cD4eF6gH8jK0lM2nOp"
```

---

## 2️⃣ STORE SECRETS IN RAILWAY (Recommended for this project)

### Navigate to Railway Secrets

1. Go to: https://railway.app
2. Select your project
3. Click on **API service**
4. Go to **Variables** tab

### Add All Secrets

Create the following variables (mark as "Sensitive" if possible):

```
ENVIRONMENT = production
DEBUG = False
SECRET_KEY = [paste from Step 3 above]
JWT_PRIVATE_KEY = [paste from Step 1 - include BEGIN/END lines]
JWT_PUBLIC_KEY = [paste from Step 1 - include BEGIN/END lines]
ENCRYPTION_KEY = [paste from Step 2]
ALLOWED_ORIGINS = ["https://doctor.yourdomain.com","https://patient.yourdomain.com"]
DB_PASSWORD = [paste from Step 4]
DATABASE_URL = postgresql+asyncpg://ahpadmin:[DB_PASSWORD]@postgres-prod:5432/ahp_prod
REDIS_URL = redis://redis-prod:6379/0
SENTRY_DSN = [your Sentry project DSN]
```

### Verify Secrets

```bash
# After deployment, verify secrets are set (Railway hides values)
railway env ls

# Should show all variable names without exposing values
```

---

## 3️⃣ ALTERNATIVE: AWS SECRETS MANAGER

If using AWS instead of Railway:

```bash
# Store secrets in AWS Secrets Manager
aws secretsmanager create-secret \
  --name "ahp/prod/jwt-private-key" \
  --secret-string "[your-jwt-private-key-content]"

aws secretsmanager create-secret \
  --name "ahp/prod/encryption-key" \
  --secret-string "[your-encryption-key-content]"

# Retrieve in application
aws secretsmanager get-secret-value \
  --secret-id "ahp/prod/jwt-private-key" \
  --query SecretString
```

---

## 4️⃣ KUBERNETES SECRETS (If using K8s)

```bash
# Create secrets from command line
kubectl create secret generic ahp-secrets \
  --from-literal=JWT_PRIVATE_KEY="$(cat jwt_private.pem)" \
  --from-literal=JWT_PUBLIC_KEY="$(cat jwt_public.pem)" \
  --from-literal=ENCRYPTION_KEY="$(openssl rand -base64 32)" \
  --from-literal=DB_PASSWORD="$(openssl rand -base64 20)" \
  --namespace production

# Reference in deployment.yaml
env:
  - name: JWT_PRIVATE_KEY
    valueFrom:
      secretKeyRef:
        name: ahp-secrets
        key: JWT_PRIVATE_KEY
```

---

## 5️⃣ VERIFY SECRETS ARE CORRECTLY SET

After deployment, run these health checks:

```bash
# 1. Check API starts without secret errors
curl -i https://api.yourdomain.com/healthz
# Expected: 200 OK

# 2. Check JWT tokens work
curl -X POST https://api.yourdomain.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"test123"}'
# Expected: Returns access token (not 401/500)

# 3. Check Sentry is receiving errors (if configured)
# Go to Sentry dashboard - should show no "Invalid DSN" errors

# 4. Check database connection
# In logs, should see: "DATABASE: SSL verification ENABLED (production)"
```

---

## 6️⃣ SECRETS ROTATION POLICY

**How often to rotate secrets:**

| Secret | Frequency | Reason |
|--------|-----------|--------|
| JWT_PRIVATE_KEY | Every 6-12 months | RSA key aging |
| ENCRYPTION_KEY | Every 12 months | Crypto best practices |
| DB_PASSWORD | Every 90 days | Security policy |
| API Keys (Gemini, Groq) | Quarterly | Provider policy |

**How to rotate:**

1. Generate new secret (follow steps 1-4)
2. Add to secrets manager with NEW name: `ahp/prod/jwt-private-key-v2`
3. Update code to read from both old and new keys
4. Wait 24 hours (give existing tokens time to expire)
5. Remove old key from secrets manager
6. Update code to read only new key

---

## 7️⃣ DISASTER RECOVERY: What to Do If Secrets Leak

**Immediate Actions (within 5 minutes):**

1. **Revoke compromised secrets**:
   ```bash
   # In Railway: Delete the leaked secret variable
   # In AWS: Mark secret as compromised
   # In K8s: Delete secret, create new one
   ```

2. **Generate replacements**:
   ```bash
   # Follow steps 1-4 above to generate new secrets
   openssl genrsa -out jwt_private.pem 2048  # New JWT key
   openssl rand -base64 32                   # New encryption key
   ```

3. **Update all services**:
   ```bash
   # Update secrets in Railway/AWS/K8s
   # Restart API service
   # Restart worker service
   ```

4. **Invalidate existing tokens**:
   ```bash
   # If JWT_PRIVATE_KEY leaked, all existing tokens are compromised
   # Optionally: Clear Redis to invalidate refresh tokens
   redis-cli FLUSHDB  # WARNING: Clears all cache/sessions
   ```

5. **Alert stakeholders**:
   - Security team
   - DevOps lead
   - Incident response team

6. **Post-mortem**:
   - How did secret get exposed?
   - Update .gitignore / IAM policies
   - Add secret scanning to CI/CD

---

## 8️⃣ SECURITY CHECKLIST

```
✅ BEFORE DEPLOYMENT:
  [ ] Secrets generated locally (not in repository)
  [ ] .env file added to .gitignore
  [ ] All secrets added to Railway/AWS
  [ ] DEBUG=False in production
  [ ] ALLOWED_ORIGINS set to production domains
  [ ] No localhost in CORS origins
  [ ] JWT keys are valid (have BEGIN/END markers)
  [ ] Encryption key is 32 bytes (base64)
  [ ] Secret key is min 32 characters
  [ ] Database password is strong (20+ chars)

✅ AFTER DEPLOYMENT:
  [ ] Health check passes (/healthz returns 200)
  [ ] API can authenticate users
  [ ] Encryption/decryption works
  [ ] Database connects with SSL verification
  [ ] Sentry configured and receiving errors
  [ ] No secrets appear in logs
  [ ] Security headers present (run: curl -i https://api.yourdomain.com)
  [ ] HTTPS redirect works (test http://api.yourdomain.com)

✅ ONGOING:
  [ ] Monitor for exposed secrets (git-secrets, truffleHog)
  [ ] Rotate secrets quarterly
  [ ] Review access logs monthly
  [ ] Update .env.example when adding new secrets
  [ ] Train team on secret management
```

---

## 🚨 EMERGENCY REFERENCE

```
ACCIDENTAL SECRET LEAK IN GIT:
  git filter-branch --tree-filter 'rm -f .env' HEAD
  git push origin --force-with-lease
  Regenerate all secrets

FORGOT RAILWAY PASSWORD:
  1. Go to Railway dashboard
  2. Settings → Account → Reset Password
  3. Check email for reset link

SENTRY DSN NOT WORKING:
  1. Verify SENTRY_DSN is set correctly
  2. Check Sentry project is active (not archived)
  3. Verify firewall allows outbound to sentry.io
  4. Check logs for: "Sentry Observability Enabled"

DATABASE AUTHENTICATION FAILS:
  1. Verify DB_PASSWORD is correct
  2. Ensure DB_HOST is correct (use Railway internal DNS)
  3. Check database user exists with that password
  4. Verify SSL certificate is valid (production)

API RETURNS 401 ON ALL REQUESTS:
  1. Check JWT_PRIVATE_KEY is set
  2. Check JWT_PUBLIC_KEY matches private key
  3. Check SECRET_KEY is set
  4. Restart API service
```

---

## 📚 REFERENCES

- [Railway Docs: Secrets](https://railway.app/docs/guides/security#secrets)
- [AWS Secrets Manager](https://aws.amazon.com/secrets-manager/)
- [OWASP: Secret Management](https://owasp.org/www-community/Secrets_Management)
- [git-secrets Tool](https://github.com/awslabs/git-secrets)

---

**Last Updated**: May 7, 2026  
**Owner**: DevOps/Security Team  
**Review Schedule**: Monthly
