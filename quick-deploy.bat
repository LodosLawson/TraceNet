@echo off
REM Quick Cloud Run Deployment (No Terraform Required)

echo ======================================
echo TraceNet Quick Deploy to Cloud Run
echo ======================================
echo.

REM Check if logged in
gcloud auth list --filter=status:ACTIVE --format="value(account)" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Please login to GCP first...
    gcloud auth login
)

REM Get or set project
for /f "delims=" %%i in ('gcloud config get-value project 2^>nul') do set CURRENT_PROJECT=%%i

if "%CURRENT_PROJECT%"=="" (
    echo No project set. Please enter your GCP Project ID:
    set /p PROJECT_ID="Project ID: "
    gcloud config set project %PROJECT_ID%
) else (
    echo Current project: %CURRENT_PROJECT%
    set PROJECT_ID=%CURRENT_PROJECT%
)

echo.
echo Using project: %PROJECT_ID%
echo.

REM Enable required APIs
echo Enabling Cloud Build and Cloud Run APIs...
gcloud services enable cloudbuild.googleapis.com run.googleapis.com

echo.
echo Building and deploying to Cloud Run...
echo This will take 5-10 minutes...
echo.

REM Build and deploy in one command
gcloud run deploy tracenet-blockchain ^
    --source . ^
    --region us-central1 ^
    --platform managed ^
    --allow-unauthenticated ^
    --port 3000 ^
    --memory 2Gi ^
    --cpu 2 ^
    --max-instances 10 ^
    --set-env-vars NODE_ENV=production,PORT=3000

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ======================================
    echo Deployment Successful!
    echo ======================================
    echo.
    
    REM Get service URL
    for /f "delims=" %%i in ('gcloud run services describe tracenet-blockchain --region=us-central1 --format="value(status.url)"') do set SERVICE_URL=%%i
    
    echo Your blockchain is live at:
    echo %SERVICE_URL%
    echo.
    echo Test it:
    echo   curl %SERVICE_URL%/health
    echo   curl %SERVICE_URL%/rpc/status
    echo   curl %SERVICE_URL%/economy/tokenPrice
    echo.
) else (
    echo.
    echo Deployment failed. Check the errors above.
    echo.
)

pause
