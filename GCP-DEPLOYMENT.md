# TraceNet Google Cloud Deployment Guide

## Hızlı Başlangıç

### Gereksinimler

1. **Google Cloud Account**
   - https://cloud.google.com adresinden hesap oluşturun
   - Billing (faturalama) aktif edin

2. **Gerekli Araçlar**
   - Google Cloud SDK: https://cloud.google.com/sdk/docs/install
   - Docker Desktop: https://docs.docker.com/get-docker/
   - Terraform: https://developer.hashicorp.com/terraform/downloads

### Kurulum Adımları

#### 1. Google Cloud SDK Kurulumu

```powershell
# Windows için Google Cloud SDK indir ve kur
# https://cloud.google.com/sdk/docs/install

# Kurulum sonrası doğrula
gcloud --version
```

#### 2. Docker Desktop Kurulumu

```powershell
# Docker Desktop indir ve kur
# https://www.docker.com/products/docker-desktop/

# Kurulum sonrası doğrula
docker --version
```

#### 3. Terraform Kurulumu

```powershell
# Chocolatey ile (önerilen)
choco install terraform

# Veya manuel indir
# https://developer.hashicorp.com/terraform/downloads

# Kurulum sonrası doğrula
terraform --version
```

---

## Otomatik Deployment

### Tek Komutla Deploy

```powershell
# PowerShell'i Administrator olarak aç
cd c:\Users\mehem\.gemini\antigravity\scratch\Tracenet

# Deploy scriptini çalıştır
.\deploy-gcp.ps1 -ProjectId "tracenet-prod" -Region "us-central1"
```

Bu script otomatik olarak:
1. ✅ Gereksinimleri kontrol eder
2. ✅ GCP'ye authenticate eder
3. ✅ Gerekli API'leri aktif eder
4. ✅ Terraform ile infrastructure oluşturur
5. ✅ Docker image build eder
6. ✅ Cloud Run'a deploy eder

**Tahmini Süre:** 20-30 dakika

---

## Manuel Deployment

### Adım 1: GCP Projesi Oluştur

```powershell
# GCP'ye login
gcloud auth login

# Yeni proje oluştur
gcloud projects create tracenet-prod --name="TraceNet Blockchain"

# Projeyi aktif et
gcloud config set project tracenet-prod

# Billing hesabını bağla (GCP Console'dan)
# https://console.cloud.google.com/billing
```

### Adım 2: API'leri Aktif Et

```powershell
gcloud services enable `
  container.googleapis.com `
  cloudbuild.googleapis.com `
  run.googleapis.com `
  sqladmin.googleapis.com `
  redis.googleapis.com `
  storage.googleapis.com `
  pubsub.googleapis.com `
  secretmanager.googleapis.com `
  compute.googleapis.com
```

### Adım 3: Terraform State Bucket Oluştur

```powershell
gsutil mb -p tracenet-prod -l us-central1 gs://tracenet-terraform-state
gsutil versioning set on gs://tracenet-terraform-state
```

### Adım 4: Infrastructure Deploy

```powershell
cd terraform

# Initialize Terraform
terraform init

# Plan
terraform plan -var="project_id=tracenet-prod" -var="region=us-central1" -out=tfplan

# Apply
terraform apply tfplan
```

**Oluşturulacak Kaynaklar:**
- VPC Network
- GKE Cluster (3 nodes)
- Cloud SQL (PostgreSQL)
- Memorystore (Redis)
- Cloud Storage buckets
- Pub/Sub topics
- Secret Manager secrets
- Load Balancer

### Adım 5: Docker Image Build & Deploy

```powershell
cd ..

# Cloud Build ile build et
gcloud builds submit --config cloudbuild.yaml .
```

Bu komut:
1. Docker image build eder
2. Container Registry'e push eder
3. Cloud Run'a deploy eder

### Adım 6: Secrets Ayarla

```powershell
# JWT Secret
echo -n "your-super-secret-jwt-key-change-in-production" | `
  gcloud secrets versions add jwt-secret --data-file=-

# Encryption Key
echo -n "your-super-secret-encryption-key-32-chars" | `
  gcloud secrets versions add encryption-key --data-file=-
```

### Adım 7: Deployment Doğrula

```powershell
# Service URL'i al
$SERVICE_URL = gcloud run services describe tracenet-blockchain `
  --region=us-central1 `
  --format="value(status.url)"

# Health check
curl "$SERVICE_URL/health"

# Node status
curl "$SERVICE_URL/rpc/status"

# Token price
curl "$SERVICE_URL/economy/tokenPrice"
```

---

## Deployment Seçenekleri

### Seçenek 1: Cloud Run (Önerilen - Başlangıç için)

**Avantajlar:**
- ✅ Otomatik scaling
- ✅ Sadece kullandığın kadar öde
- ✅ Kolay deployment
- ✅ Yönetim gerektirmez

**Dezavantajlar:**
- ❌ Stateless (her request yeni container)
- ❌ Blockchain state yönetimi zor

**Maliyet:** ~$50-100/ay (düşük trafik)

```powershell
# Cloud Run deployment
gcloud run deploy tracenet-blockchain `
  --image gcr.io/tracenet-prod/tracenet-blockchain:latest `
  --region us-central1 `
  --platform managed `
  --allow-unauthenticated `
  --port 3000 `
  --memory 2Gi `
  --cpu 2
```

### Seçenek 2: GKE (Kubernetes) - Production için

**Avantajlar:**
- ✅ Stateful uygulamalar için ideal
- ✅ Tam kontrol
- ✅ Persistent storage
- ✅ Blockchain için uygun

**Dezavantajlar:**
- ❌ Daha karmaşık
- ❌ Yönetim gerektirir
- ❌ Daha pahalı

**Maliyet:** ~$300-500/ay

```powershell
# GKE cluster credentials
gcloud container clusters get-credentials tracenet-cluster --region us-central1

# Deploy with kubectl
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
```

### Seçenek 3: Compute Engine (VM)

**Avantajlar:**
- ✅ Tam kontrol
- ✅ Basit
- ✅ SSH erişimi

**Dezavantajlar:**
- ❌ Manuel scaling
- ❌ Yönetim gerektirir
- ❌ High availability zor

**Maliyet:** ~$100-200/ay

```powershell
# VM oluştur
gcloud compute instances create tracenet-node `
  --machine-type=n2-standard-4 `
  --zone=us-central1-a `
  --image-family=ubuntu-2204-lts `
  --image-project=ubuntu-os-cloud `
  --boot-disk-size=100GB

# SSH ile bağlan
gcloud compute ssh tracenet-node --zone=us-central1-a

# VM'de Docker kur ve çalıştır
sudo docker run -d -p 3000:3000 gcr.io/tracenet-prod/tracenet-blockchain:latest
```

---

## Monitoring & Logging

### Cloud Logging

```powershell
# Logları görüntüle
gcloud logging read "resource.type=cloud_run_revision" --limit 50

# Real-time logs
gcloud logging tail "resource.type=cloud_run_revision"
```

### Cloud Monitoring

```powershell
# Dashboard oluştur
# https://console.cloud.google.com/monitoring

# Metrics:
# - Request count
# - Response time
# - Error rate
# - CPU usage
# - Memory usage
```

### Alerts Kurulumu

```powershell
# Error rate alert
gcloud alpha monitoring policies create `
  --notification-channels=CHANNEL_ID `
  --display-name="High Error Rate" `
  --condition-display-name="Error rate > 5%"
```

---

## Maliyet Optimizasyonu

### Development/Staging

```powershell
# Küçük instance kullan
gcloud run deploy tracenet-blockchain `
  --memory 512Mi `
  --cpu 1 `
  --max-instances 3

# Tahmini maliyet: ~$20-30/ay
```

### Production

```powershell
# Otomatik scaling
gcloud run deploy tracenet-blockchain `
  --memory 2Gi `
  --cpu 2 `
  --min-instances 1 `
  --max-instances 10

# Tahmini maliyet: ~$100-300/ay
```

---

## Troubleshooting

### Deployment Hataları

```powershell
# Build logs kontrol et
gcloud builds list
gcloud builds log BUILD_ID

# Service logs kontrol et
gcloud run services logs read tracenet-blockchain --region=us-central1
```

### Connection Hataları

```powershell
# IAM permissions kontrol et
gcloud projects get-iam-policy tracenet-prod

# Service account kontrol et
gcloud iam service-accounts list
```

### Performance Sorunları

```powershell
# Metrics kontrol et
gcloud monitoring time-series list `
  --filter='metric.type="run.googleapis.com/request_count"'

# Instance sayısını artır
gcloud run services update tracenet-blockchain `
  --max-instances 20
```

---

## Güvenlik

### Secrets Yönetimi

```powershell
# Secret oluştur
gcloud secrets create my-secret --data-file=secret.txt

# Secret'ı Cloud Run'a bağla
gcloud run services update tracenet-blockchain `
  --update-secrets=JWT_SECRET=jwt-secret:latest
```

### Network Security

```powershell
# Cloud Armor ile DDoS koruması
gcloud compute security-policies create tracenet-policy

# Rate limiting
gcloud compute security-policies rules create 1000 `
  --security-policy tracenet-policy `
  --expression "true" `
  --action "rate-based-ban" `
  --rate-limit-threshold-count 100
```

---

## Backup & Recovery

### Otomatik Backups

```powershell
# Cloud SQL backup
gcloud sql backups create --instance=tracenet-postgres

# Storage bucket backup
gsutil -m cp -r gs://tracenet-prod-media gs://tracenet-prod-backups/
```

### Disaster Recovery

```powershell
# Snapshot oluştur
gcloud compute disks snapshot DISK_NAME --snapshot-names=backup-$(date +%Y%m%d)

# Restore
gcloud compute disks create DISK_NAME --source-snapshot=backup-20250125
```

---

## Sonraki Adımlar

1. ✅ GCP hesabı oluştur
2. ✅ Gerekli araçları kur (gcloud, docker, terraform)
3. ✅ Deploy scriptini çalıştır
4. ✅ Secrets ayarla
5. ✅ Monitoring kur
6. ✅ Custom domain bağla
7. ✅ SSL sertifikası ekle
8. ✅ Load testing yap
9. ✅ Production'a geç

---

## Destek

- **GCP Documentation:** https://cloud.google.com/docs
- **Cloud Run:** https://cloud.google.com/run/docs
- **Terraform:** https://registry.terraform.io/providers/hashicorp/google/latest/docs
- **GitHub:** https://github.com/LodosLawson/TraceNet

---

## Hızlı Komutlar

```powershell
# Deploy
.\deploy-gcp.ps1

# Logs
gcloud run services logs tail tracenet-blockchain --region=us-central1

# Update
gcloud builds submit --config cloudbuild.yaml .

# Delete
terraform destroy -var="project_id=tracenet-prod"
```
