output "postgres_connection_name" {
  description = "The connection name of the Cloud SQL instance"
  value       = google_sql_database_instance.postgres.connection_name
}

output "postgres_public_ip" {
  description = "The public IPv4 address of the Cloud SQL instance"
  value       = google_sql_database_instance.postgres.public_ip_address
}

output "redis_host" {
  description = "The IP address of the Memorystore Redis instance"
  value       = google_redis_instance.cache.host
}

output "redis_port" {
  description = "The port of the Memorystore Redis instance"
  value       = google_redis_instance.cache.port
}

output "api_url" {
  description = "The URL of the Cloud Run API service"
  value       = google_cloud_run_v2_service.api.uri
}

output "artifact_registry_url" {
  description = "The URL of the Artifact Registry repository"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.repo.repository_id}"
}
