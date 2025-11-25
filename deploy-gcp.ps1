# TraceNet Google Cloud Deployment Script (PowerShell)
# This script deploys the TraceNet blockchain to Google Cloud Platform

param(
    [string]$ProjectId = "tracenet-prod",
    [string]$Region = "us-central1"
)

$ErrorActionPreference = "Stop"

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "TraceNet GCP Deployment" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  Project ID: $ProjectId"
Write-Host "  Region: $Region"
Write-Host ""

# Step 1: Check prerequisites
Write-Host "Step 1: Checking prerequisites..." -ForegroundColor Green
$commands = @("gcloud", "docker", "terraform")
foreach ($cmd in $commands) {
    if (!(Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Host "Error: $cmd is required but not installed." -ForegroundColor Red
        exit 1
    }
}
Write-Host "✓ All prerequisites installed" -ForegroundColor Green

# Step 2: Authenticate with GCP
Write-Host ""
Write-Host "Step 2: Authenticating with GCP..." -ForegroundColor Green
gcloud auth login
gcloud config set project $ProjectId
Write-Host "✓ Authenticated" -ForegroundColor Green

# Step 3: Enable required APIs
Write-Host ""
Write-Host "Step 3: Enabling required APIs..." -ForegroundColor Green
$apis = @(
    "container.googleapis.com",
    "cloudbuild.googleapis.com",
    "run.googleapis.com",
    "sqladmin.googleapis.com",
    "redis.googleapis.com",
    "storage.googleapis.com",
    "pubsub.googleapis.com",
    "secretmanager.googleapis.com",
    "compute.googleapis.com"
)
gcloud services enable $($apis -join " ")
Write-Host "✓ APIs enabled" -ForegroundColor Green

# Step 4: Create Terraform state bucket
Write-Host ""
Write-Host "Step 4: Creating Terraform state bucket..." -ForegroundColor Green
gsutil mb -p $ProjectId -l $Region gs://tracenet-terraform-state 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Bucket already exists" -ForegroundColor Yellow
}
gsutil versioning set on gs://tracenet-terraform-state
Write-Host "✓ State bucket ready" -ForegroundColor Green

# Step 5: Deploy infrastructure with Terraform
Write-Host ""
Write-Host "Step 5: Deploying infrastructure with Terraform..." -ForegroundColor Green
Set-Location terraform
terraform init
terraform plan -var="project_id=$ProjectId" -var="region=$Region" -out=tfplan
terraform apply -auto-approve tfplan
Set-Location ..
Write-Host "✓ Infrastructure deployed" -ForegroundColor Green

# Step 6: Build and push Docker image
Write-Host ""
Write-Host "Step 6: Building Docker image..." -ForegroundColor Green
gcloud builds submit --config cloudbuild.yaml .
Write-Host "✓ Docker image built and pushed" -ForegroundColor Green

# Step 7: Get deployment info
Write-Host ""
Write-Host "Step 7: Getting deployment information..." -ForegroundColor Green
$ServiceUrl = gcloud run services describe tracenet-blockchain --region=$Region --format="value(status.url)"

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Deployment Complete!" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Service URL: $ServiceUrl" -ForegroundColor Yellow
Write-Host ""
Write-Host "Test endpoints:" -ForegroundColor Yellow
Write-Host "  Health: $ServiceUrl/health"
Write-Host "  Status: $ServiceUrl/rpc/status"
Write-Host "  Token Price: $ServiceUrl/economy/tokenPrice"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Set up secrets in Secret Manager"
Write-Host "  2. Configure environment variables"
Write-Host "  3. Run integration tests"
Write-Host "  4. Set up monitoring and alerts"
Write-Host ""
