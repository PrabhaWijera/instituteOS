# NexClass Email Alert Configuration Guide

## Overview

Email alerts are critical for production systems. NexClass supports multiple SMTP providers with **free or low-cost** tiers.

---

## Quick Comparison

| Provider | Free Limit | Setup | Cost | Best For |
|----------|-----------|-------|------|----------|
| **Gmail** | 500/month | 5 min | Free | Testing, small deployments |
| **SendGrid** | 100/day | 5 min | Free tier, $20+/mo | Production, reliable |
| **Amazon SES** | 200/day | 15 min | $0.10 per 1k emails | AWS-native, scalable |
| **Mailgun** | 50/month | 5 min | Pay-as-you-go | High volume |

---

## Gmail (Easiest for Testing)

### Setup Steps

1. **Enable 2-Factor Authentication**
   - Go to https://myaccount.google.com
   - Security > Two-Step Verification
   - Complete the setup

2. **Create App Password**
   - Go to https://myaccount.google.com/apppasswords
   - Select "Mail" and "Windows Computer"
   - Click "Generate"
   - Copy the 16-character password

3. **Configure .env**
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=xxxx xxxx xxxx xxxx   # (the 16-char app password)
   EMAIL_FROM=your-email@gmail.com
   ALERT_EMAIL_RECIPIENTS=your-email@gmail.com
   ```

4. **Test**
   ```bash
   docker-compose restart alertmanager
   # Trigger a test alert and check email
   ```

### Limitations
- Max 500 emails/month (may be lower if not using Google Workspace)
- Emails may be flagged as spam
- Not suitable for large-scale deployment

---

## SendGrid (Recommended for Startups)

### Setup Steps

1. **Create Account**
   - Go to https://sendgrid.com
   - Sign up for free account
   - Verify email

2. **Create API Key**
   - Go to Settings > API Keys
   - Create new "Restricted Access" key
   - Permissions: Mail Send only
   - Copy the key

3. **Add Sender Identity**
   - Go to Settings > Sender Authentication
   - Add email or domain
   - Verify ownership

4. **Configure .env**
   ```env
   SMTP_HOST=smtp.sendgrid.net
   SMTP_PORT=587
   SMTP_USER=apikey
   SMTP_PASS=SG.xxxxxxxxxxxxx...   # Your SendGrid API key
   EMAIL_FROM=alerts@nexclass.com  # Must be from verified sender
   ALERT_EMAIL_RECIPIENTS=admin@example.com
   ```

5. **Test**
   ```bash
   docker-compose down alertmanager
   docker-compose up -d alertmanager
   # Check logs: docker-compose logs alertmanager
   # Send test alert (see documenation)
   ```

### Free Plan
- **100 emails/day** (400 emails/month)
- Full feature support
- 30-day retention
- No rate limiting

### Upgrade Options
- Pro: $19.95/month for 100k emails/month
- Advanced: Custom volume pricing

---

## Amazon SES (Best for AWS Deployments)

### Prerequisites
- AWS Account with EC2 instance
- AWS CLI configured

### Setup Steps

1. **Verify Email Identity**
   ```bash
   aws ses verify-email-identity --email-address alerts@nexclass.com --region us-east-1
   ```
   - Confirm verification email sent to your inbox

2. **Request Production Access**
   - SES starts in "Sandbox" mode (emails to verified addresses only)
   - To send to any address:
     - Go to AWS SES Console
     - Account Dashboard > Edit account details
     - Request production access
     - Wait for approval (usually instant to 24 hours)

3. **Create SMTP Credentials**
   ```bash
   # In AWS Console:
   # SES > SMTP Settings > Create My SMTP Credentials
   # Create new IAM user (saves credentials automatically)
   # Copy Username and Password
   ```

4. **Configure .env**
   ```env
   # Make sure you're in US_EAST_1 region (SES free tier supported)
   SMTP_HOST=email-smtp.us-east-1.amazonaws.com
   SMTP_PORT=587
   SMTP_USER=AKIA2XXXXXXXXXXXXX
   SMTP_PASS=BMj2xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   EMAIL_FROM=alerts@nexclass.com
   ALERT_EMAIL_RECIPIENTS=admin@yourdomain.com
   ```

5. **Test**
   ```bash
   docker-compose exec alertmanager wget -q -O- http://localhost:9093/api/v1/status
   ```

### Free Tier Limits
- **62,000 emails/month** when sending from EC2
- **200 emails/day** from Lambda or other services
- **$0.10 per 1,000 emails** after free tier
- Very cost-effective

### Restrictions
- Only emails to verified addresses in Sandbox mode
- Request production access after verification
- Some attachment types are sandboxed

---

## Production Email Setup (Recommended)

### Architecture

```
Alert Triggered in Prometheus
    ↓
AlertManager Routes Alert
    ↓
Email Receiver
    ↓
SMTP Provider (SendGrid or SES)
    ↓
Recipient Email
```

### Alert Severity Levels

| Severity | Frequency | Recipients | Response |
|----------|-----------|------------|----------|
| **Critical** | Every 30m | ops-team@company.com | Immediate action |
| **Warning** | Every 2h | dev-team@company.com | Review and investigate |
| **Info** | Daily digest | admin@company.com | Monitor trend |

### Configuration Example (Multiple Recipients)

```yaml
# alertmanager.yml
receivers:
  - name: 'critical-alerts'
    email_configs:
      - to: 'oncall@company.com'
        from: 'alerts@company.com'
        smarthost: 'smtp.sendgrid.net:587'
        auth_username: 'apikey'
        auth_password: 'SG.xxxxx...'
        headers:
          Subject: '🚨 CRITICAL: {{ .GroupLabels.alertname }}'
        
  - name: 'warning-alerts'
    email_configs:
      - to: 'dev-team@company.com'
        from: 'alerts@company.com'
        smarthost: 'smtp.sendgrid.net:587'
        auth_username: 'apikey'
        auth_password: 'SG.xxxxx...'
        headers:
          Subject: '⚠️ WARNING: {{ .GroupLabels.alertname }}'
```

---

## Troubleshooting

### Emails Not Sending

**Step 1: Check AlertManager Logs**
```bash
docker-compose logs alertmanager | grep -i error
```

**Common Errors & Solutions:**

| Error | Cause | Solution |
|-------|-------|----------|
| `invalid credentials` | Wrong API key or password | Verify SMTP credentials in .env |
| `connection timed out` | Wrong SMTP server | Check SMTP_HOST and SMTP_PORT |
| `not authenticated` | AUTH not enabled | Ensure TLS/STARTTLS enabled |
| `5xx response` | Rate limited | Check provider limits |

**Step 2: Test SMTP Connection**
```bash
# Install mailutils
apt-get install -y mailutils

# Test email
echo "Test" | mail -s "Test" -S smtp=smtp.sendgrid.net:587 \
  -S smtp_use_starttls \
  -S smtp_authentication=login \
  -S smtp_auth_user=apikey \
  -S smtp_auth_password=SG.xxxxx... \
  your-email@example.com
```

**Step 3: Check Recipient Address**
```bash
# Verify email is in alert recipients
docker-compose exec alertmanager curl http://localhost:9093/api/v1/alerts
```

### Alerts Not Triggering

```bash
# Check if alerts are firing in Prometheus
docker-compose exec prometheus \
  curl http://localhost:9090/api/v1/alerts?state=firing

# Manually test AlertManager
curl -X POST http://localhost:9093/api/v1/alerts \
  -H 'Content-Type: application/json' \
  -d '[{"labels":{"alertname":"TestAlert","severity":"critical"}}]'
```

### Emails Going to Spam

**Solutions:**
1. Use custom domain with SPF/DKIM records
2. Add unsubscribe header
3. Avoid suspicious keywords in subject/body
4. Use reputable SMTP provider (SendGrid, SES)

---

## Monitoring Alert Delivery

```bash
# View AlertManager status
curl http://localhost:9093/api/v1/status | jq '.data'

# View recent alerts
curl http://localhost:9093/api/v1/alerts | jq '.data | length'

# Search for specific alert
curl http://localhost:9093/api/v1/alerts | jq '.data[] | select(.labels.alertname=="HighErrorRate")'
```

---

## Cost Analysis (12 Months)

### Scenario: 500 employees, 10 alerts per day average

| Provider | Daily Emails | Monthly | Cost/Year | Total |
|----------|-------------|---------|-----------|-------|
| Gmail | 300 | 9,000 | Blocked ($0) | ⚠️ Hits limit |
| SendGrid Free | 100 | 100 | $0 | ✅ Free tier work |
| SendGrid Pro | 5,000+ | 150,000+ | $240 | ✅ Much cheaper |
| AWS SES | 5,000+ | 150,000+ | $15 | ✅ Cheapest (62k free) |

**Recommendation**: AWS SES if on AWS, SendGrid Pro otherwise.

---

## Next Steps

1. Choose SMTP provider based on your needs
2. Verify sender email identity
3. Update .env with credentials
4. Restart Grafana and AlertManager
5. Test alert delivery
6. Set up on-call rotation (PagerDuty, OpsGenie)

---

**Questions?** See main [OBSERVABILITY_SETUP.md](./OBSERVABILITY_SETUP.md)

