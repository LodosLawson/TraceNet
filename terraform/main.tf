terraform {
  required_version = ">= 1.0"
  
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  backend "gcs" {
    bucket = "tracenet-terraform-state"
    prefix = "terraform/state"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Variables
variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

# VPC Network
resource "google_compute_network" "vpc" {
  name                    = "tracenet-vpc"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "subnet" {
  name          = "tracenet-subnet"
  ip_cidr_range = "10.0.0.0/24"
  region        = var.region
  network       = google_compute_network.vpc.id

  secondary_ip_range {
    range_name    = "pods"
    ip_cidr_range = "10.1.0.0/16"
  }

  secondary_ip_range {
    range_name    = "services"
    ip_cidr_range = "10.2.0.0/16"
  }
}

# GKE Cluster
resource "google_container_cluster" "primary" {
  name     = "tracenet-cluster"
  location = var.region

  # We can't create a cluster with no node pool defined, but we want to only use
  # separately managed node pools. So we create the smallest possible default
  # node pool and immediately delete it.
  remove_default_node_pool = true
  initial_node_count       = 1

  network    = google_compute_network.vpc.name
  subnetwork = google_compute_subnetwork.subnet.name

  ip_allocation_policy {
    cluster_secondary_range_name  = "pods"
    services_secondary_range_name = "services"
  }

  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }
}

resource "google_container_node_pool" "primary_nodes" {
  name       = "tracenet-node-pool"
  location   = var.region
  cluster    = google_container_cluster.primary.name
  node_count = 3

  node_config {
    machine_type = "n2-standard-4"
    disk_size_gb = 100
    disk_type    = "pd-standard"

    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]

    labels = {
      environment = var.environment
    }

    tags = ["tracenet", "blockchain"]
  }

  autoscaling {
    min_node_count = 3
    max_node_count = 10
  }
}

# Cloud SQL (PostgreSQL)
resource "google_sql_database_instance" "postgres" {
  name             = "tracenet-postgres"
  database_version = "POSTGRES_15"
  region           = var.region

  settings {
    tier = "db-custom-2-7680"

    backup_configuration {
      enabled            = true
      start_time         = "03:00"
      point_in_time_recovery_enabled = true
    }

    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.vpc.id
    }
  }

  deletion_protection = true
}

resource "google_sql_database" "database" {
  name     = "tracenet"
  instance = google_sql_database_instance.postgres.name
}

# Memorystore (Redis)
resource "google_redis_instance" "cache" {
  name           = "tracenet-redis"
  tier           = "STANDARD_HA"
  memory_size_gb = 5
  region         = var.region

  authorized_network = google_compute_network.vpc.id

  redis_version = "REDIS_7_0"
}

# Cloud Storage Buckets
resource "google_storage_bucket" "media" {
  name          = "${var.project_id}-media"
  location      = var.region
  force_destroy = false

  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type = "Delete"
    }
  }
}

resource "google_storage_bucket" "backups" {
  name          = "${var.project_id}-backups"
  location      = var.region
  force_destroy = false

  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }
}

# Pub/Sub Topics
resource "google_pubsub_topic" "blockchain_events" {
  name = "blockchain-events"
}

resource "google_pubsub_topic" "social_events" {
  name = "social-events"
}

resource "google_pubsub_topic" "notification_events" {
  name = "notification-events"
}

# Secret Manager Secrets
resource "google_secret_manager_secret" "jwt_secret" {
  secret_id = "jwt-secret"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "encryption_key" {
  secret_id = "encryption-key"

  replication {
    auto {}
  }
}

# Load Balancer IP
resource "google_compute_global_address" "default" {
  name = "tracenet-lb-ip"
}

# Outputs
output "cluster_name" {
  value = google_container_cluster.primary.name
}

output "cluster_endpoint" {
  value     = google_container_cluster.primary.endpoint
  sensitive = true
}

output "load_balancer_ip" {
  value = google_compute_global_address.default.address
}

output "postgres_connection" {
  value     = google_sql_database_instance.postgres.connection_name
  sensitive = true
}

output "redis_host" {
  value = google_redis_instance.cache.host
}
