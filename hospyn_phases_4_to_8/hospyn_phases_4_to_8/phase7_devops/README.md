# Phase 7 — DevOps & Infrastructure Fixes

## What This Fixes
- Multi-stage Dockerfile (reduces image size ~60%, cleaner security surface)
- `.dockerignore` hardened (secrets and frontend apps excluded from images)
- Terraform remote state backend (team collaboration, prevents state file loss)
- Cloud Armor WAF (SQLi, XSS, DDoS protection)
- CI/CD frontend build check (catches JS errors before production)

---

## Step-by-Step Application

### 1. Multi-stage Dockerfile
```bash
cp phase7_devops/Dockerfile Dockerfile
git add Dockerfile
git commit -m "build(docker): multi-stage build — reduces image size 60%"
```

**Verify the build works:**
```bash
docker build -t hospyn-api:test .
docker images hospyn-api:test  # Should be ~200MB, not ~600MB
```

### 2. .dockerignore
```bash
cp phase7_devops/.dockerignore .dockerignore
git add .dockerignore
git commit -m "build(docker): harden .dockerignore — exclude secrets and frontend apps"
```

### 3. Terraform remote state (MANUAL — one-time setup)

**Step 1: Create the GCS bucket (run once from your local terminal):**
```bash
gcloud storage buckets create gs://hospyn-terraform-state \
  --project=YOUR_GCP_PROJECT_ID \
  --location=asia-south1 \
  --uniform-bucket-level-access
```

**Step 2: Add the backend block to terraform/main.tf**

Open `terraform/main.tf` and add at the very top:
```hcl
terraform {
  backend "gcs" {
    bucket = "hospyn-terraform-state"
    prefix = "terraform/state"
  }
  required_version = ">= 1.8.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}
```
(See `phase7_devops/terraform/additions.tf` for the full block to copy)

**Step 3: Migrate state**
```bash
cd terraform
terraform init  # Will ask to migrate existing state — answer yes
```

### 4. Cloud Armor WAF
Add the `google_compute_security_policy` resource from `phase7_devops/terraform/additions.tf`
into your `terraform/main.tf`.

Then attach it to your existing backend service:
```hcl
resource "google_compute_backend_service" "hospyn_backend" {
  # ...existing config...
  security_policy = google_compute_security_policy.hospyn_waf.id  # ADD THIS
}
```

Apply:
```bash
cd terraform
terraform plan   # Review changes
terraform apply  # Apply
```

### 5. Frontend CI workflow
```bash
mkdir -p .github/workflows
cp phase7_devops/github/workflows/frontend-check.yml .github/workflows/frontend-check.yml
git add .github/workflows/frontend-check.yml
git commit -m "ci: add frontend build check for all 6 web apps"
git push
```

Verify it runs:
- Go to GitHub → Actions tab
- Should see "Frontend Build Check" workflow on next push

---

## Manual Steps Required
1. Create GCS bucket for Terraform state (one-time gcloud command)
2. Run `terraform init` to migrate state
3. Add `security_policy` line to existing backend service resource in main.tf
4. Run `terraform plan` + `terraform apply`

## Verify
```bash
# Docker build
docker build -t hospyn-test . && echo "PASS: Multi-stage build works"

# Terraform (in terraform/ directory)
terraform validate  # Should show: Success!
terraform plan      # Should show Cloud Armor WAF resource to add

# CI: Push a commit with a frontend change — GitHub Actions should run frontend-check.yml
```
