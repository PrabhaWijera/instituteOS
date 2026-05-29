
# AWS Free Tier Deployment - Observability Stack

## Quick Start (30 minutes)

### 1. On Your Local Machine: Build & Push Images

```bash
# Make sure you're in root of nexclass repo
cd ~/nexclass

# Create Docker Hub account if needed
# Then login:
docker login

# Build images
docker build -t yourusername/nexclass-backend:latest ./backend
docker build -t yourusername/nexclass-frontend:latest ./frontend

# Push to Docker Hub
docker push yourusername/nexclass-backend:latest
docker push yourusername/nexclass-frontend:latest
```

### 2. SSH to EC2 & Setup Observability

```bash
ssh -i your-key.pem ubuntu@your-ec2-ip

# Create necessary directories
mkdir -p ~/nexclass/observability/grafana/provisioning/{dashboards,datasources}

# Copy observability configs from your local machine:
# (Run these from your LOCAL machine, not SSH)
scp -i your-key.pem -r observability/* ubuntu@your-ec2-ip:~/nexclass/observability/

# Back on EC2:
ssh -i your-key.pem ubuntu@your-ec2-ip

cd ~/nexclass

# Create main .env file with all secrets
cat > .env << 'EOF'
NODE_ENV=production
PORT=4000

# REPLACE THESE WITH YOUR ACTUAL VALUES:
DATABASE_URL=postgresql://nexclass:YOUR_RDS_PASSWORD@your-rds-endpoint.rds.amazonaws.com:5432/nexclass?sslmode=require
JWT_ACCESS_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)

UPSTASH_REDIS_REST_URL=https://your-upstash-url
UPSTASH_REDIS_REST_TOKEN=your-token

SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-gmail-app-password
EMAIL_FROM=NexClass <noreply@yourdomain.com>

CLOUDINARY_CLOUD_NAME=your-cloud
CLOUDINARY_API_KEY=your-key
CLOUDINARY_API_SECRET=your-secret

GROQ_API_KEY=your-groq-key

FRONTEND_URL=https://app.yourdomain.com
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318
ALERT_EMAIL_RECIPIENTS=your-email@gmail.com
GRAFANA_PASSWORD=set-secure-password
GRAFANA_URL=https://grafana.yourdomain.com

DOCKER_REGISTRY=yourusername
IMAGE_TAG=latest
EOF

# 3GB is critical - add swap if not already done
sudo fallocate -l 3G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile

# Start everything
docker-compose -f docker-compose.prod.yml up -d

# Wait 60 seconds for all services
sleep 60

# Check status
docker-compose -f docker-compose.prod.yml ps

# Verify API is working
curl http://localhost:4000/api/health

# Verify metrics endpoint
curl http://localhost:4000/api/metrics | head -20
```

### 3. Configure Nginx & SSL

```bash
# SSH to EC2 if not already
ssh -i your-key.pem ubuntu@your-ec2-ip

# Create Nginx config
sudo tee /etc/nginx/sites-available/nexclass > /dev/null << 'EOF'
# Frontend
server {
    listen 80;
    server_name app.yourdomain.com;
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Backend API
server {
    listen 80;
    server_name api.yourdomain.com;
    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Grafana Dashboard
server {
    listen 80;
    server_name grafana.yourdomain.com;
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}

# Jaeger Tracing
server {
    listen 80;
    server_name jaeger.yourdomain.com;
    location / {
        proxy_pass http://localhost:16686;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}

# Prometheus (internal only - add IP restrictions in production)
server {
    listen 80;
    server_name prometheus.yourdomain.com;
    location / {
        proxy_pass http://localhost:9090;
    }
}
EOF

# Enable site
sudo ln -sf /etc/nginx/sites-available/nexclass /etc/nginx/sites-enabled/nexclass

# Remove default site if exists
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx config
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# Setup SSL with Let's Encrypt (requires DNS to be pointing to EC2 IP)
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d app.yourdomain.com -d api.yourdomain.com -d grafana.yourdomain.com -d jaeger.yourdomain.com -d prometheus.yourdomain.com

# Enable auto-renewal
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

### 4. Access Your Services

Open in browser:
- **App**: https://app.yourdomain.com
- **API**: https://api.yourdomain.com/api/health
- **Grafana**: https://grafana.yourdomain.com (admin/your-password)
- **Jaeger**: https://jaeger.yourdomain.com
- **Prometheus**: https://prometheus.yourdomain.com (internal)

### 5. Configure Grafana Alerts

1. Login to Grafana: https://grafana.yourdomain.com
2. Go to **Administration → Alerting → Contact Points**
3. Create new contact point:
   - Name: `email-alerts`
   - Type: `Email`
   - Email addresses: your-email@gmail.com
4. Go to **Alerting → Notification policies**
5. Set default receiver to `email-alerts`

### 6. Test Email Alerts

Generate traffic to trigger alert:

```bash
# SSH to EC2
ssh -i your-key.pem ubuntu@your-ec2-ip

# Generate lots of requests to API (this will cause errors)
for i in {1..1000}; do
  curl -s http://localhost:4000/api/v1/fake-endpoint 2>/dev/null &
done

# Wait a few minutes
# You should receive an email alert about high error rate
```

---

## Monitoring Dashboards

After setup, create these custom dashboards in Grafana:

### Dashboard 1: System Health
- CPU usage
- Memory usage  
- Disk usage
- Network I/O

### Dashboard 2: API Performance
- Request rate
- Response time (p50, p95, p99)
- Error rate
- Active connections

### Dashboard 3: Database
- Query duration
- Query errors
- Connection pool
- Slow queries

### Dashboard 4: External Services
- Groq API latency
- Cloudinary upload time
- Redis latency
- SMTP send time

### Dashboard 5: Application Events
- Authentication failures
- Payment failures
- Attendance sessions
- User registrations

---

## Monitoring Commands

Once everything is running:

```bash
# Check all services are running
docker-compose -f docker-compose.prod.yml ps

# View backend logs
docker-compose -f docker-compose.prod.yml logs -f backend --tail=50

# View Prometheus metrics scraping
curl http://localhost:9090/api/v1/targets/metadata | jq .

# View current memory usage
docker stats

# Check storage usage
du -sh ~/nexclass/*
```

---

## Email Alert Troubleshooting

If emails not sending:

```bash
# Check Alertmanager logs
docker-compose -f docker-compose.prod.yml logs alertmanager | tail -20

# Test SMTP connection:
# 1. Ensure SMTP_PASS is "app specific password" from Google
#    (not your regular Gmail password)
# 2. Check that 2-factor authentication is enabled
# 3. Generate new app password at: accounts.google.com/AppPasswords

# Manually trigger alert test:
# Go to Grafana → Alerting → Alert Rules
# Find alert rule → Click "Edit" → "Test rule"
```

---

## Key Metrics to Monitor

**Daily Check**:
```
Request Rate: Should be active during business hours
Error Rate: Should be < 1% (0-5% is warning)
Response Time: p95 should be < 500ms
Database Queries: p95 should be < 100ms
Active Connections: Should be < 50
```

**Weekly Check**:
```
Storage usage (Prometheus, Loki)
Backup status
Alert patterns
Error distribution
Slow endpoint analysis
```

**Monthly Check**:
```
AWS Free Tier usage (stay under limits!)
Security vulnerabilities in dependencies
Performance regression (compare to previous month)
Cost optimization opportunities
```

---

## Emergency Runbook

### If API is Down

```bash
ssh -i your-key.pem ubuntu@your-ec2-ip
docker-compose -f docker-compose.prod.yml logs backend --tail=100 | grep -i error
docker-compose -f docker-compose.prod.yml restart backend
```

### If Disk is Full

```bash
df -h
docker system prune -a -f
docker volume prune
# If still full, check EC2 instance storage > delete old backups
```

### If Memory Limited

```bash
free -h
docker stats
# Increase swap: sudo fallocate -l 4G /swapfile && sudo swapon /swapfile
```

### If Database Connection Fails

```bash
docker-compose -f docker-compose.prod.yml logs backend | grep -i postgres
# Check RDS security group allows EC2 access
# Verify DATABASE_URL is correct in .env
docker-compose -f docker-compose.prod.yml exec backend psql $DATABASE_URL -c "SELECT version();"
```

---

## Cost Monitoring

**Stay within AWS Free Tier**:

```bash
# Login to AWS Console
# Go to: Billing → Cost Explorer
# Set filters:
#   - Service: EC2, RDS, Data Transfer
#   - Date range: This month
# Should show ~$0 if within free tier
```

If approaching limits:
1. Reduce Prometheus retention to 3 days
2. Reduce Jaeger trace retention
3. Enable CloudFront for static assets
4. Optimize RDS instance class

---

## Useful Commands

```bash
# Show real-time metrics
docker-compose -f docker-compose.prod.yml exec backend curl http://localhost:4000/api/metrics | grep http_requests_total

# List all Prometheus targets
curl http://localhost:9090/api/v1/targets | jq

# Delete all alert history (to trigger fresh alert)
curl -X DELETE http://localhost:9093/api/v1/alerts

# Scale database connections (check RDS parameter group)
# Max connections = 20 * DBInstanceClassMemory(bytes) / 9531392

# Backup Grafana dashboards
docker-compose -f docker-compose.prod.yml exec grafana grafana-cli admin export-dashboard uid

# Check Jaeger traces for specific service
curl http://localhost:16686/api/traces?service=nexclass-api | jq
```


