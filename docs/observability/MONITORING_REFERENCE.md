# NexClass Observability Quick Reference

## Dashboard Access

| Component | URL | Default Credentials |
|-----------|-----|-------------------|
| **Grafana** | http://localhost:3001 | admin / admin |
| **Prometheus** | http://localhost:9090 | None (no auth) |
| **Jaeger** | http://localhost:16686 | None (no auth) |
| **Loki** | http://localhost:3100 | None (no auth) |
| **AlertManager** | http://localhost:9093 | None (no auth) |
| **API Metrics** | http://localhost:4000/metrics | None |

---

## Key Metrics to Monitor

### API Performance

```promql
# Request rate (per second)
rate(nexclass_http_requests_total[5m])

# Error rate (percentage)
rate(nexclass_http_requests_total{status=~"5.."}[5m]) / rate(nexclass_http_requests_total[5m])

# P95 Response Time
histogram_quantile(0.95, rate(nexclass_http_request_duration_seconds_bucket[5m]))

# P99 Response Time
histogram_quantile(0.99, rate(nexclass_http_request_duration_seconds_bucket[5m]))

# Active connections
nexclass_http_active_connections
```

### Database Health

```promql
# Connection pool usage
nexclass_db_pool_connections_current / 25 * 100  # (percentage)

# Query latency (p95)
histogram_quantile(0.95, rate(nexclass_db_query_duration_seconds_bucket[5m]))

# Query error rate
rate(nexclass_db_query_errors_total[5m])

# Connection errors
rate(nexclass_db_connection_errors_total[5m])
```

### Attendance System

```promql
# Sessions created per hour
increase(nexclass_attendance_sessions_created_total[1h])

# OTP expiry rate
rate(nexclass_otp_expired_total[5m])

# Average marking time
rate(nexclass_attendance_marking_duration_seconds_sum[5m]) / rate(nexclass_attendance_marking_duration_seconds_count[5m])

# Distance from geofence (average)
histogram_quantile(0.5, nexclass_attendance_distance_from_geofence_meters_bucket)
```

### Billing Jobs

```promql
# Last successful run (unix timestamp)
nexclass_billing_job_last_success_timestamp_seconds

# Jobs per day
increase(nexclass_billing_job_runs_total[24h])

# Payment dues created per day
increase(nexclass_payment_dues_created_total[24h])
```

### External APIs

```promql
# External API call success rate
rate(nexclass_external_api_calls_total{status="success"}[5m])

# External API latency (p95)
histogram_quantile(0.95, rate(nexclass_external_api_duration_seconds_bucket{service="groq"}[5m]))
```

### System Resources

```promql
# Memory usage (MB)
process_resident_memory_bytes / 1024 / 1024

# CPU usage (percentage)
rate(process_cpu_seconds_total[5m]) * 100

# File descriptors
process_open_fds
```

---

## Alert Threshold Reference

| Alert | Threshold | Action |
|-------|-----------|--------|
| Backend Down | up == 0 for 2m | ❌ Critical - Restart service |
| High Error Rate | > 5% for 5m | ⚠️ Check logs, rollback if needed |
| High Latency | p95 > 1s | ⚠️ Scale up or optimize queries |
| DB Connections High | > 20 / 25 for 3m | ⚠️ Monitor connection leaks |
| DB Query Errors | Any rate > 0 | ⚠️ Investigate query issues |
| Redis Down | Connected == 0 | ❌ Critical - Restart Redis |
| Memory Usage > 80% | > 0.8 GB | ⚠️ Check for memory leaks |
| Billing Job Failure | > 15m | ❌ Critical - Manual intervention |
| Auth Failures Spike | > 1/sec | ⚠️ Check for attack, review logs |

---

## Common Queries by Use Case

### "API is slow" - Find the cause

```promql
# 1. Check error rate
rate(nexclass_http_requests_total{status=~"5.."}[5m])

# 2. Check slow endpoints
topk(5, histogram_quantile(0.95, rate(nexclass_http_request_duration_seconds_bucket[5m])))

# 3. Check database queries
topk(5, histogram_quantile(0.95, rate(nexclass_db_query_duration_seconds_bucket[5m])))

# 4. Check external APIs
topk(5, histogram_quantile(0.95, rate(nexclass_external_api_duration_seconds_bucket[5m])))
```

### "Users can't login" - Diagnose auth issue

```promql
# Auth failure rate
rate(nexclass_auth_failures_total[5m])

# Account lockouts
rate(nexclass_auth_account_lockouts_total[5m])

# JWT tokens issued
rate(nexclass_jwt_tokens_issued_total[5m])

# Check logs for specific errors
Loki Logs Query: {service="nexclass-backend"} | json | event_type="authentication"
```

### "Attendance not working" - Debug session issues

```promql
# Session creation rate
rate(nexclass_attendance_sessions_created_total[5m])

# Session errors
rate(nexclass_attendance_session_errors_total[5m])

# OTP expiry rate
rate(nexclass_otp_expired_total[5m])

# Check logs
Loki: {service="nexclass-backend"} | json | event_type="attendance"
```

### "Payment system broken" - Check billing

```promql
# Last successful billing run
time() - nexclass_billing_job_last_success_timestamp_seconds

# Payment dues created
increase(nexclass_payment_dues_created_total[24h])

# Payment processing errors
rate(nexclass_payment_processing_errors_total[5m])

# Check logs
Loki: {service="nexclass-backend"} | json | event_type="billing"
```

### "High disk usage" - Find the culprit

```bash
# SSH into instance
ssh -i key.pem ubuntu@your-ip

# Check disk usage
df -h

# Check container sizes
docker system df

# Check volume sizes
du -sh /var/lib/docker/volumes/*

# Cleanup old logs
docker-compose logs --tail=0 > /dev/null
docker system prune -f

# Reduce retention
# prometheus.yml: --storage.tsdb.retention.time=3d (from 7d)
# loki-config.yml: retention_period: 72h (from 168h)
```

---

## Grafana Dashboard Queries

### Create Custom Panel

1. **Add Panel** > Choose Visualization
2. **Query Builder**:
   ```
   Metric: nexclass_http_requests_total
   Label Filters: status="200"
   Legend: {{ method }} {{ route }}
   ```
3. **Options**:
   - Min: 0
   - Decimals: 0
   - Unit: reqps (requests per second)

### Common Visualizations

| Metric | Visualization | Useful For |
|--------|---------------|-----------|
| Request rate | Graph | Spotting traffic patterns |
| Error rate | Graph + Alert | Monitoring health |
| Latency | Graph (p50, p95, p99) | Performance tuning |
| Connections | Gauge | Capacity planning |
| Batch jobs | Stat | Last run status |

---

## Log Query Examples (Loki)

```logql
# All errors
{service="nexclass-backend"} | level="error"

# Errors in last 5 minutes
{service="nexclass-backend"} | level="error" | __name__ | "error" | __timestamp__ > now - 5m

# Errors from specific module
{service="nexclass-backend"} | json | event_type="attendance"

# Search by user ID
{service="nexclass-backend"} | json | user_id="user123"

# Slow database queries (>500ms)
{service="nexclass-backend"} | json | duration_ms > 500

# Auth failures
{service="nexclass-backend"} | json | event_type="authentication" | success="false"

# Combine: Errors + specific time period
{service="nexclass-backend"} | level="error" | __timestamp__ > now - 1h
```

---

## Distributed Tracing (Jaeger)

### Key Concepts

- **Trace**: Full request journey (e.g., API call → Database → Response)
- **Span**: Individual operation (e.g., database query)
- **Service**: Microservice (nexclass-backend, postgres, redis)

### Finding Performance Issues

1. **Search Traces**:
   - Service: nexclass-backend
   - Operation: POST /auth/login
   - Duration: > 1000ms

2. **Analyze Flamegraph**:
   - See which operation took longest
   - Identify bottleneck (DB, external API, etc.)

3. **Compare Traces**:
   - Fast trace vs slow trace
   - Find what changed

---

## Backup & Retention

### Data Retention

```
Prometheus:  7 days (metrics)
Loki:        7 days (logs)
Jaeger:      72 hours (traces)
Alertmanager: 24 hours (alerts)
```

### Database Backups

```bash
# Manual backup
docker-compose exec postgres pg_dump -U nexclass nexclass > backup-$(date +%Y%m%d-%H%M%S).sql.gz

# Restore from backup
docker-compose exec -T postgres psql -U nexclass nexclass < backup-20260525-120000.sql

# Auto-backup (cron)
0 2 * * * docker-compose exec -T postgres pg_dump -U nexclass nexclass > /backups/db-$(date +\%Y\%m\%d).sql.gz
```

---

## Performance Tuning Checklist

- [ ] API response time (p95) < 500ms
- [ ] Error rate < 0.1%
- [ ] Database connection pool < 80% utilized
- [ ] Memory usage < 70% of container limit
- [ ] Disk usage < 80% of volume size
- [ ] Billing job completes in < 5 minutes
- [ ] WebSocket connections stable
- [ ] Alert notification latency < 2 minutes

---

## Integration with External Tools

### PagerDuty

```yaml
# alertmanager.yml
receivers:
  - name: 'pagerduty'
    pagerduty_configs:
      - service_key: 'your-pagerduty-service-key'
```

### Slack

```yaml
receivers:
  - name: 'slack'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
        channel: '#alerts'
        title: '{{ .GroupLabels.alertname }}'
```

### Datadog

```bash
# Install Datadog agent
DD_AGENT_MAJOR_VERSION=7 DD_API_KEY=<key> DD_SITE=datadoghq.com \
bash -c "$(curl -L https://s3.amazonaws.com/dd-agent/scripts/install_agent.sh)"

# Configure Prometheus  integration
# /etc/datadog-agent/conf.d/prometheus.d/conf.yaml
```

---

## Emergency Procedures

### API is Down

```bash
# 1. Check service status
docker-compose ps backend

# 2. View logs
docker-compose logs backend | tail -100

# 3. Restart
docker-compose restart backend

# 4. Verify recovery
curl http://localhost:4000/api/health

# 5. Check metrics
curl http://localhost:4000/metrics | grep nexclass_http_requests_total
```

### Database is Down

```bash
# 1. Check service status
docker-compose ps postgres

# 2. View logs
docker-compose logs postgres | tail -50

# 3. Restart
docker-compose restart postgres

# 4. Verify connectivity
docker-compose exec backend npm run db:migrate:status

# 5. Restore from backup if corrupted
# (Read: Backup & Retention section)
```

### Redis is Down

```bash
# 1. Check status (OTP system affected!)
docker-compose ps redis

# 2. Restart
docker-compose restart redis

# 3. Monitor
docker-compose logs -f redis

# Note: OTP will fail until Redis is restored
```

### Disk is Full

```bash
# 1. Check what's consuming space
df -h
du -sh /var/lib/docker/volumes/*/

# 2. Clean up old logs
docker system prune -f

# 3. Reduce retention
# prometheus.yml: retention.time=3d  (from 7d)
# loki-config.yml: retention_period=72h
docker-compose restart prometheus loki

# 4. Backup older data externally
tar czf observability-backup-$(date +%Y%m%d).tar.gz \
  /var/lib/docker/volumes/prometheus_data/ \
  /var/lib/docker/volumes/loki_data/ \
  /var/lib/docker/volumes/jaeger_data/

# 5. Remove old backups/logs
find /backups -mtime +30 -delete
```

---

## Rate Limiting & Capacity

```
Prometheus scrape: 15s interval, ~2KB per target
Loki ingestion: 16MB/sec per tenant, 10k streams max
Jaeger storage: 2GB memory, traces evicted after 72h
Grafana: ~200MB memory, unlimited dashboards
AlertManager: <100MB memory
```

**Total Resources**:
- CPU: ~1 core
- RAM: ~3-4 GB
- Disk: ~50GB (7d retention)

---

## Success Criteria Checklist

- [ ] All services running and healthy
- [ ] Metrics flowing to Prometheus
- [ ] Logs flowing to Loki
- [ ] Traces flowing to Jaeger
- [ ] Grafana dashboards populated with data
- [ ] Alert rules firing correctly
- [ ] Email alerts being sent and received
- [ ] Response times tracked (p95 < 500ms)
- [ ] Error rates below 0.1%
- [ ] Database connections stable
- [ ] No memory leaks
- [ ] Billing jobs completing on schedule
- [ ] Team trained on alert response

---

**Last Updated**: 2026-05-26
**Next Review**: 2026-06-01

