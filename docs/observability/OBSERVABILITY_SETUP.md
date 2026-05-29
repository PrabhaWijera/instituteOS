# NexClass Observability Setup Guide

## Overview

This guide walks you through setting up the **production-grade observability stack** for NexClass with:
- **Prometheus** - Metrics collection and storage
- **Loki** - Log aggregation
- **Jaeger** - Distributed tracing
- **Grafana** - Unified dashboards and alerting
- **AlertManager** - Alert routing and email notifications

**Architecture**: All components run in Docker containers for easy deployment on AWS EC2.

---

## Quick Start (Local Development)

### 1. Start Services with Docker Compose

```bash
# Navigate to project root
cd /path/to/nexclass

# Start all services including observability stack
docker-compose up -d

# Wait for services to be healthy
docker-compose ps
```

### 2. Access Dashboards

- **Grafana**: http://localhost:3001 (admin / admin)
- **Prometheus**: http://localhost:9090
- **Jaeger**: http://localhost:16686
- **Loki**: http://localhost:3100
- **API Metrics**: http://localhost:4000/metrics

### 3. Verify Metrics Collection

```bash
# Check if backend is sending metrics to Prometheus
curl http://localhost:4000/metrics | head -20

# Check Prometheus targets
curl http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {labels}'
```

### 4. Set Environment Variables

Create or update a `.env` file in the project root:

```env
# Email/Alerting Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=alerts@nexclass.com
ALERT_EMAIL_RECIPIENTS=your-email@gmail.com,admin@gmail.com

# OpenTelemetry
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318

# Grafana (development)
GRAFANA_PASSWORD=admin
GRAFANA_URL=http://localhost:3001

# Application
ENVIRONMENT=development
NODE_ENV=development
```

### 5. Gmail SMTP Configuration (Recommended for Testing)

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable 2-Factor Authentication
3. Generate an **App Password** (not your regular password)
4. Use this in `.env` as `SMTP_PASS`

**Alternative**: Use SendGrid (free tier, 100 emails/day)
- Sign up at sendgrid.com
- Create API key
- SMTP_HOST: smtp.sendgrid.net
- SMTP_USER: apikey
- SMTP_PASS: your-sendgrid-api-key

---

## AWS Production Deployment

## Prerequisites

- AWS Account with Free Tier access
- EC2 instance (t2.micro or t3.micro recommended)
- Security Group with ports open: 22 (SSH), 80 (HTTP), 443 (HTTPS), 4000 (API)

## Step 1: Launch EC2 Instance

```bash
# AWS Console: EC2 > Launch Instances

# Configuration:
# - AMI: Ubuntu 22.04 LTS (Free Tier eligible)
# - Instance Type: t2.micro (Free Tier)
# - Storage: 20GB (Free Tier includes 20GB)
# - Security Group: Allow 22 (SSH), 80, 443, 3001 (Grafana)
# - Key Pair: Create or use existing (save .pem file)
```

## Step 2: Install Docker & Dependencies

```bash
# SSH into your instance
ssh -i your-key.pem ubuntu@your-instance-ip

# Update system
sudo apt-get update
sudo apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose
sudo apt-get install -y docker-compose

# Verify installation
docker --version
docker-compose --version
```

## Step 3: Clone and Configure NexClass

```bash
# Clone repository
git clone https://github.com/yourusername/nexclass.git
cd nexclass

# Create .env file with your AWS configuration
cat > .env << 'EOF'
# Amazon SES SMTP Configuration
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=your-ses-smtp-username
SMTP_PASS=your-ses-smtp-password
EMAIL_FROM=noreply@yourdomain.com
ALERT_EMAIL_RECIPIENTS=admin@yourdomain.com

# Database
DATABASE_URL=postgresql://nexclass:nexclass_secure@postgres:5432/nexclass
REDIS_URL=redis://redis:6379

# JWT Secrets (CHANGE THESE!)
JWT_ACCESS_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Groq API
GROQ_API_KEY=your-groq-api-key

# Grafana
GRAFANA_PASSWORD=$(openssl rand -base64 12)
GRAFANA_URL=https://monitoring.yourdomain.com

# Environment
ENVIRONMENT=production
NODE_ENV=production
EOF

# Load environment variables
export $(cat .env | xargs)
```

## Step 4: Configure Amazon SES (Email Alerts)

Amazon SES provides free email sending (first 200 emails/day).

### Enable SES in AWS Console:

1. Go to **AWS SES Console** (Simple Email Service)
2. Switch to **us-east-1** region (free tier supported)
3. **Verify Email Address**:
   - Click "Verified Identities" > "Create Identity"
   - Choose "Email address"
   - Enter your email
   - Verify via link sent to your inbox

### Get SMTP Credentials:

```bash
# In AWS SES Console:
# 1. Click "SMTP Settings"
# 2. Click "Create SMTP Credentials"
# 3. Create IAM user (or use existing)
# 4. Copy: SMTP Username and SMTP Password
# 5. Use these in .env as SMTP_USER and SMTP_PASS
```

## Step 5: Configure Nginx Reverse Proxy (Optional but Recommended)

```bash
# Install Nginx
sudo apt-get install -y nginx certbot python3-certbot-nginx

# Create Nginx config
sudo tee /etc/nginx/sites-available/nexclass > /dev/null << 'EOF'
upstream nexclass_api {
    server localhost:4000;
}

upstream nexclass_frontend {
    server localhost:3000;
}

upstream grafana_ui {
    server localhost:3001;
}

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL certificates (after certbot)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Location: API
    location /api {
        proxy_pass http://nexclass_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Location: WebSocket
    location /ws {
        proxy_pass http://nexclass_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # Location: Frontend
    location / {
        proxy_pass http://nexclass_frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Location: Grafana (monitoring.yourdomain.com)
    location /monitoring {
        proxy_pass http://grafana_ui;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/nexclass /etc/nginx/sites-enabled/

# Test config
sudo nginx -t

# Get SSL certificate
sudo certbot certonly --nginx -d yourdomain.com -d www.yourdomain.com

# Reload Nginx
sudo systemctl reload nginx
```

## Step 6: Start Services with Production Compose

```bash
# Use production docker-compose
docker-compose -f docker-compose.prod.yml up -d

# Verify all services are running
docker-compose ps

# Check logs
docker-compose logs -f backend
docker-compose logs -f prometheus
docker-compose logs -f grafana
```

### Expected Output:

```
├── backend ✅ (Up, healthy)
├── frontend ✅ (Up)
├── postgres ✅ (Up, healthy)
├── prometheus ✅ (Up)
├── loki ✅ (Up)
├── jaeger ✅ (Up)
├── grafana ✅ (Up)
└── alertmanager ✅ (Up)
```

## Step 7: Configure Grafana

1. **Access Grafana**: https://yourdomain.com/monitoring
2. **Login**: admin / (your GRAFANA_PASSWORD from .env)
3. **Add Alert Contact**:
   - Settings > Notification channels > New channel
   - Type: Email
   - Email address: your-email@gmail.com
   - Save & Test
4. **Import Dashboards**:
   - Dashboards > Import
   - Upload JSON files from `observability/grafana/provisioning/dashboards/`
5. **Create Alerts**:
   - Choose alerts from `observability/alert-rules.yml`
   - Set notification channel to Email

## Step 8: Verify Alert Flow

```bash
# Test email alert by triggering a metric:
docker exec nexclass-prometheus curl -X POST http://alertmanager:9093/api/v1/alerts -H 'Content-Type: application/json' -d '[{"labels":{"alertname":"TestAlert","severity":"warning"}}]'

# Check AlertManager
curl http://localhost:9093/api/v1/alerts
```

---

## Monitoring Checklist

### First Day Setup

- [ ] Prometheus scraping metrics (http://prometheus:9090/targets)
- [ ] Loki receiving logs
- [ ] Jaeger tracing enabled in backend
- [ ] Grafana dashboards loading with data
- [ ] Email alerts sent and received
- [ ] Database connection pool monitored
- [ ] API latency tracked (p95, p99)

### Weekly Tasks

- [ ] Review alert frequency (too many false positives?)
- [ ] Verify log retention (7 days default)
- [ ] Check backup storage usage
- [ ] Review slow query logs

### Monthly Tasks

- [ ] Audit alert rules effectiveness
- [ ] Update Prometheus retention policy if needed
- [ ] Review and optimize dashboard queries
- [ ] Capacity planning (disk, memory, CPU)

---

## Troubleshooting

### Alert Emails Not Sending

```bash
# Check AlertManager logs
docker-compose logs alertmanager

# Verify SMTP config in alertmanager.yml
# Common issues:
# - SMTP_PASSWORD contains special characters (URL-encode them)
# - TLS port (587) vs SMTPS port (465) mismatch
# - Firewall blocking outbound SMTP

# test with telnet
sudo apt-get install -y telnet
telnet smtp.gmail.com 587
```

### Metrics Not Showing in Prometheus

```bash
# Check if backend is exposing metrics
curl http://localhost:4000/metrics

# Check Prometheus targets
curl http://localhost:9090/api/v1/targets | jq '.data.activeTargets'

# Look for errors in Prometheus logs
docker-compose logs prometheus
```

### High Memory Usage

```bash
# Reduce Prometheus retention
# In docker-compose.prod.yml, reduce:
# --storage.tsdb.retention.time=7d  # to 3d

# Reduce Loki retention
# In loki-config.yml:
# retention_period: 72h  # Reduce from 168h

# Restart containers
docker-compose restart prometheus loki
```

### SSL Certificate Issues

```bash
# Renew Let's Encrypt certificate
sudo certbot renew --dry-run

# Manual renewal
sudo certbot renew

# Auto-renewal already setup
sudo systemctl status certbot.timer
```

---

## Cost Optimization for AWS Free Tier

| Service | Free Tier Limit | NexClass Est. | Notes |
|---------|-----------------|---------------|-------|
| **EC2 t2.micro** | 750 hrs/month | 24/7 usage | Free for 12 months |
| **RDS (if used)** | 750 hrs + 20GB | Not used | We use containerized Postgres |
| **S3 Backups** | 5GB | ~100MB/month | Backup scripts here |
| **SES Email** | 62,000/month | <1,000 | Alerting emails |
| **CloudWatch** | 10GB logs/month | ~5GB | Covered by free tier |
| **Total Cost** | **$0** (Year 1) | **$0** | Subsequent years: ~$20-30/month |

---

## Auto-Scaling (Beyond Free Tier)

For production with >1,000 concurrent users:

```yaml
# Auto Scaling Group
AutoScalingGroup:
  MinSize: 2
  MaxSize: 5
  DesiredCapacity: 2
  HealthCheckType: ELB
  HealthCheckGracePeriod: 300
  
# Load Balancer
LoadBalancer:
  Type: Application (ALB)
  TargetGroup:
    HealthCheckPath: /api/health
    HealthCheckInterval: 30s
```

---

## Next Steps

1. **Implement Circuit Breakers**: Graceful handling of external API failures
2. **Add Request Tracing**: Distributed tracing across services
3. **Implement Caching**: Redis caching for frequently accessed data
4. **Database Optimization**: Query indexing and optimization
5. **Rate Limiting**: Per-user rate limiting (currently IP-based)

---

## Support & Documentation

- **Prometheus Docs**: https://prometheus.io/docs
- **Grafana Docs**: https://grafana.com/docs
- **Loki Docs**: https://grafana.com/docs/loki
- **Jaeger Docs**: https://www.jaegertracing.io/docs
- **AWS SES**: https://docs.aws.amazon.com/ses/

---

## Quick Reference Commands

```bash
# View all container logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs prometheus

# Restart services
docker-compose restart

# Stop all services
docker-compose down

# Update containers
docker-compose pull
docker-compose up -d

# Database operations
docker-compose exec postgres psql -U nexclass -d nexclass

# Backup database
docker-compose exec postgres pg_dump -U nexclass nexclass > backup-$(date +%Y%m%d).sql

# Database migration
docker-compose exec backend npm run db:migrate:prod

# View metrics endpoint
curl http://localhost:4000/metrics | grep nexclass_http_requests_total

# Check Prometheus config
curl http://localhost:9090/api/v1/status/config
```

---

**Last Updated**: 2026-05-26  
**Version**: 1.0.0  
**Maintainer**: NexClass DevOps Team

