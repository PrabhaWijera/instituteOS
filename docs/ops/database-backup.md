# Database Backup Strategy

## Overview
NexClass uses PostgreSQL. Backups must be automated, tested, and stored off-site.

## Backup Types

### 1. Automated Daily Backups (Required)
```bash
# pg_dump with compression
pg_dump -Fc -Z9 -h $DB_HOST -U $DB_USER $DB_NAME > backup_$(date +%Y%m%d_%H%M%S).dump
```

### 2. Continuous Archiving (WAL)
For point-in-time recovery, enable WAL archiving in `postgresql.conf`:
```
wal_level = replica
archive_mode = on
archive_command = 'cp %p /var/lib/postgresql/wal_archive/%f'
```

### 3. Managed Service Backups
If using a managed provider (Supabase, Neon, AWS RDS):
- **Supabase**: Daily backups included (Pro plan: point-in-time recovery)
- **Neon**: Branching = instant snapshots
- **AWS RDS**: Enable automated backups with 7–35 day retention

## Backup Schedule

| Type | Frequency | Retention | Storage |
|------|-----------|-----------|---------|
| Full dump | Daily at 02:00 UTC | 30 days | S3 / GCS |
| WAL archive | Continuous | 7 days | S3 / GCS |
| Pre-migration | Before every `prisma migrate deploy` | Permanent | S3 / GCS |

## Restoration

```bash
# Restore from custom dump
pg_restore -h $DB_HOST -U $DB_USER -d $DB_NAME --clean --if-exists backup.dump

# Point-in-time recovery (if WAL archiving enabled)
pg_restore --target-time="2025-01-15 14:30:00" ...
```

## Testing
- **Monthly**: Restore a backup to a staging database and run smoke tests
- **Quarterly**: Full disaster recovery drill

## Cron Job Example
```bash
# /etc/cron.d/nexclass-backup
0 2 * * * postgres /opt/nexclass/scripts/backup.sh >> /var/log/nexclass-backup.log 2>&1
```

## Monitoring
- Alert if backup file size drops below expected threshold
- Alert if backup job hasn't run in 25 hours
- Store backup checksums for integrity verification
