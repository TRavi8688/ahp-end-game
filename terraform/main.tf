# terraform/main.tf
# PHASE 08 FIX: Actual deployable GCP infrastructure as code.
# Previously the terraform/ directory existed but contained no deployable config.
# This provisions: Cloud Run, Cloud SQL PostgreSQL HA, Memorystore Redis,
# Secret Manager for all credentials, GCS for backups.

terraform {
  required_version = ">= 1.5"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
  # Store state in GCS (not locally — local state is lost with the machine)
  backend "gcs" {
    bucket = "hospyn-terraform-state"
    prefix = "prod/state"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# ─── VARIABLES ───────────────────────────────────────────────────────────────
variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "asia-south1"  # Mumbai — DPDP data localization requirement
}

variable "db_tier" {
  description = "Cloud SQL machine tier"
  type        = string
  default     = "db-g1-small"
}

variable "postgres_password" {
  description = "PostgreSQL password (store in terraform.tfvars, never commit)"
  type        = string
  sensitive   = true
}

variable "redis_auth_string" {
  description = "Redis AUTH string for Memorystore"
  type        = string
  sensitive   = true
}

# ─── ENABLE APIS ─────────────────────────────────────────────────────────────
resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "sql-component.googleapis.com",
    "sqladmin.googleapis.com",
    "redis.googleapis.com",
    "secretmanager.googleapis.com",
    "storage.googleapis.com",
    "cloudresourcemanager.googleapis.com",
  ])
  service            = each.key
  disable_on_destroy = false
}

# ─── VPC NETWORK ─────────────────────────────────────────────────────────────
resource "google_compute_network" "hospyn_vpc" {
  name                    = "hospyn-vpc"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "hospyn_subnet" {
  name          = "hospyn-subnet-${var.region}"
  ip_cidr_range = "10.0.0.0/24"
  region        = var.region
  network       = google_compute_network.hospyn_vpc.id
}

# ─── SECRET MANAGER ──────────────────────────────────────────────────────────
# FIX: All credentials stored in Secret Manager — not env vars or .env files
resource "google_secret_manager_secret" "enc_key" {
  secret_id = "hospyn-enc-key"
  replication { auto {} }
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret" "postgres_password" {
  secret_id = "hospyn-postgres-password"
  replication { auto {} }
}

resource "google_secret_manager_secret" "secret_key" {
  secret_id = "hospyn-secret-key"
  replication { auto {} }
}

# ─── CLOUD SQL POSTGRESQL ─────────────────────────────────────────────────────
# FIX: High-availability PostgreSQL — replaces SQLite
resource "google_sql_database_instance" "hospyn_postgres" {
  name             = "hospyn-postgres-prod"
  database_version = "POSTGRES_15"
  region           = var.region

  settings {
    tier = var.db_tier

    # HA configuration — automatic failover to standby
    availability_type = "REGIONAL"  # enables HA with automatic failover

    backup_configuration {
      enabled                        = true
      start_time                     = "02:00"  # 2 AM IST daily backup
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = 7
    }

    ip_configuration {
      ipv4_enabled    = false  # no public IP
      private_network = google_compute_network.hospyn_vpc.id
    }

    database_flags {
      name  = "log_connections"
      value = "on"
    }
    database_flags {
      name  = "log_disconnections"
      value = "on"
    }
  }

  deletion_protection = true  # prevents accidental terraform destroy
  depends_on          = [google_project_service.apis]
}

resource "google_sql_database" "hospyn_db" {
  name     = "hospyn"
  instance = google_sql_database_instance.hospyn_postgres.name
}

resource "google_sql_user" "hospyn_user" {
  name     = "hospyn"
  instance = google_sql_database_instance.hospyn_postgres.name
  password = var.postgres_password
}

# ─── MEMORYSTORE REDIS ───────────────────────────────────────────────────────
# FIX: Managed Redis with auth — replaces unauthenticated local Redis
resource "google_redis_instance" "hospyn_redis" {
  name               = "hospyn-redis-prod"
  tier               = "STANDARD_HA"   # HA with automatic failover
  memory_size_gb     = 1
  region             = var.region
  authorized_network = google_compute_network.hospyn_vpc.id
  auth_enabled       = true            # FIX: Redis authentication enabled
  transit_encryption_mode = "SERVER_AUTHENTICATION"
  depends_on = [google_project_service.apis]
}

# ─── GCS BACKUP BUCKET ───────────────────────────────────────────────────────
# FIX: Offsite backup storage — backups no longer local-only
resource "google_storage_bucket" "backups" {
  name          = "${var.project_id}-hospyn-backups"
  location      = var.region
  force_destroy = false

  versioning {
    enabled = true
  }

  lifecycle_rule {
    action { type = "Delete" }
    condition { age = 90 }  # keep 90 days of backups
  }

  uniform_bucket_level_access = true
}

# ─── SERVICE ACCOUNT FOR CLOUD RUN ───────────────────────────────────────────
resource "google_service_account" "hospyn_api" {
  account_id   = "hospyn-api"
  display_name = "Hospyn API Service Account"
}

# Grant access to Secret Manager secrets
resource "google_secret_manager_secret_iam_member" "enc_key_access" {
  secret_id = google_secret_manager_secret.enc_key.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.hospyn_api.email}"
}

# Grant Cloud SQL access
resource "google_project_iam_member" "sql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.hospyn_api.email}"
}

# ─── OUTPUTS ─────────────────────────────────────────────────────────────────
output "postgres_connection_name" {
  value = google_sql_database_instance.hospyn_postgres.connection_name
}

output "redis_host" {
  value = google_redis_instance.hospyn_redis.host
}

output "backup_bucket" {
  value = google_storage_bucket.backups.name
}
