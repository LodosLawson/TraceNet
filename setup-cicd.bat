@echo off
REM Setup CI/CD - GitHub to Google Cloud Auto Deploy

echo ======================================
echo GitHub to Google Cloud CI/CD Setup
echo ======================================
echo.

set PROJECT_ID=blockchain-message-economy
set REGION=us-central1
set REPO_OWNER=LodosLawson
set REPO_NAME=TraceNet

echo Configuration:
echo   Project: %PROJECT_ID%
echo   Region: %REGION%
echo   GitHub: %REPO_OWNER%/%REPO_NAME%
echo.

REM Step 1: Enable required APIs
echo Step 1: Enabling APIs...
gcloud services enable cloudbuild.googleapis.com run.googleapis.com secretmanager.googleapis.com
echo.

REM Step 2: Create secrets
echo Step 2: Creating secrets...

REM Supabase URL
echo https://ojvozdzludrslnqcxydf.supabase.co | gcloud secrets create supabase-url --data-file=- 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Supabase URL secret already exists
) else (
    echo Created: supabase-url
)

REM Supabase Anon Key
echo eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qdm96ZHpsdWRyc2xucWN4eWRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMzNDE2OTIsImV4cCI6MjA1ODkxNzY5Mn0.URPE8D2B6iX0YwHLuO_HQYcN-AXuHT_H7yYhylYTKXo | gcloud secrets create supabase-anon-key --data-file=- 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Supabase Anon Key secret already exists
) else (
    echo Created: supabase-anon-key
)

REM Supabase Service Role Key
echo eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qdm96ZHpsdWRyc2xucWN4eWRmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MzM0MTY5MiwiZXhwIjoyMDU4OTE3NjkyfQ.eZ7-u1584sA3UbxYs_ge1ZqmoS-Jq6AE5aa8FEisySg | gcloud secrets create supabase-service-role-key --data-file=- 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Supabase Service Role Key secret already exists
) else (
    echo Created: supabase-service-role-key
)

REM JWT Secret
echo tracenet_jwt_secret_change_in_production_2024 | gcloud secrets create jwt-secret --data-file=- 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo JWT secret already exists
) else (
    echo Created: jwt-secret
)

REM Encryption Key
echo tracenet_encryption_key_32_bytes_change_in_production | gcloud secrets create encryption-key --data-file=- 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Encryption key secret already exists
) else (
    echo Created: encryption-key
)

echo.

REM Step 3: Connect GitHub repository
echo Step 3: Connecting GitHub repository...
echo.
echo MANUEL ADIM GEREKLI:
echo.
echo 1. Google Cloud Console'a git:
echo    https://console.cloud.google.com/cloud-build/triggers?project=%PROJECT_ID%
echo.
echo 2. "CREATE TRIGGER" tikla
echo.
echo 3. Ayarlari yap:
echo    - Name: tracenet-auto-deploy
echo    - Region: %REGION%
echo    - Event: Push to a branch
echo    - Source: Connect new repository
echo    - Repository: %REPO_OWNER%/%REPO_NAME%
echo    - Branch: ^main$
echo    - Configuration: Cloud Build configuration file
echo    - Location: /cloudbuild.yaml
echo.
echo 4. "CREATE" tikla
echo.
echo 5. GitHub'a push yapinca otomatik deploy baslar!
echo.

pause

REM Step 4: Test deployment
echo.
echo Step 4: Testing initial deployment...
gcloud builds submit --config cloudbuild.yaml .

echo.
echo ======================================
echo CI/CD Setup Complete!
echo ======================================
echo.
echo Artik her GitHub push'ta otomatik deploy olacak!
echo.
echo Test et:
echo   git add .
echo   git commit -m "test"
echo   git push origin main
echo.
echo Cloud Build'i izle:
echo   https://console.cloud.google.com/cloud-build/builds?project=%PROJECT_ID%
echo.

pause
