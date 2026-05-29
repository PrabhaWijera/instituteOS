# Observability Stack - File Directory Guide

## 📁 Directory Structure

```
observability/
├── README.md                           # This file
├── prometheus.yml                      # Prometheus scrape configuration
├── alert-rules.yml                     # Prometheus alert rules (15 rules)
├── loki-config.yml                     # Loki log storage configuration
├── alertmanager.yml                    # Alert routing and email templates
└── grafana/
    └── provisioning/
        ├── datasources/
        │   └── datasources.yml         # Grafana data source definitions
        ├── dashboards/
        │   ├── dashboards.yml          # Dashboard provisioning config
        │   ├── nexclass-api.json       # Pre-built API metrics dashboard
        │   └── nexclass-logs-traces.json # Pre-built logs/traces dashboard
        └── notifiers/
            └── notifiers.yml           # Grafana notifier configuration
```

---

## 📄 File Reference

### 1. **prometheus.yml**
- **Purpose**: Tells Prometheus where to scrape metrics from
- **Key Targets**:
  - Backend API (`/api/metrics`)
  - Loki (internal metrics)
  - Jaeger (internal metrics)
  - Alertmanager (internal metrics)
- **Used By**: Prometheus container
- **Editing**: Add new scrape targets if monitoring additional services

### 2. **alert-rules.yml**
- **Purpose**: Defines 15 production-ready alert rules
- **Alert Types**:
  - Performance: High error rate, slow responses, slow queries
  - Availability: Service down, connectivity errors
  - Infrastructure: Storage full, memory issues
  - External: API failures, latency issues
- **Used By**: Prometheus (evaluates rules every 30 seconds)
- **Editing**: Modify thresholds or add new alert conditions

**Alert Examples**:
```yaml
alert: HighErrorRate
expr: error_rate > 0.05              # 5% threshold
for: 2m                              # Wait 2 minutes before firing
labels:
  severity: warning
```

### 3. **loki-config.yml**
- **Purpose**: Configures Loki log storage
- **Key Settings**:
  - Storage backend: Filesystem
  - Storage location: `/loki/chunks` (persistent volume)
  - Max streams: 10,000 per user
  - Ingestion rate: 10MB/s
- **Used By**: Loki container
- **Editing**: Adjust retention, ingestion rates if needed

### 4. **alertmanager.yml**
- **Purpose**: Routes alerts to receivers (email, Slack, etc.)
- **Key Sections**:
  - `global`: Default SMTP/notification settings
  - `route`: Alert routing rules by severity
  - `receivers`: Email recipient configuration
  - `inhibit_rules`: Alert suppression rules
- **Email Templates**: HTML formatted for readability
- **Used By**: Alertmanager container
- **Important**: Uses environment variables:
  - `${ALERT_EMAIL_RECIPIENTS}`: Comma-separated email list
  - `${SMTP_HOST}`, `${SMTP_PORT}`, etc.: Email server credentials

---

## 📊 Grafana Configuration Files

### 5. **grafana/provisioning/datasources/datasources.yml**
- **Purpose**: Automatically configures data sources in Grafana
- **Data Sources**:
  - **Prometheus**: Primary metrics source
  - **Loki**: Log aggregation
  - **Jaeger**: Distributed tracing
  - **Grafana**: Built-in (for annotations)
- **Auto-Loaded**: On Grafana startup
- **Editing**: Add new data sources here (e.g., InfluxDB, Elasticsearch)

### 6. **grafana/provisioning/dashboards/dashboards.yml**
- **Purpose**: Tells Grafana where to find dashboard JSON files
- **Watches**: `/etc/grafana/provisioning/dashboards/` directory
- **Auto-Loads**: All `.json` files in that folder
- **Editing**: Point to new dashboard folders if organizing by team

### 7. **grafana/provisioning/dashboards/nexclass-api.json**
- **Purpose**: Pre-built dashboard for API performance metrics
- **Panels**:
  1. Request Rate (5m average)
  2. Response Time (p95, p99 percentiles)
  3. Error Rate (5m average)
  4. Active Connections (gauge)
- **Time Range**: Last 6 hours (modifiable in dashboard)
- **Refresh Rate**: 30 seconds
- **Interactive**: Click panels to drill down into specific metrics

### 8. **grafana/provisioning/dashboards/nexclass-logs-traces.json**
- **Purpose**: Pre-built dashboard for logs and distributed traces
- **Panels**:
  1. Application Logs (from Loki)
  2. Error Logs Only (filtered)
  3. Distributed Traces (from Jaeger)
  4. HTTP Status Code Distribution (from Prometheus)
- **Log Sources**: All Docker containers
- **Time Range**: Last 1 hour
- **Drill-Down**: Click traces to see flame graph

### 9. **grafana/provisioning/notifiers/notifiers.yml**
- **Purpose**: Configures default notifier for alerts
- **Notifier Type**: Email
- **Recipients**: From `${ALERT_EMAIL_RECIPIENTS}` environment variable
- **Reminder**: Will resend unacknowledged alerts after 24 hours

---

## 🔧 How Everything Works Together

```
Backend API
    ↓ (exports metrics every 15s)
    ↓
GET /api/metrics (Prometheus format)
    ↓
Prometheus (scrapes, stores, evaluates rules)
    ├─ Stores metrics for 7 days
    ├─ Evaluates alert rules every 30s
    └─ If threshold triggered → sends to Alertmanager
    ↓
Alertmanager (routes alert)
    ├─ Groups related alerts
    ├─ Applies inhibition rules
    └─ Sends email (via SMTP)
    ↓
Your Email (alert received!)

Grafana (queries Prometheus, Loki, Jaeger)
    ├─ Displays pre-built dashboards
    ├─ Shows live metrics
    └─ Renders traces and logs
```

---

## 🚀 First Steps

### 1. **Verify Configuration**
```bash
# Check all YAML files are valid
yamllint observability/*.yml
# or manually verify in text editor
```

### 2. **Start Services Locally**
```bash
docker-compose up -d
docker-compose ps
```

### 3. **Access Dashboards**
- Grafana: http://localhost:3001 (admin/admin)
- Prometheus: http://localhost:9090
- Jaeger: http://localhost:16686

### 4. **Test Alert**
```bash
# Generate traffic to trigger alert
for i in {1..1000}; do
  curl http://localhost:4000/api/fake-endpoint &
done

# Wait 2-5 minutes for alert
# Check Alertmanager: http://localhost:9093
# Check Grafana Alerts: http://localhost:3001/alerting/alerts
```

---

## 🔍 Common Edits

### To Change Email Recipients
Edit: `alertmanager.yml`
```yaml
receivers:
  - name: 'email-alert'
    email_configs:
      - to: 'new-email@example.com'  # Change this
```

### To Add New Alert Rule
Edit: `alert-rules.yml`
```yaml
- alert: MyCustomAlert
  expr: metric_name > 100
  for: 5m
  annotations:
    summary: "My custom alert"
```

### To Change Metrics Retention
Edit: `prometheus.yml` (when starting container)
```bash
command:
  - '--storage.tsdb.retention.time=14d'  # Change from 7d to 14d
```

### To Add New Dashboard
1. Create dashboard in Grafana UI
2. Export as JSON
3. Save to: `grafana/provisioning/dashboards/my-dashboard.json`
4. Reload Grafana: `docker-compose restart grafana`

---

## 📚 File Modification Guide

| File | Safe to Edit | Reason |
|------|--------------|--------|
| prometheus.yml | ✅ Yes | Add/remove scrape targets |
| alert-rules.yml | ✅ Yes | Adjust thresholds, add rules |
| loki-config.yml | ⚠️ Careful | Change retention, ingestion rates |
| alertmanager.yml | ✅ Yes | Change email, add Slack, etc |
| datasources.yml | ✅ Yes | Add data sources |
| dashboards*.json | ✅ Yes | Modify panels, queries |

### DO NOT EDIT
- Prometheus/Grafana/Loki/Jaeger container configuration
- Docker Compose service definitions (unless you know what you're doing)
- Volume mount paths

---

## 🆘 Troubleshooting

### Prometheus Not Scraping Backend
**Check**: `http://localhost:9090/targets`
- If Red (DOWN): Backend might not be responding
- Solution: `curl http://localhost:4000/api/metrics`

### Alerts Not Firing
**Check**: `http://localhost:9090/alerts`
- If greyed out: Check `for:` duration hasn't elapsed
- Solution: Generate more traffic to trigger threshold

### Emails Not Sending
**Check**: `docker-compose logs alertmanager`
- If "auth failed": Check SMTP credentials
- Solution: Use app-specific password for Gmail

### Dashboard Panels Blank
**Check**: Prometheus has metrics
- If no data: Backend might not be exporting metrics
- Solution: Restart backend: `docker-compose restart backend`

---

## 📖 Documentation Files

In this directory:
- **SETUP_GUIDE.md**: Complete setup instructions
- **AWS_QUICK_START.md**: AWS deployment guide

In root directory:
- **IMPLEMENTATION_CHECKLIST.md**: Step-by-step tasks
- **OBSERVABILITY_SUMMARY.md**: Overall architecture

---

## 🎯 Quick Reference

**For DevOps/SRE**:
- Focus on: `prometheus.yml`, `alert-rules.yml`, `alertmanager.yml`
- Monitor: `docker-compose logs prometheus alertmanager`

**For Backend Developers**:
- Check: `http://localhost:4000/api/metrics` for custom metrics
- View: Grafana dashboards for API performance

**For System Administrators**:
- Review: Disk usage of Prometheus/Loki volumes
- Backup: Grafana dashboards regularly
- Test: Alert emails monthly

---

## 🔗 Integration Points

This observability stack connects with:

1. **Backend Application**:
   - Exports metrics at `/api/metrics`
   - Has OpenTelemetry instrumentation
   - Sends alerts via SMTP

2. **External Services**:
   - Upstash Redis (real-time presence)
   - Gmail SMTP (for email alerts)
   - Can add: Slack, PagerDuty, etc.

3. **Your Email**:
   - Receives alert notifications
   - Severity-based routing
   - Alert details included

---

## 📊 Data Flow Summary

```
App Metrics → Prometheus → Grafana Dashboard
             ↓
          Alert Rules
             ↓
         Alertmanager
             ↓
            Email

App Logs → Loki → Grafana Explore
         ↓
      Full-text Search

App Traces → Jaeger → Jaeger UI / Grafana
          ↓
    Latency Analysis
```

---

## ⚡ Performance Notes

- **Prometheus**: Stores ~5,000+ metrics, grows with usage
- **Loki**: Stores all logs, ~100+ MB/day in development
- **Jaeger**: Keeps ~3,000 traces in memory
- **Grafana**: Dashboard queries typically < 200ms

For production, monitor:
- Prometheus disk usage (grows ~5-10GB/month)
- Loki disk usage (grows ~3-5GB/month)
- Memory usage (steady at ~3.5GB with swap)

---

**Ready to deploy? Check IMPLEMENTATION_CHECKLIST.md next!** 🚀


