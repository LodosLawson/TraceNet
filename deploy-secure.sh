#!/bin/bash
# TraceNet V3.0 - Secure Cloud Run Deployment Script
# 
# This script generates secure secrets and deploys to Cloud Run

echo "🔐 Generating Secure Secrets..."

# Generate secure JWT secret (64 characters)
JWT_SECRET=$(openssl rand -hex 32)
echo "✅ JWT_SECRET generated: ${JWT_SECRET:0:20}... (64 chars)"

# Generate secure validator private key (64 characters)
VALIDATOR_KEY=$(openssl rand -hex 32)
echo "✅ VALIDATOR_PRIVATE_KEY generated: ${VALIDATOR_KEY:0:20}... (64 chars)"

echo ""
echo "🚀 Deploying to Cloud Run with Secure Environment Variables..."
echo ""

# Deploy to Cloud Run
gcloud run services update tracenet-blockchain \
  --project=blockchain-message-economy \
  --region=us-central1 \
  --set-env-vars="JWT_SECRET=${JWT_SECRET},VALIDATOR_PRIVATE_KEY=${VALIDATOR_KEY},NODE_ENV=production,TRUSTED_PROXY=true"

echo ""
echo "✅ Deployment Complete!"
echo ""
echo "⚠️  IMPORTANT: Save these secrets securely!"
echo ""
echo "JWT_SECRET=${JWT_SECRET}"
echo "VALIDATOR_PRIVATE_KEY=${VALIDATOR_KEY}"
echo ""
echo "🔒 Store these in your password manager or secure vault."
echo "🔒 DO NOT commit these to Git!"
echo ""
