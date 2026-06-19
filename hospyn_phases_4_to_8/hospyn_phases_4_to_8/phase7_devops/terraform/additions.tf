##############################################################################
# terraform/additions.tf
# Phase 7 Fix: Remote state backend + Cloud Armor WAF
#
# APPLY TO: terraform/main.tf
#
# Instructions:
#   1. Add the `terraform { backend "gcs" ... }` block at the TOP of main.tf
#      (before the provider block).
#   2. Add the `google_compute_security_policy` resource anywhere in main.tf.
#   3. Create the GCS bucket first (one-time, manual):
#        gcloud storage buckets create gs://hospyn-terraform-state \
#          --project=YOUR_PROJECT_ID \
#          --location=asia-south1 \
#          --uniform-bucket-level-access
#   4. Then run: terraform init  (will migrate state to GCS)
##############################################################################

# =============================================================================
# BLOCK 1: Add to TOP of terraform/main.tf (before provider block)
# Enables team collaboration and prevents state file loss
# =============================================================================

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

# =============================================================================
# BLOCK 2: Cloud Armor WAF Policy
# Add this resource anywhere in terraform/main.tf
# Protects against SQLi, XSS, and rate-limit DDoS attacks
# =============================================================================

resource "google_compute_security_policy" "hospyn_waf" {
  name        = "hospyn-waf-policy"
  description = "Cloud Armor WAF for Hospyn API — SQLi, XSS, DDoS protection"
  project     = var.project_id

  # --- SQL Injection protection ---
  rule {
    action   = "deny(403)"
    priority = "1000"
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('sqli-v33-stable')"
      }
    }
    description = "Block SQL injection attacks"
  }

  # --- Cross-site scripting protection ---
  rule {
    action   = "deny(403)"
    priority = "1001"
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('xss-v33-stable')"
      }
    }
    description = "Block XSS attacks"
  }

  # --- Local file inclusion protection ---
  rule {
    action   = "deny(403)"
    priority = "1002"
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('lfi-v33-stable')"
      }
    }
    description = "Block local file inclusion attacks"
  }

  # --- Rate limiting — 1000 req/min per IP ---
  rule {
    action   = "throttle"
    priority = "2000"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      enforce_on_key = "IP"
      rate_limit_threshold {
        count        = 1000
        interval_sec = 60
      }
    }
    description = "Rate limit: 1000 req/min per IP"
  }

  # --- Auth endpoint tighter rate limit — 20 req/min per IP ---
  rule {
    action   = "throttle"
    priority = "1500"
    match {
      expr {
        expression = "request.path.startsWith('/api/v1/auth')"
      }
    }
    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      enforce_on_key = "IP"
      rate_limit_threshold {
        count        = 20
        interval_sec = 60
      }
    }
    description = "Tighter rate limit on auth endpoints"
  }

  # --- Default allow rule (required) ---
  rule {
    action   = "allow"
    priority = "2147483647"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    description = "Default allow"
  }
}

# =============================================================================
# BLOCK 3: Attach WAF policy to Cloud Run Load Balancer backend service
# Add this to your existing google_compute_backend_service resource:
#
#   resource "google_compute_backend_service" "hospyn_backend" {
#     ...existing config...
#     security_policy = google_compute_security_policy.hospyn_waf.id  # ADD THIS LINE
#   }
# =============================================================================
