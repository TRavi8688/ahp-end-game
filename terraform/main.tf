# Enable required GCP APIs
resource "google_project_service" "services" {
  for_each = toset([
    "sqladmin.googleapis.com",
    "redis.googleapis.com",
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "secretmanager.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "iam.googleapis.com"
  ])
  project            = var.project_id
  service            = each.key
  disable_on_destroy = false
}

# 1. Cloud SQL PostgreSQL
resource "google_sql_database_instance" "postgres" {
  name             = "hospyn-postgres-primary"
  database_version = "POSTGRES_15"
  region           = var.region
  project          = var.project_id

  depends_on = [google_project_service.services]

  settings {
    tier              = var.db_tier
    availability_type = "REGIONAL" # High availability
    disk_size         = 50
    disk_type         = "PD_SSD"

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      start_time                     = "03:00"
    }

    ip_configuration {
      ipv4_enabled = true
      # In production, recommend using private IP + VPC Serverless Connector
    }
  }
}

resource "google_sql_database" "database" {
  name     = "hospyn"
  instance = google_sql_database_instance.postgres.name
  project  = var.project_id
}

resource "google_sql_user" "users" {
  name     = "hospyn_admin"
  instance = google_sql_database_instance.postgres.name
  password = var.db_password
  project  = var.project_id
}

# 2. Memorystore Redis
resource "google_redis_instance" "cache" {
  name           = "hospyn-redis-cache"
  tier           = var.redis_tier
  memory_size_gb = var.redis_capacity_gb
  region         = var.region
  project        = var.project_id

  depends_on = [google_project_service.services]
}

# 3. Artifact Registry
resource "google_artifact_registry_repository" "repo" {
  location      = var.region
  repository_id = "ahp-repo"
  description   = "Docker repository for Hospyn backend images"
  format        = "DOCKER"
  project       = var.project_id

  depends_on = [google_project_service.services]
}

# 4. Cloud Run: API Service
resource "google_cloud_run_v2_service" "api" {
  name     = "hospyn-495906-api"
  location = var.region
  project  = var.project_id

  depends_on = [google_project_service.services]

  template {
    scaling {
      min_instance_count = 1
      max_instance_count = 10
    }
    containers {
      image = var.container_image
      
      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1000m"
          memory = "512Mi"
        }
      }

      # Secrets should be mounted via Secret Manager in production
      env {
        name  = "ENVIRONMENT"
        value = "production"
      }
    }
  }
}

# Allow unauthenticated invocation for the public API
resource "google_cloud_run_v2_service_iam_member" "public_api" {
  name     = google_cloud_run_v2_service.api.name
  location = google_cloud_run_v2_service.api.location
  project  = google_cloud_run_v2_service.api.project
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# 5. Cloud Run: Background Worker Service
resource "google_cloud_run_v2_service" "worker" {
  name     = "hospyn-495906-worker"
  location = var.region
  project  = var.project_id

  depends_on = [google_project_service.services]

  template {
    scaling {
      min_instance_count = 0
      max_instance_count = 5
    }
    containers {
      image = var.container_image
      
      command = ["bash"]
      args    = ["-c", "python3 -m http.server $PORT & arq app.workers.arq_worker.WorkerSettings"]

      resources {
        limits = {
          cpu    = "1000m"
          memory = "1024Mi"
        }
      }

      env {
        name  = "ENVIRONMENT"
        value = "production"
      }
    }
  }
}
