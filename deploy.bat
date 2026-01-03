@echo off
REM TraceNet Simple Deploy - Just push to GitHub!
REM Cloud Build automatically deploys to Cloud Run

echo =======================================
echo TraceNet Auto Deploy
echo =======================================
echo.

REM Step 1: Build TypeScript
echo [1/4] Building TypeScript...
cmd /c npm run build
if %ERRORLEVEL% NEQ 0 (
    echo Build failed! Fix errors before deploying.
    pause
    exit /b 1
)
echo      Build successful!
echo.

REM Step 2: Git status
echo [2/4] Checking changes...
git status --short
echo.

REM Step 3: Commit
echo [3/4] Committing changes...
git add .

if "%~1"=="" (
    set /p COMMIT_MSG="Enter commit message: "
) else (
    set COMMIT_MSG=%~1
)

git commit -m "%COMMIT_MSG%"
if %ERRORLEVEL% NEQ 0 (
    echo No changes to commit or commit failed.
    echo.
    choice /C YN /M "Continue with push anyway"
    if errorlevel 2 exit /b 0
)
echo.

REM Step 4: Push to GitHub (triggers Cloud Build)
echo [4/4] Pushing to GitHub...
echo      This will trigger automatic deployment to Cloud Run
echo.
git push origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo =======================================
    echo Deployment Started!
    echo =======================================
    echo.
    echo Your code is being deployed automatically.
    echo.
    echo Watch Cloud Build progress:
    echo   https://console.cloud.google.com/cloud-build/builds?project=blockchain-message-economy
    echo.
    echo Service will be live at (in ~3 minutes):
    echo   https://tracenet-blockchain-bbzxtm72vq-uc.a.run.app
    echo.
    echo You can close this window. Deployment continues in the cloud.
    echo.
) else (
    echo.
    echo Push failed! Check your internet connection and git credentials.
    echo.
)

pause
