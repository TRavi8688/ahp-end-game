terraform {
  required_version = ">= 1.5.0"
  
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.10.0"
    }
  }

  # Uncomment to use GCS as the remote backend for state files
  # backend "gcs" {
  #   bucket  = "hospyn-terraform-state"
  #   prefix  = "terraform/state"
  # }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
