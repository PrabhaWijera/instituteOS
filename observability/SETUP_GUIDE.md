# NexClass Observability Stack - Complete Setup Guide

## Overview

This guide explains how to set up a production-grade observability stack with:
- **Prometheus** (Metrics)
- **Loki** (Logs)
- **Jaeger** (Distributed Tracing)
- **Grafana** (Dashboards & Alerting)
- **Alertmanager** (Email Alerts)

**Total Stack Memory**: ~3.5GB (fits in t2.micro with swap!)

---

## Part 1: Local Development Setup

### Step 1: Install Dependencies

```bash
cd /path/to/nexclass

# Install backend observability packages
cd backend
npm install

cd ../frontend
npm install

cd ..
```

### Step 2: Configure Environment Variables

Create/update `.env` files with observability settings:

**`backend/.env`**:
```env
# Existing variables...
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318
ALERT_EMAIL_RECIPIENTS=your-email@example.com
```

**`backend/.env.test`**:
```env
# No observability in tests
OTEL_EXPORTER_OTLP_ENDPOINT=
```

### Step 3: Start Local Dev Stack

```bash
# Start everything with observability
docker-compose up -d

# Wait for services to be healthy
docker-compose ps

# Verify services are running
sleep 30

# Check logs
docker-compose logs -f backend
```

### Step 4: Access Dashboard UIs

| Service | URL | Default Credentials |
|---------|-----|-------------------|
| **Grafana** | http://localhost:3001 | admin/admin |
| **Prometheus** | http://localhost:9090 | N/A (no auth) |
| **Jaeger** | http://localhost:16686 | N/A (no auth) |
| **Loki** | http://localhost:3100 | N/A (API only) |
| **Your App** | http://localhost:3000 | - |
| **API** | http://localhost:4000 | - |
| **Metrics** | http://localhost:4000/api/metrics | N/A |

### Step 5: Test Observability

```bash
# 1. Generate some traffic to API
for i in {1..100}; do
  curl -s http://localhost:4000/api/health > /dev/null
done

# 2. Access Grafana
# - Wait 1 minute for metrics to be scraped
# - Go to http://localhost:3001
# - Check "NexClass API Metrics" dashboard
# - You should see request rates and response times

# 3. Check Prometheus
# - Go to http://localhost:9090
# - Query: "http_requests_total" or "http_request_duration_seconds"
# - Check graph to see metrics

# 4. Check Jaeger traces
# - Go to http://localhost:16686
# - Service: "nexclass-api"
# - You should see distributed traces

# 5. View logs in Loki
# - Go to Grafana > Explore
# - Select "Loki" datasource
# - Query: {job="docker"}
# - You should see all container logs
```

---

## Part 2: AWS Production Setup

### Prerequisites
- AWS Free Tier account active
- t2.micro or t3.micro EC2 instance already running
- Domain name pointed to EC2
- RDS PostgreSQL database running

### Step 1: Prepare Docker Images

**On your local machine:**

```bash
# Build and push images (replace yourdockerusername with your Docker Hub username)
docker build -t yourdockerusername/nexclass-backend:latest ./backend
docker build -t yourdockerusername/nexclass-frontend:latest ./frontend

docker push yourdockerusername/nexclass-backend:latest
docker push yourdockerusername/nexclass-frontend:latest
```

### Step 2: Configure AWS EC2 (t2.micro)

**SSH into your EC2 instance:**

```bash
ssh -i your-key.pem ubuntu@your-ec2-ip

# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Create 3GB swap file (CRITICAL for observability stack)
sudo fallocate -l 3G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make swap persistent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Verify swap
free -h

# Install Docker & Docker Compose (if not already done)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
rm get-docker.sh

sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add ubuntu to docker group
sudo usermod -aG docker ubuntu
newgrp docker
```

### Step 3: Clone and Configure NexClass

```bash
cd /home/ubuntu

# Clone repository (or sync from your version control)
git clone https://github.com/your-org/nexclass.git
cd nexclass

# Create production environment file
cat > .env << 'EOF'
NODE_ENV=production
PORT=4000

# Database (RDS endpoint)
DATABASE_URL=postgresql://nexclass:PASSWORD@your-rds-endpoint:5432/nexclass?sslmode=require

# JWT Secrets (generate new ones!)
JWT_ACCESS_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Redis (Upstash)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=NexClass <your-email@gmail.com>

# Cloudinary
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Groq API
GROQ_API_KEY=...

# Frontend URL
FRONTEND_URL=https://app.yourdomain.com

# Observability
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318
ALERT_EMAIL_RECIPIENTS=your-admin-email@gmail.com
GRAFANA_PASSWORD=your-secure-password
GRAFANA_URL=https://grafana.yourdomain.com

# Docker Registry
DOCKER_REGISTRY=yourdockerusername
IMAGE_TAG=latest
EOF

chmod 600 .env
```

### Step 4: Deploy with Docker Compose (Prod)

```bash
# Verify Docker images are pulled correctly
docker pull yourdockerusername/nexclass-backend:latest
docker pull yourdockerusername/nexclass-frontend:latest

# Start production stack
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to start
sleep 30

# Check status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f backend

# Verify metrics endpoint
curl http://localhost:4000/api/metrics | head -20
```

### Step 5: Configure Nginx Reverse Proxy (Already done from deployment guide, but add Grafana)

```bash
# Edit Nginx config
sudo nano /etc/nginx/sites-available/nexclass
```

Add these server blocks:

```nginx
# Grafana
server {
    listen 80;
    server_name grafana.yourdomain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Prometheus (optional, internal only)
server {
    listen 80;
    server_name prometheus.yourdomain.com;
    # Add authentication if exposing publicly
    location / {
        proxy_pass http://localhost:9090;
    }
}

# Jaeger UI
server {
    listen 80;
    server_name jaeger.yourdomain.com;

    location / {
        proxy_pass http://localhost:16686;
    }
}
```

```bash
# Test and reload Nginx
sudo nginx -t
sudo systemctl reload nginx

# Update SSL certificates to include new domains
sudo certbot --nginx -d app.yourdomain.com -d api.yourdomain.com -d grafana.yourdomain.com -d jaeger.yourdomain.com
```

### Step 6: Configure Email Alerts in Grafana

1. Go to https://grafana.yourdomain.com
2. Login: admin / your-secure-password
3. Go to **Administration → Alerting → Contact Points**
4. Add new contact point:
   - Name: "Email Alert"
   - Type: "Email"
   - Email address: your-admin-email@gmail.com
5. Go to **Alerting → Notification Policies**
6. Set default receiver to "Email Alert"

### Step 7: Configure Alert Rules in Grafana UI

1. Go to **Alerting → Alert Rules**
2. Create new alert rule:

**Example: High Error Rate Alert**

```
Condition: 
  A: $A > B (error_rate > 5%)
  
Query A:
  Metric: http_errors_total
  Legend: {{ route }}
  
Evaluate every: 5 minutes
For: 2 minutes
```

---

## Part 3: Monitoring Checklist

### Daily Monitoring Tasks

Each day, check these in Grafana:

```
□ Request Rate: Should be > 0 during business hours
□ Error Rate: Should be < 1%
□ Response Time (p95): Should be < 500ms
□ Active Connections: Should be < 50
□ Database Query Duration: Should be < 100ms (p95)
□ External API Calls: Should be < 5s (p95)
```

### Weekly Review

```
□ Check storage usage: Prometheus, Loki, Grafana
  - Prometheus should use <10GB for 7-day retention
  - Loki should use <5GB for 7-day retention

□ Review alert patterns:
  - Any recurring alerts?
  - Any missing alerts?

□ Check error logs in Loki:
  - Any new error patterns?
  - Any spikes in specific error types?

□ Review distributed traces in Jaeger:
  - Any slow endpoints?
  - Any error traces?
```

### Monthly Maintenance

```
□ Clean up old dashboards
□ Review and update alert thresholds
□ Check disk space on EC2
  - df -h
  - du -sh /docker  (if using Docker data volumes)
□ Backup Grafana dashboards:
  docker exec nexclass-grafana grafana-cli admin export-dashboard filename
□ Rotate passwords (if applicable)
□ Review cost in AWS Free Tier dashboard
```

---

## Part 4: Troubleshooting

### Issue: Services won't start

```bash
# Check logs
docker-compose logs backend
docker-compose logs prometheus
docker-compose logs jaeger

# Check disk space
df -h

# Check memory usage
free -h

# Increase swap if needed
sudo swapoff /swapfile
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### Issue: Metrics not showing in Prometheus

```bash
# Check if backend is exporting metrics
curl http://localhost:4000/api/metrics

# Check Prometheus targets
# Go to http://localhost:9090/targets
# Look for "nexclass-api" target
# Status should be "UP"

# If DOWN, check backend logs:
docker-compose logs backend
```

### Issue: Alerts not sending emails

```bash
# Check Alertmanager config
docker exec nexclass-alertmanager cat /etc/alertmanager/alertmanager.yml

# Check Gmail app password:
# 1. Go to Google Account: myaccount.google.com
# 2. Security tab
# 3. App passwords
# 4. Use the 16-char password in SMTP_PASS

# Test SMTP directly from EC2:
echo "test" | swaks --to your-email@gmail.com --from noreply@yourdomain.com --server smtp.gmail.com:465 --tls --auth LOGIN --auth-user your-email@gmail.com --auth-password "your-app-password"
```

### Issue: Out of disk space

```bash
# Check what's using space
du -sh /var/lib/docker/*

# Clean up Docker resources
docker system prune -a -f

# Remove old docker compose volumes
docker volume prune

# Delete old logs
docker-compose logs --tail=0 > /dev/null
```

---

## Part 5: Advanced Configuration

### Reducing Memory Usage

If still hitting memory limits:

**Prometheus** (reduce retention):
```yaml
# In prometheus.yml
command:
  - '--storage.tsdb.retention.time=3d'  # Reduce from 7d
  - '--storage.tsdb.max-block-duration=1h'
```

**Jaeger** (reduce trace retention):
```yaml
environment:
  MEMORY_MAX_TRACES: '1000'  # Reduce from 3000
```

**Grafana** (reduce cache):
```yaml
environment:
  GF_INSTALL_PLUGINS: ''  # Don't install plugins
```

### Backup Alerting Setup

If email alerting fails, setup Slack as backup:

1. Create Slack webhook: https://api.slack.com/apps
2. Go to **Alertmanager → Contact Points**
3. Add new Slack contact point:
   - Webhook URL: (from Slack)

---

## Part 6: Cleanup & Costs

### AWS Free Tier Estimates

- **EC2 t2.micro**: FREE (750 hours/month)
- **RDS db.t3.micro**: FREE (750 hours/month)
- **Storage**: ~10GB (free tier includes 30GB/month free)
- **Data Transfer**: ~5GB/month domestic (15GB/month free)
- **ObservabilityStack**: Runs on EC2, no extra cost

**Total Monthly Cost**: **~$0** (if within free tier)

Once you exceed free tier limits:
- EC2: ~$10/month
- RDS: ~$11/month
- Storage: ~$0.10/GB
- Data transfer: ~$0.09/GB (outbound)

### Cleanup Commands

```bash
# Stop all services
docker-compose -f docker-compose.prod.yml down

# Remove volumes (data WILL be deleted)
docker-compose -f docker-compose.prod.yml down -v

# Remove images
docker rmi yourdockerusername/nexclass-backend:latest
docker rmi yourdockerusername/nexclass-frontend:latest
```

---

## Next Steps

1. ✅ Complete local dev setup and test
2. ✅ Deploy to AWS EC2 with observability
3. ✅ Configure email alerts
4. ✅ Create custom Grafana dashboards for your use case
5. ✅ Setup monitoring alerts for critical metrics
6. ✅ Train team on using Grafana
7. ✅ Schedule monthly maintenance tasks

---

## Support

For issues:
- Check Docker logs: `docker-compose logs -f <service-name>`
- Check Grafana alerts: https://grafana.yourdomain.com/alerting
- Check Prometheus targets: http://prometheus:9090/targets
- Check Jaeger traces: http://jaeger:16686


