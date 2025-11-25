# TraceNet Deployment Guide

## 🚀 Quick Deploy

**Simple 3-step deployment:**

```bash
npm run build    # Build TypeScript
git add .        # Stage changes
deploy.bat       # Deploy (or use commands below)
```

**Or manually:**
```bash
git commit -m "Your message"
git push origin main
```

✅ **That's it!** Cloud Build automatically deploys to Cloud Run in ~3 minutes.

---

## 📋 Architecture

```
Developer → GitHub → Cloud Build → Cloud Run → Live Service
```

### How It Works

1. **Push to GitHub** (`main` branch)
2. **Cloud Build Trigger** detects push
3. **Docker Build** creates container image
4. **Cloud Run Deploy** updates live service
5. **Service Live** at https://tracenet-blockchain-bbzxtm72vq-uc.a.run.app

---

## 🔧 One-Time Setup

### Prerequisites

- Google Cloud Project: `blockchain-message-economy`
- GitHub Repository: `LodosLawson/TraceNet`
- gcloud CLI installed

### Step 1: Create Secrets

Required secrets in Google Secret Manager:

```bash
# Navigate to project
gcloud config set project blockchain-message-economy

# Create secrets (one-time)
echo "https://ojvozdzludrslnqcxydf.supabase.co" | gcloud secrets create supabase-url --data-file=-
echo "YOUR_SUPABASE_ANON_KEY" | gcloud secrets create supabase-anon-key --data-file=-
echo "YOUR_SERVICE_ROLE_KEY" | gcloud secrets create supabase-service-role-key --data-file=-
echo "YOUR_JWT_SECRET" | gcloud secrets create jwt-secret --data-file=-
echo "YOUR_ENCRYPTION_KEY" | gcloud secrets create encryption-key --data-file=-
```

### Step 2: Create Cloud Build Trigger

**Option A: Google Cloud Console (Recommended)**

1. Go to [Cloud Build Triggers](https://console.cloud.google.com/cloud-build/triggers?project=blockchain-message-economy)

2. Click **"CREATE TRIGGER"**

3. Configure:
   - **Name**: `tracenet-auto-deploy`
   - **Region**: `us-central1`
   - **Event**: Push to a branch
   - **Source**: 
     - Click "CONNECT NEW REPOSITORY"
     - Select GitHub
     - Authenticate and select `LodosLawson/TraceNet`
   - **Branch**: `^main$`
   - **Configuration**: Cloud Build configuration file (yaml or json)
   - **Location**: `/cloudbuild.yaml`

4. Click **"CREATE"**

**Option B: gcloud Command Line**

```bash
gcloud builds triggers create github \
  --name=tracenet-auto-deploy \
  --repo-name=TraceNet \
  --repo-owner=LodosLawson \
  --branch-pattern=^main$ \
  --build-config=cloudbuild.yaml \
  --region=us-central1
```

### Step 3: Grant Permissions

```bash
# Get Cloud Build service account
PROJECT_NUMBER=$(gcloud projects describe blockchain-message-economy --format="value(projectNumber)")
BUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

# Grant Secret Manager access
gcloud projects add-iam-policy-binding blockchain-message-economy \
  --member="serviceAccount:${BUILD_SA}" \
  --role="roles/secretmanager.secretAccessor"

# Grant Cloud Run admin
gcloud projects add-iam-policy-binding blockchain-message-economy \
  --member="serviceAccount:${BUILD_SA}" \
  --role="roles/run.admin"
```

### Step 4: Test Deployment

```bash
# Test build manually
gcloud builds submit --config cloudbuild.yaml .

# Or push to GitHub
git push origin main
```

---

## 📦 What Gets Deployed

### Docker Image

- **Base**: Node.js 20 Alpine
- **Build**: TypeScript → JavaScript
- **Size**: ~300MB (optimized)
- **Registry**: `gcr.io/blockchain-message-economy/tracenet-blockchain`

### Cloud Run Service

- **Name**: `tracenet-blockchain`
- **Region**: `us-central1`
- **URL**: https://tracenet-blockchain-bbzxtm72vq-uc.a.run.app
- **Resources**:
  - CPU: 2 vCPU
  - Memory: 2 GiB
  - Timeout: 300s
  - Concurrency: 80
  - Min instances: 1
  - Max instances: 10

### Environment Variables

**From Environment:**
- `NODE_ENV=production`
- `PORT=3000`
- `LOG_LEVEL=info`

**From Secret Manager:**
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`
- `ENCRYPTION_KEY`

---

## 🔍 Monitoring & Logs

### View Build Status

```bash
# Latest build
gcloud builds list --limit=5

# Watch specific build
gcloud builds log BUILD_ID --stream
```

**Console**: https://console.cloud.google.com/cloud-build/builds?project=blockchain-message-economy

### View Service Logs

```bash
# Stream logs
gcloud run services logs read tracenet-blockchain --region=us-central1 --follow

# Recent logs
gcloud run services logs read tracenet-blockchain --region=us-central1 --limit=50
```

**Console**: https://console.cloud.google.com/run/detail/us-central1/tracenet-blockchain/logs?project=blockchain-message-economy

### Health Check

```bash
curl https://tracenet-blockchain-bbzxtm72vq-uc.a.run.app/health
```

---

## 🐛 Troubleshooting

### Build Fails

**Check logs:**
```bash
gcloud builds list --limit=1
gcloud builds log <BUILD_ID>
```

**Common issues:**
- ❌ TypeScript compilation errors → Run `npm run build` locally
- ❌ Missing dependencies → Check `package.json`
- ❌ Docker build fails → Test `docker build -t test .` locally

### Deployment Fails

**Check Cloud Run logs:**
```bash
gcloud run services logs read tracenet-blockchain --region=us-central1 --limit=100
```

**Common issues:**
- ❌ Missing secrets → Verify Secret Manager
- ❌ Port mismatch → Ensure app listens on PORT env var
- ❌ Startup timeout → Check health endpoint

### Service Not Responding

```bash
# Check service status
gcloud run services describe tracenet-blockchain --region=us-central1

# Check if service is running
curl -I https://tracenet-blockchain-bbzxtm72vq-uc.a.run.app/health
```

**Common issues:**
- ❌ Cold start → First request may take 5-10s
- ❌ Application error → Check logs
- ❌ No instances → Check min-instances setting

---

## 🔄 Rollback

### To Previous Version

```bash
# List revisions
gcloud run revisions list --service=tracenet-blockchain --region=us-central1

# Rollback to specific revision
gcloud run services update-traffic tracenet-blockchain \
  --region=us-central1 \
  --to-revisions=REVISION_NAME=100
```

### Emergency: Redeploy Last Working Commit

```bash
# Find last working commit
git log --oneline

# Reset to that commit
git reset --hard COMMIT_HASH

# Force push (be careful!)
git push origin main --force
```

---

## 📊 Cost Estimate

Based on typical usage:

- **Cloud Build**: ~$0.003/build-minute (~$0.10/build)
- **Container Registry**: ~$0.10/GB/month storage
- **Cloud Run**: 
  - Free tier: 2M requests/month
  - Beyond free: ~$0.40/million requests
  - CPU: ~$0.00002400/vCPU-second
  - Memory: ~$0.00000250/GiB-second

**Estimated monthly cost**: $5-20 depending on traffic

---

## 🔐 Security Notes

### Secrets Management

- ✅ Never commit secrets to Git
- ✅ Use Secret Manager for sensitive data
- ✅ Rotate secrets regularly
- ✅ Use different secrets for dev/prod

### Access Control

```bash
# Only allow authenticated users (if needed)
gcloud run services update tracenet-blockchain \
  --region=us-central1 \
  --no-allow-unauthenticated
```

### Network Security

- Cloud Run has built-in DDoS protection
- HTTPS enforced by default
- Auto-scales to handle traffic spikes

---

## 📚 Additional Resources

- [Cloud Build Documentation](https://cloud.google.com/build/docs)
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Secret Manager Documentation](https://cloud.google.com/secret-manager/docs)
- [Project Console](https://console.cloud.google.com/home/dashboard?project=blockchain-message-economy)
