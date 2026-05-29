# Observability Stack Implementation Checklist

## ✅ What's Been Implemented

### Backend Code Changes
- ✅ Added OpenTelemetry tracing initialization (`src/config/tracing.ts`)
- ✅ Added Prometheus metrics (`src/config/metrics.ts`)
- ✅ Added email alerting service (`src/config/email-alerts.ts`)
- ✅ Updated `app.ts` to include metrics middleware and `/api/metrics` endpoint
- ✅ Updated `server.ts` to initialize tracing before other imports
- ✅ Updated `env.ts` to validate observability environment variables
- ✅ Updated `package.json` with all required dependencies:
  - OpenTelemetry SDK and instrumentations
  - Prometheus client
  - Email sending packages

### Configuration Files
- ✅ `observability/prometheus.yml` - Prometheus scrape configuration
- ✅ `observability/alert-rules.yml` - 15+ production-ready alert rules
- ✅ `observability/loki-config.yml` - Loki log aggregation config
- ✅ `observability/alertmanager.yml` - Email alert routing (supports templates)
- ✅ `observability/grafana/provisioning/datasources/datasources.yml` - Grafana data sources
- ✅ `observability/grafana/provisioning/dashboards/dashboards.yml` - Dashboard provisioning
- ✅ `observability/grafana/provisioning/dashboards/nexclass-api.json` - API metrics dashboard
- ✅ `observability/grafana/provisioning/dashboards/nexclass-logs-traces.json` - Logs & traces dashboard

### Docker Compose Files
- ✅ `docker-compose.yml` - Updated for local dev with full observability stack
- ✅ `docker-compose.prod.yml` - Production setup optimized for t2.micro + free tier
- ✅ Both include: Prometheus, Loki, Jaeger, Grafana, Alertmanager

### Documentation
- ✅ `observability/SETUP_GUIDE.md` - Complete 200+ line setup guide
- ✅ `AWS_QUICK_START.md` - 30-minute AWS deployment guide
- ✅ `backend/.env.example` - Example environment variables with observability configs
- ✅ This checklist

---

## 📋 Next Steps (For You to Complete)

### Phase 1: Local Testing (30 minutes)

```bash
# Step 1: Install dependencies
cd backend
npm install
cd ..

# Step 2: Start local dev stack
docker-compose up -d

# Step 3: Wait for services
sleep 30

# Step 4: Verify services are running
docker-compose ps

# Step 5: Generate traffic to create metrics
for i in {1..100}; do
  curl -s http://localhost:4000/api/health
done

# Step 6: Access dashboards
# - Grafana: http://localhost:3001 (admin/admin)
# - Prometheus: http://localhost:9090
# - Jaeger: http://localhost:16686
# - Logs in Grafana: Explore > Loki > {job="docker"}
```

**Success Criteria**:
- [ ] All Docker services running (`docker-compose ps`)
- [ ] Backend accessible: `curl http://localhost:4000/api/health`
- [ ] Metrics endpoint working: `curl http://localhost:4000/api/metrics | head`
- [ ] Can see metrics in Prometheus: http://localhost:9090 (query: `http_requests_total`)
- [ ] Can see dashboards in Grafana: http://localhost:3001

---

### Phase 2: Environment Configuration (15 minutes)

**Update these files with YOUR values:**

1. **`backend/.env`** - Create if doesn't exist:
   ```bash
   cp backend/.env.example backend/.env
   nano backend/.env
   # Update:
   # - DATABASE_URL (point to your RDS if prod)
   # - SMTP_HOST, SMTP_USER, SMTP_PASS (Gmail)
   # - CLOUDINARY_, GROQ_, UPSTASH_ credentials
   # - ALERT_EMAIL_RECIPIENTS (your email)
   # - OTEL_EXPORTER_OTLP_ENDPOINT (leave as http://jaeger:4318 for local)
   ```

2. **`observability/alertmanager.yml`** - Update email config:
   ```bash
   nano observability/alertmanager.yml
   # The following env variables MUST be set in your .env:
   # ${ALERT_EMAIL_RECIPIENTS} - List of emails to receive alerts
   # ${SMTP_HOST}, ${SMTP_PORT}, ${SMTP_USER}, ${SMTP_PASS}
   # ${EMAIL_FROM}
   ```

3. **For Production (AWS)**:
   ```bash
   # Copy observability folder to EC2:
   scp -r observability/* ubuntu@your-ec2:/home/ubuntu/nexclass/observability/
   
   # Create production .env on EC2 with all secrets:
   scp .env ubuntu@your-ec2:/home/ubuntu/nexclass/.env
   ```

**Checklist**:
- [ ] `backend/.env` created with all required values
- [ ] SMTP credentials configured (Gmail recommended)
- [ ] ALERT_EMAIL_RECIPIENTS set to your email(s)
- [ ] All secrets stored securely (never commit `.env` files!)

---

### Phase 3: AWS Production Deployment (1-2 hours)

**Follow `AWS_QUICK_START.md` step by step:**

1. **Build & Push Docker Images** (5 min)
   ```bash
   docker build -t yourusername/nexclass-backend:latest ./backend
   docker build -t yourusername/nexclass-frontend:latest ./frontend
   docker push yourusername/nexclass-backend:latest
   docker push yourusername/nexclass-frontend:latest
   ```

2. **Setup EC2 Observability** (15 min)
   - SSH to EC2
   - Create 3GB swap file (CRITICAL!)
   - Copy observability configs
   - Create production `.env` with secrets

3. **Deploy with Docker Compose** (10 min)
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

4. **Configure Nginx** (10 min)
   - Add Grafana, Jaeger, Prometheus domains
   - Get SSL certificates with Let's Encrypt

5. **Setup Grafana Email Alerts** (10 min)
   - Login: grafana.yourdomain.com
   - Create contact point (email)
   - Test alert

**Checklist**:
- [ ] Docker images built and pushed to registry
- [ ] EC2 has 3GB swap memory
- [ ] All services running: `docker-compose -f docker-compose.prod.yml ps`
- [ ] Can access: app.yourdomain.com, api.yourdomain.com, grafana.yourdomain.com
- [ ] SSL certificates installed (HTTPS working)
- [ ] Email alerts configured
- [ ] Test alert sent successfully to your email

---

### Phase 4: Monitoring Configuration (30 minutes)

1. **Create Custom Dashboards in Grafana**:
   - Login: https://grafana.yourdomain.com
   - Go to Dashboards > New Dashboard
   - Add panels for:
     - Request rate
     - Error rate
     - Response times (p50, p95, p99)
     - Database query duration
     - Active connections
     - Disk usage
     - Maybe rate

2. **Create Alert Rules**:
   - Go to Alerting > Alert Rules > New Alert Rule
   - Create alerts for:
     - High error rate (> 5%)
     - High response time (p95 > 1s)
     - Service down (health check fails)
     - High CPU usage (> 80%)
     - High memory usage (> 85%)
     - Database connection errors

3. **Setup Alert Notification Policy**:
   - Go to Alerting > Notification Policies
   - Route alerts to your email contact point
   - Set routing rules by severity

**Checklist**:
- [ ] At least 1 custom dashboard created
- [ ] At least 3 alert rules created
- [ ] Email notification policy configured
- [ ] Received test alert email

---

### Phase 5: Monitoring & Maintenance (Ongoing)

**Daily** (2 min):
- [ ] Check Grafana dashboards for anomalies
- [ ] Review alert emails

**Weekly** (30 min):
- [ ] Review error logs in Loki
- [ ] Check trace analysis in Jaeger
- [ ] Verify backup jobs are working
- [ ] Check AWS Free Tier usage https://console.aws.amazon.com/billingv2

**Monthly** (1 hour):
- [ ] Update alert thresholds based on patterns
- [ ] Clean up old Prometheus/Loki data if needed
- [ ] Security review of access logs
- [ ] Performance optimization review

---

## 🔧 Troubleshooting Commands

### Services Not Starting
```bash
# Check docker status
docker-compose ps

# View service logs
docker-compose logs backend
docker-compose logs prometheus
docker-compose logs jaeger

# Check disk space
df -h

# Check memory
free -h

# Restart everything
docker-compose down
docker-compose up -d
```

### Metrics Not Showing
```bash
# Verify metrics endpoint
curl http://localhost:4000/api/metrics | head -20

# Check Prometheus targets
curl http://localhost:9090/api/v1/targets | jq

# Check backend container has OTEL_EXPORTER_OTLP_ENDPOINT set
docker-compose exec backend env | grep OTEL
```

### Emails Not Sending
```bash
# Check Alertmanager logs
docker-compose logs alertmanager

# Verify SMTP settings:
# - Gmail requires: account 2FA enabled + app-specific password
# - Get app password at: accounts.google.com/AppPasswords
# - Use that password in SMTP_PASS, not your regular password

# Test SMTP manually:
docker-compose exec alertmanager \
  swaks --to your-email@gmail.com --from noreply@yourdomain.com \
  --server smtp.gmail.com:465 --tls --auth LOGIN \
  --auth-user your-gmail@gmail.com --auth-password "app-password"
```

### Out of Memory
```bash
# Check current usage
docker stats

# Increase swap (if on server)
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Reduce retention in prometheus.yml:
# Change: --storage.tsdb.retention.time=7d
# To: --storage.tsdb.retention.time=3d
```

---

## 📊 Observability Stack Summary

| Component | Port | Purpose | Memory | URL |
|-----------|------|---------|--------|-----|
| **Prometheus** | 9090 | Metrics storage | 1GB | http://localhost:9090 |
| **Loki** | 3100 | Log aggregation | 512MB | (API only) |
| **Jaeger** | 16686 | Distributed tracing | 512MB | http://localhost:16686 |
| **Grafana** | 3001 | Dashboards & alerts | 256MB | http://localhost:3001 |
| **Alertmanager** | 9093 | Alert routing | 128MB | http://localhost:9093 |
| **Backend** | 4000 | Your API | Variable | http://localhost:4000 |
| **Frontend** | 3000 | Your app | Variable | http://localhost:3000 |

**Total**: ~3.5GB (fits in t2.micro + 3GB swap)

---

## 📈 Key Metrics Being Tracked

### HTTP/API Metrics
- `http_requests_total` - Total requests by method/route/status
- `http_request_duration_seconds` - Response time distribution
- `http_errors_total` - Error count by route/status
- `active_connections` - Current active connections

### Database Metrics  
- `db_query_duration_seconds` - Query execution time
- `db_query_errors_total` - Query failures by operation

### External API Metrics
- `external_api_duration_seconds` - Groq, Cloudinary, etc latency
- `external_api_errors_total` - External API failures

### Application Metrics
- `auth_failures_total` - Failed login attempts by reason
- `attendance_records_total` - Attendance by status

---

## 🚨 Alert Rules Included

All rules in `observability/alert-rules.yml`:

1. **HighErrorRate** - If error rate > 5% for 2 minutes
2. **HighResponseTime** - If p95 latency > 1 second
3. **HighActiveConnections** - If > 100 connections
4. **SlowDatabaseQueries** - If p95 query > 500ms
5. **DatabaseQueryErrors** - Any DB errors
6. **HighExternalAPILatency** - If Groq > 5s
7. **ExternalAPIErrors** - If external API errors
8. **AuthenticationFailuresSpike** - If > 0.5 failures/sec
9. **PrometheusStorageFull** - Storage running out
10. **AlertmanagerConfigErrors** - Config reload failed  
11. **ServiceDown** - Backend API unreachable
12. **JaegerStorageIssues** - Jaeger dropping traces

---

## 🎯 Success Criteria

### For Local Dev ✅
- [ ] `docker-compose ps` shows all services running
- [ ] `curl http://localhost:4000/api/health` returns 200
- [ ] Grafana accessible at http://localhost:3001
- [ ] Pre-built dashboards visible
- [ ] Can query metrics in Prometheus
- [ ] Can see traces in Jaeger
- [ ] Can see logs in Loki

### For AWS Production ✅
- [ ] All services running on EC2
- [ ] HTTPS working for all domains
- [ ] Email alerts successfully configured
- [ ] Can receive alert emails when thresholds breached
- [ ] Grafana accessible externally
- [ ] Dashboards showing live metrics
- [ ] Cost within AWS Free Tier

---

## 📚 Documentation Files

- **`observability/SETUP_GUIDE.md`** - Comprehensive 200+ line setup guide
- **`AWS_QUICK_START.md`** - 30-minute AWS deployment steps
- **`backend/.env.example`** - Environment variable reference
- **README files in each service folder** (optional, can be added)

---

## 🆘 Need Help?

1. Check logs: `docker-compose logs -f <service-name>`
2. Check this checklist
3. Review troubleshooting commands above
4. Check Prometheus targets: http://localhost:9090/targets
5. Check Alertmanager UI: http://localhost:9093
6. Review alert rules in Grafana: Alerting > Alert Rules

---

## Next Session Planning

After completing this implementation:

1. **Additional Features** (Optional):
   - Custom Grafana dashboard for your specific business metrics
   - Slack integration (in addition to email)
   - PagerDuty integration for critical alerts
   - Log sampling/filtering rules

2. **Performance Optimization**:
   - Database query profiling
   - Caching layer optimization
   - CDN integration for static assets

3. **Security Hardening**:
   - Audit logging
   - GDPR compliance tracking
   - Rate limiting by user/IP

4. **Cost Optimization**:
   - Reserved Instances on AWS
   - Data retention policies
   - CloudFront caching

---

**Status**: ✅ All code files created, ready for deployment!

Next: Run local tests and then deploy to AWS.

