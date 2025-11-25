@echo off
REM TraceNet Google Cloud Deployment Script (CMD)
REM This script deploys the TraceNet blockchain to Google Cloud Platform

echo ======================================
echo TraceNet GCP Deployment (CMD)
echo ======================================
echo.

REM Configuration
set PROJECT_ID=tracenet-prod
set REGION=us-central1
set CLUSTER_NAME=tracenet-cluster

echo Configuration:
echo   Project ID: %PROJECT_ID%
echo   Region: %REGION%
echo   Cluster: %CLUSTER_NAME%
echo.

REM Step 1: Check prerequisites
echo Step 1: Checking prerequisites...
where gcloud >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: gcloud is not installed
    echo Please install from: https://cloud.google.com/sdk/docs/install
    exit /b 1
)

where docker >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: docker is not installed
    echo Please install Docker Desktop
    exit /b 1
)

where terraform >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo WARNING: terraform is not installed
    echo Installing terraform...
    
    REM Try to install with chocolatey
    where choco >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        choco install terraform -y
    ) else (
        echo ERROR: Please install Terraform manually
        echo Download from: https://developer.hashicorp.com/terraform/downloads
        exit /b 1
    )
)

echo All prerequisites OK
echo.

REM Step 2: Authenticate with GCP
echo Step 2: Authenticating with GCP...
gcloud auth login
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Authentication failed
    exit /b 1
)

gcloud config set project %PROJECT_ID%
echo Authenticated
echo.

REM Step 3: Enable required APIs
echo Step 3: Enabling required APIs...
gcloud services enable container.googleapis.com cloudbuild.googleapis.com run.googleapis.com sqladmin.googleapis.com redis.googleapis.com storage.googleapis.com pubsub.googleapis.com secretmanager.googleapis.com compute.googleapis.com
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to enable APIs
    exit /b 1
)
echo APIs enabled
echo.

REM Step 4: Create Terraform state bucket
echo Step 4: Creating Terraform state bucket...
gsutil mb -p %PROJECT_ID% -l %REGION% gs://tracenet-terraform-state 2>nul
gsutil versioning set on gs://tracenet-terraform-state
echo State bucket ready
echo.

REM Step 5: Build and push Docker image (skip Terraform for now)
echo Step 5: Building Docker image...
gcloud builds submit --config cloudbuild.yaml .
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Docker build failed
    exit /b 1
)
echo Docker image built and pushed
echo.

REM Step 6: Get deployment info
echo Step 6: Getting deployment information...
for /f "delims=" %%i in ('gcloud run services describe tracenet-blockchain --region=%REGION% --format="value(status.url)"') do set SERVICE_URL=%%i

echo.
echo ======================================
echo Deployment Complete!
echo ======================================
echo.
echo Service URL: %SERVICE_URL%
echo.
echo Test endpoints:
echo   Health: %SERVICE_URL%/health
echo   Status: %SERVICE_URL%/rpc/status
echo   Token Price: %SERVICE_URL%/economy/tokenPrice
echo.
echo Next steps:
echo   1. Set up secrets in Secret Manager
echo   2. Configure environment variables
echo   3. Run integration tests
echo   4. Set up monitoring and alerts
echo.

pause
