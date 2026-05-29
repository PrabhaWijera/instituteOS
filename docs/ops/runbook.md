# NexClass Operations Runbook

> **Purpose:** Standard procedures for on-call engineers. Each section covers a common failure scenario with detection steps, immediate mitigation, and root-cause investigation.

---

## Table of Contents

1. [API is down / returning 5xx](#1-api-is-down--returning-5xx)
2. [Database connection exhausted](#2-database-connection-exhausted)
3. [Redis is unavailable (OTP / sessions broken)](#3-redis-is-unavailable-otp--sessions-broken)
4. [Groq AI circuit is OPEN](#4-groq-ai-circuit-is-open)
5. [Cloudinary circuit is OPEN (file uploads failing)](#5-cloudinary-circuit-is-open-file-uploads-failing)
6. [Memory / CPU spike on EC2](#6-memory--cpu-spike-on-ec2)
7. [Billing worker silent failure](#7-billing-worker-silent-failure)
8. [Attendance OTP not working](#8-attendance-otp-not-working)
9. [Production deployment rollback](#9-production-deployment-rollback)
10. [Database backup failure](#10-database-backup-failure)
11. [JWT secret compromise / rotation](#11-jwt-secret-compromise--rotation)
12. [GDPR erasure request](#12-gdpr-erasure-request)

---

## 1. API is down / returning 5xx

### Detection
- `GET /api/health` returns non-200 or times out
- Grafana: error rate alert fires (`nexclass_http_errors_total`)
- Users reporting login failures

### Immediate mitigation
```bash
# Check running containers
docker compose ps

# Check backend logs (last 100 lines)
docker compose logs --tail=100 backend

# Restart backend (< 5 s downtime)
docker compose restart backend

# Verify health
curl -s http://localhost:4000/api/health | jq .
```

### Escalation
If restart does not fix:
1. Check DB connectivity: `docker compose exec backend npx prisma db pull`
2. Check env vars loaded: `docker compose exec backend env | grep DATABASE_URL`
3. Check disk space: `df -h`
4. Roll back to previous image: see [§9 Deployment Rollback](#9-production-deployment-rollback)

---

## 2. Database connection exhausted

### Symptoms
```
Error: P1001 Can't reach database server at 'host:5432'
Error: Connection pool timeout (pool_timeout=30)
```

### Detection
- Prisma error `P2024` (pool timeout) in logs
- Grafana: `nexclass_db_connections_active` near limit

### Investigation
```bash
# Check active connections on RDS / local Postgres
psql $DATABASE_URL -c "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"

# Check for long-running queries
psql $DATABASE_URL -c "
  SELECT pid, now() - pg_stat_activity.query_start AS duration, query, state
  FROM pg_stat_activity
  WHERE (now() - pg_stat_activity.query_start) > interval '30 seconds';"

# Kill a blocking query
psql $DATABASE_URL -c "SELECT pg_terminate_backend(PID);"
```

### Mitigation
```bash
# Temporarily increase pool size (restart required)
# Edit DATABASE_URL in .env:  ?connection_limit=20&pool_timeout=60
docker compose restart backend
```

### Long-term fix
- Set `connection_limit` to `(expected_instances × workers) ÷ max_rds_connections`
- Consider PgBouncer for connection pooling at the proxy layer

---

## 3. Redis is unavailable (OTP / sessions broken)

### Symptoms
- Attendance OTP check-in succeeds (falls back to DB) — EXPECTED
- Login lockout not enforced
- Per-user rate limits not enforced
- Cache lookups miss

### Detection
- Warning logs: `[Attendance] Redis GET failed — falling back to DB OTP`
- Warning logs: `[RateLimit] Redis error — failing open`

### Response
The system is designed to **fail open** on Redis failures — no user-visible errors. However:

```bash
# Check Upstash dashboard at https://console.upstash.com
# Verify UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set
docker compose exec backend env | grep UPSTASH

# Test connectivity manually
curl -X GET \
  -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN" \
  "$UPSTASH_REDIS_REST_URL/ping"
```

### Temporary measures while Redis is down
- All OTP verification falls back to DB-stored OTP code — attendance continues working
- Login lockout is not enforced — monitor for brute-force attempts in logs
- Rate limiting is not enforced — IP-based `apiLimiter` still applies

---

## 4. Groq AI circuit is OPEN

### Symptoms
- AI tutor returns: _"I'm temporarily unavailable due to a technical issue"_
- `/api/health` response shows `"groq-ai": "OPEN"`

### Detection
```bash
curl -s http://localhost:4000/api/health | jq .circuits
# Expected when healthy: {"groq-ai":"CLOSED","cloudinary":"CLOSED","smtp-email":"CLOSED"}
```

### Investigation
```bash
# Check backend logs for Groq errors
docker compose logs backend | grep -i "groq\|circuit"

# Check Groq service status: https://status.groq.com
```

### Mitigation
Circuit auto-recovers after 60 s. If Groq is up but circuit is stuck OPEN:
```bash
# Restart backend to reset in-memory circuit state
docker compose restart backend
```

### If Groq is genuinely down
- AI tutor shows degraded message — all other features unaffected
- No action required; circuit retries automatically every 60 s

---

## 5. Cloudinary circuit is OPEN (file uploads failing)

### Symptoms
- Material upload returns `503 File upload service is temporarily unavailable`
- `/api/health` shows `"cloudinary": "OPEN"`

### Investigation
```bash
# Check Cloudinary status: https://status.cloudinary.com
# Check API keys are valid
docker compose exec backend env | grep CLOUDINARY
```

### Mitigation
Same as §4 — circuit auto-recovers. Admins and teachers can provide direct URLs for video/live-link materials as a workaround while Cloudinary is down.

---

## 6. Memory / CPU spike on EC2

### Detection
- AWS CloudWatch: `CPUUtilization > 80%` or `MemoryUtilization > 85%`
- API response times increase

### Investigation
```bash
# Check resource usage
top
docker stats --no-stream

# Check which container is using most memory
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"

# Check for memory leak in backend
docker compose logs backend | grep -i "heap\|memory\|oom"
```

### Mitigation
```bash
# Restart the high-memory container
docker compose restart backend

# If disk is full (common cause of crashes)
docker system prune -f
df -h
```

### Scale up (if load is genuine)
```bash
# Change EC2 instance type via AWS Console or Terraform:
# t3.small → t3.medium → t3.large
# Update infrastructure/terraform/main.tf: ec2_instance_type = "t3.medium"
terraform apply -target=aws_instance.app
```

---

## 7. Billing worker silent failure

### Detection
- Students not getting fee-due notifications
- `enrollments.subscriptionStatus` not moving to `PAYMENT_DUE`
- No `[Billing Worker] Cycle complete` in logs for > 15 min

### Investigation
```bash
docker compose logs backend | grep -i "billing\|worker"
```

### Common causes
- DB transaction failure (check Prisma error logs)
- `BILLING_CYCLE_DAYS` env var not set (defaults to 30)
- Worker not started (check `server.ts` startup logs)

### Manual trigger (emergency)
```bash
# Connect to backend and run billing logic manually
docker compose exec backend node -e "
const { startBillingWorker } = require('./dist/modules/payment/billing.worker');
startBillingWorker();
"
```

---

## 8. Attendance OTP not working

### Symptoms
- Students get "Invalid OTP code" despite entering correct code
- OTP expired before student could use it

### Investigation
```bash
# Check if Redis is holding the OTP
# (replace SESSION_ID with the actual session ID from the DB)
curl -X GET \
  -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN" \
  "$UPSTASH_REDIS_REST_URL/get/otp:SESSION_ID"
```

### If Redis returns null but session is ONGOING
OTP has expired. Teacher should end and restart the session, or use manual mark.

### Increase OTP expiry per institute
```
Institute Settings → OTP Expiry Minutes → increase from 10 to 20
```

### Geofence issues ("too far away" error)
1. Verify institute latitude/longitude is set in Institute Settings
2. Check `BYPASS_GEOFENCING=true` can be temporarily set in `.env` for testing
3. Increase geofence radius in Institute Settings

---

## 9. Production deployment rollback

### Prerequisites
- Note the previous Docker image tag or Git SHA

### Rollback steps
```bash
# 1. Identify the previous working image
docker images nexclass-backend --format "{{.Tag}}\t{{.CreatedAt}}" | head -5

# 2. Roll back backend to previous image
docker compose -f docker-compose.prod.yml stop backend
docker tag nexclass-backend:PREVIOUS_TAG nexclass-backend:latest
docker compose -f docker-compose.prod.yml up -d backend

# 3. Verify health
curl -s https://your-domain.com/api/health | jq .

# 4. If DB migration was also applied, roll it back
cd backend
DATABASE_URL=$PROD_DATABASE_URL npx prisma migrate resolve --rolled-back MIGRATION_NAME
```

### Git-based rollback
```bash
cd /opt/nexclass
git log --oneline -10
git checkout PREVIOUS_SHA
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
```

---

## 10. Database backup failure

### Detection
- No new files in `/var/backups/nexclass/` after scheduled time
- Cron job error: check `/var/log/syslog` or crontab logs

### Verify backup runs
```bash
# Check crontab
crontab -l

# Run backup manually and inspect output
DATABASE_URL=$DATABASE_URL BACKUP_DIR=/tmp/test-backup bash scripts/db-backup.sh

# Verify S3 uploads (if configured)
aws s3 ls s3://nexclass-db-backups-ACCOUNT_ID/db-backups/ | head -10
```

### Test restore
```bash
# IMPORTANT: test on a non-production DB first
LATEST=$(ls -t /var/backups/nexclass/*.sql.gz | head -1)
gunzip -c "$LATEST" | psql postgresql://user:pass@localhost:5432/nexclass_restore
```

---

## 11. JWT secret compromise / rotation

### Immediate steps
1. **Rotate secrets** — generate new 64-char random strings:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
2. Update `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` in production `.env` / AWS Secrets Manager
3. **Restart backend** — all existing tokens are immediately invalidated
4. **Purge all refresh tokens** from DB:
   ```sql
   DELETE FROM "RefreshToken";
   ```
5. Notify all users via email that they need to log in again (optional, but good practice)

### Symptoms of compromise
- Unknown sessions appearing in user account activity
- Unusual API access patterns in logs
- Unexpected admin actions in audit logs

---

## 12. GDPR erasure request

### Automated self-service
Users can delete their own account via:
```
DELETE /api/v1/users/me
Authorization: Bearer <token>
```

### Manual admin erasure
```bash
# Via Super Admin API
curl -X DELETE \
  -H "Authorization: Bearer <SUPER_ADMIN_TOKEN>" \
  https://your-domain.com/api/v1/users/USER_ID/data
```

### Verification
```bash
# Confirm PII has been anonymised
psql $DATABASE_URL -c "
SELECT id, email, full_name, phone, profile_image, is_deleted
FROM users WHERE id = 'USER_ID';"
# Should show: deleted_USER_ID@nexclass.deleted | [Deleted User] | null | null | true
```

### Response deadline
Under GDPR Article 17, the erasure must be completed **within 30 days** of the request.
Log the request timestamp and use the audit log to confirm completion.

---

## Contact / Escalation Matrix

| Level | Who | When |
|-------|-----|------|
| L1 | On-call engineer | All alerts |
| L2 | Senior engineer | L1 unable to resolve in 30 min |
| L3 | Infrastructure owner | Database corruption, data loss risk |
| Legal | Data Protection Officer | GDPR/privacy incidents |

---

*Last updated: See git log for this file.*
