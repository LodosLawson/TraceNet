#!/bin/bash

# TraceNet Google Cloud Deployment Script
# This script deploys the TraceNet blockchain to Google Cloud Platform

set -e

echo "======================================"
echo "TraceNet GCP Deployment"
echo "======================================"

# Configuration
PROJECT_ID="${1:-tracenet-prod}"
REGION="${2:-us-central1}"
CLUSTER_NAME="tracenet-cluster"

echo ""
echo "Configuration:"
echo "  Project ID: $PROJECT_ID"
echo "  Region: $REGION"
echo "  Cluster: $CLUSTER_NAME"
echo ""

# Step 1: Check prerequisites
echo "Step 1: Checking prerequisites..."
command -v gcloud >/dev/null 2>&1 || { echo "gcloud CLI is required but not installed. Aborting." >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "Docker is required but not installed. Aborting." >&2; exit 1; }
command -v terraform >/dev/null 2>&1 || { echo "Terraform is required but not installed. Aborting." >&2; exit 1; }
echo "✓ All prerequisites installed"

# Step 2: Authenticate with GCP
echo ""
echo "Step 2: Authenticating with GCP..."
gcloud auth login
gcloud config set project $PROJECT_ID
echo "✓ Authenticated"

# Step 3: Enable required APIs
echo ""
echo "Step 3: Enabling required APIs..."
gcloud services enable \
  container.googleapis.com \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  storage.googleapis.com \
  pubsub.googleapis.com \
  secretmanager.googleapis.com \
  cloudkms.googleapis.com \
  compute.googleapis.com
echo "✓ APIs enabled"

# Step 4: Create Terraform state bucket
echo ""
echo "Step 4: Creating Terraform state bucket..."
gsutil mb -p $PROJECT_ID -l $REGION gs://tracenet-terraform-state || echo "Bucket already exists"
gsutil versioning set on gs://tracenet-terraform-state
echo "✓ State bucket ready"

# Step 5: Deploy infrastructure with Terraform
echo ""
echo "Step 5: Deploying infrastructure with Terraform..."
cd terraform
terraform init
terraform plan -var="project_id=$PROJECT_ID" -var="region=$REGION" -out=tfplan
terraform apply tfplan
cd ..
echo "✓ Infrastructure deployed"

# Step 6: Build and push Docker image
echo ""
echo "Step 6: Building Docker image..."
gcloud builds submit --config cloudbuild.yaml .
echo "✓ Docker image built and pushed"

# Step 7: Get deployment info
echo ""
echo "Step 7: Getting deployment information..."
LOAD_BALANCER_IP=$(gcloud compute addresses describe tracenet-lb-ip --global --format="value(address)")
SERVICE_URL=$(gcloud run services describe tracenet-blockchain --region=$REGION --format="value(status.url)")

echo ""
echo "======================================"
echo "Deployment Complete!"
echo "======================================"
echo ""
echo "Service URL: $SERVICE_URL"
echo "Load Balancer IP: $LOAD_BALANCER_IP"
echo ""
echo "Test endpoints:"
echo "  Health: $SERVICE_URL/health"
echo "  Status: $SERVICE_URL/rpc/status"
echo "  Token Price: $SERVICE_URL/economy/tokenPrice"
echo ""
echo "Next steps:"
echo "  1. Set up secrets in Secret Manager"
echo "  2. Configure environment variables"
echo "  3. Run integration tests"
echo "  4. Set up monitoring and alerts"
echo ""
