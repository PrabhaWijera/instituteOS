# Free-Tier Migration Guide

This guide walks you through replacing every paid AWS service with a free alternative.
Follow the steps in order — NAT Gateway first (instant, zero risk), then the database, then the server last.

---

## What changes

| AWS (paid) | Replacement (free) | Effort |
|---|---|---|
| NAT Gateway (~$32/mo) | Remove entirely | 5 min |
| RDS PostgreSQL | Neon or Supabase | 30–60 min |
| S3 backup storage | Cloudflare R2 | 15 min |
| EC2 t3.small | Oracle Cloud ARM VM (4 vCPU, 24 GB) | 1–2 hr |
| CloudWatch logs | Self-hosted Loki (already in docker-compose) | 0 min |
| RDS Performance Insights | `pg_stat_statements` (built into PostgreSQL) | 5 min |
| RDS Automated Snapshots | Included in Neon/Supabase + backup script | 0 min |

**Stays the same:** Upstash Redis, Cloudinary, Groq, SMTP, Sentry — already free.

---

## Step 1 — Remove NAT Gateway (instant, $32/mo saved)

Your new setup has no RDS in a private subnet, so no NAT Gateway is needed.

**If you're still running the old AWS stack:**
1. AWS Console → VPC → NAT Gateways → select yours → Actions → Delete
2. Release the associated Elastic IP: VPC → Elastic IPs → Release

That's it. Nothing in your application code needs to change.

---

## Step 2 — Migrate database to Neon (or Supabase)

### 2a. Choose your provider

| | Neon | Supabase |
|---|---|---|
| Free storage | 0.5 GB | 500 MB |
| Scales to zero | Yes (great for dev/staging) | No |
| Dashboard | Minimal, clean | Full (auth, storage, etc.) |
| PostgreSQL compatibility | 100% | 100% |
| Best for | Raw PostgreSQL users | Teams wanting extras |

### 2b. Create a free project

**Neon:**
1. Go to [https://neon.tech](https://neon.tech) → Sign up
2. Create project → choose region closest to your users
3. Copy the connection string (looks like `postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/nexclass?sslmode=require`)

**Supabase:**
1. Go to [https://app.supabase.com](https://app.supabase.com) → Sign up
2. New project → choose region
3. Settings → Database → Connection string (URI format)

### 2c. Run the migration script

```bash
# Set your source and target URLs
export SOURCE_DATABASE_URL="postgresql://nexclass:password@your-rds-endpoint:5432/nexclass"
export TARGET_DATABASE_URL="postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/nexclass?sslmode=require"

# Run the migration
chmod +x scripts/db-migrate.sh
./scripts/db-migrate.sh
```

The script will:
1. Dump the source database
2. Enable `pg_stat_statements` on the target
3. Restore to the target
4. Compare row counts between source and target to verify

### 2d. Update your environment

```bash
# In your production .env
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/nexclass?sslmode=require
```

### 2e. Run Prisma migrations on the new database

```bash
cd backend
DATABASE_URL="your-neon-url" npx prisma migrate deploy
```

### 2f. Test and verify

```bash
# Health check
curl https://yourdomain.com/api/health

# Spot check a few API endpoints
curl -H "Authorization: Bearer $TOKEN" https://yourdomain.com/api/v1/dashboard
```

### 2g. Decommission RDS

Only after you've verified the new DB is working:
1. AWS Console → RDS → Databases → select yours → Actions → Delete
2. Take a final snapshot if you want an archive

---

## Step 3 — Switch backups to Cloudflare R2

### 3a. Create R2 bucket

1. Go to [https://dash.cloudflare.com](https://dash.cloudflare.com) → R2
2. Create bucket: `nexclass-db-backups`, location `APAC` (or your region)

### 3b. Create R2 API token

1. R2 dashboard → Manage R2 API Tokens → Create API token
2. Permissions: `Object Read & Write`
3. Copy the **Access Key ID** and **Secret Access Key**

### 3c. Add to your environment

```bash
R2_ACCOUNT_ID=your-cloudflare-account-id   # visible in R2 dashboard URL
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
BACKUP_R2_BUCKET=nexclass-db-backups
```

### 3d. Test the backup script

```bash
chmod +x scripts/db-backup.sh
./scripts/db-backup.sh
```

You should see output ending with `R2 upload complete`.
Verify in the Cloudflare dashboard: R2 → your bucket → `db-backups/` folder.

### 3e. Set up the cron job (on your server)

```bash
crontab -e
# Add this line:
30 1 * * * /opt/nexclass/scripts/db-backup.sh >> /var/log/nexclass-backup.log 2>&1
```

---

## Step 4 — Enable pg_stat_statements on production DB

### On Neon
Already enabled by default. Run this to start tracking:
```sql
-- Connect via Neon SQL editor or psql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

### On Supabase
Go to: SQL Editor → run:
```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

### Querying slow queries
```sql
-- Top 20 slowest queries by average execution time
SELECT
  query,
  calls,
  round(mean_exec_time::numeric, 2) AS avg_ms,
  round(total_exec_time::numeric, 2) AS total_ms
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;
```

---

## Step 5 — Provision the Oracle Cloud VM

### 5a. Create Oracle Cloud account

1. Go to [https://cloud.oracle.com](https://cloud.oracle.com) → Sign Up
2. Choose **Always Free** (requires credit card for verification but will NOT charge you)
3. Select a home region — pick one close to your users (e.g. `ap-mumbai-1`)

### 5b. Collect Terraform credentials

In OCI Console:

1. **Tenancy OCID:** Profile menu → Tenancy → copy OCID
2. **User OCID:** Profile menu → User settings → copy OCID
3. **API Key:** Profile → User settings → API Keys → Add API Key
   - Generate key pair → download private key → copy fingerprint
   - Save private key to `~/.oci/oci_api_key.pem`

### 5c. Fill in Terraform variables

```bash
cd infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your OCIDs, fingerprint, and Cloudflare values
```

### 5d. Provision with Terraform

```bash
terraform init
terraform plan    # review — should show 1 VM, 1 R2 bucket
terraform apply
```

Output will show your VM's public IP.

### 5e. SSH in and deploy

```bash
# From Terraform output
ssh ubuntu@<VM_PUBLIC_IP>

# Clone your repo
git clone https://github.com/YOUR_ORG/nexclass.git /opt/nexclass
cd /opt/nexclass

# Create .env with your real values (Neon URL, etc.)
cp .env.example .env
nano .env   # fill in DATABASE_URL (Neon), Redis, Cloudinary, etc.

# Run migrations
cd backend && DATABASE_URL="$(grep DATABASE_URL ../.env | cut -d= -f2-)" npx prisma migrate deploy
cd ..

# Start production stack
docker-compose -f docker-compose.prod.yml up -d

# Check everything is healthy
docker-compose -f docker-compose.prod.yml ps
curl http://localhost:4000/api/health
```

### 5f. Set up Nginx + SSL

```bash
# Install Certbot (already installed by Terraform user_data script)
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Nginx config is at /etc/nginx/sites-available/default
# Certbot auto-renews via cron — verify with:
sudo certbot renew --dry-run
```

### 5g. Point your DNS

In your DNS provider (e.g. Cloudflare, Namecheap):
- Add an `A` record pointing `yourdomain.com` → `<VM_PUBLIC_IP>`
- Add a `CNAME` or `A` record for `www` → same IP

### 5h. Decommission EC2

Only after your domain is live and you've tested everything:
1. AWS Console → EC2 → Instances → terminate your instance
2. EC2 → Elastic IPs → release the old IP
3. VPC → delete remaining resources (subnets, route tables, VPC)

---

## Final checklist

```
[ ] NAT Gateway deleted — instant $32/mo saving
[ ] RDS migrated to Neon/Supabase — row counts verified
[ ] DATABASE_URL updated in .env — Prisma migrations deployed
[ ] Backup script running to R2 — verified in Cloudflare dashboard
[ ] pg_stat_statements enabled on new DB
[ ] Oracle Cloud VM provisioned — docker-compose up and healthy
[ ] Domain DNS pointing to new VM
[ ] Nginx + SSL (Let's Encrypt) configured
[ ] Old EC2 instance terminated
[ ] Old RDS instance deleted
[ ] Old S3 bucket emptied and deleted
[ ] Old Elastic IP released
```

---

## Cost comparison

| Service | AWS (before) | Free tier (after) |
|---|---|---|
| EC2 t3.small | ~$17/mo | $0 (Oracle Always Free) |
| RDS db.t3.micro | ~$15/mo | $0 (Neon/Supabase) |
| NAT Gateway | ~$32/mo | $0 (removed) |
| S3 backups | ~$1/mo | $0 (Cloudflare R2) |
| CloudWatch | ~$3/mo | $0 (self-hosted Loki) |
| **Total** | **~$68/mo** | **$0/mo** |

All external services (Upstash Redis, Cloudinary, Groq, Sentry) were already free and remain unchanged.
