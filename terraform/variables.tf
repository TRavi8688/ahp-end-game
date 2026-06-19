variable "project_id" {
  description = "The GCP project ID"
  type        = string
  default     = "hospyn-495906"
}

variable "region" {
  description = "The primary region for resources"
  type        = string
  default     = "us-central1"
}

variable "db_tier" {
  description = "The machine tier for Cloud SQL"
  type        = string
  default     = "db-custom-2-4096" # 2 vCPU, 4GB RAM
}

variable "db_password" {
  description = "The password for the PostgreSQL admin user"
  type        = string
  sensitive   = true
}

variable "redis_tier" {
  description = "The tier for Memorystore Redis (BASIC or STANDARD_HA)"
  type        = string
  default     = "STANDARD_HA"
}

variable "redis_capacity_gb" {
  description = "The capacity in GB for Memorystore Redis"
  type        = number
  default     = 1
}

variable "container_image" {
  description = "The initial container image to deploy to Cloud Run"
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello" # Placeholder until CI/CD pushes real image
}

variable "api_env_vars" {
  description = "Environment variables for the Cloud Run API"
  type        = map(string)
  default     = {}
}
