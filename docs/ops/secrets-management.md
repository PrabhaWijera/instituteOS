# Secrets Management

## Current State
Secrets are stored in `.env` files (`.env` for dev, `.env.test` for tests). **These must never be committed to git.**

## Production Recommendations

### Option 1: Cloud Provider Secret Managers (Recommended)
| Provider | Service | Docs |
|----------|---------|------|
| AWS | Secrets Manager / SSM Parameter Store | [Link](https://aws.amazon.com/secrets-manager/) |
| GCP | Secret Manager | [Link](https://cloud.google.com/secret-manager) |
| Azure | Key Vault | [Link](https://azure.microsoft.com/en-us/products/key-vault/) |
| Vercel | Environment Variables (encrypted) | [Link](https://vercel.com/docs/environment-variables) |

### Option 2: Docker Secrets (Self-hosted)
```yaml
# docker-compose.prod.yml
services:
  backend:
    secrets:
      - db_url
      - jwt_secret
secrets:
  db_url:
    external: true
  jwt_secret:
    external: true
```

### Option 3: HashiCorp Vault
For enterprise deployments with dynamic secrets and automatic rotation.

## Secret Rotation Policy

| Secret | Rotation Frequency | Notes |
|--------|--------------------|-------|
| JWT_ACCESS_SECRET | Every 90 days | Coordinate with refresh token invalidation |
| JWT_REFRESH_SECRET | Every 90 days | Will force all users to re-login |
| DATABASE_URL password | Every 90 days | Update in secret manager, restart services |
| SMTP_PASS | Every 180 days | Per email provider policy |
| CLOUDINARY_API_SECRET | Yearly | Regenerate in Cloudinary dashboard |
| GROQ_API_KEY | Yearly | Regenerate in Groq dashboard |
| UPSTASH_REDIS_REST_TOKEN | Yearly | Regenerate in Upstash dashboard |

## Required Environment Variables

### Backend
```
DATABASE_URL              # PostgreSQL connection string
JWT_ACCESS_SECRET         # Min 32 chars, random
JWT_REFRESH_SECRET        # Min 32 chars, random, different from access
UPSTASH_REDIS_REST_URL    # Redis REST API URL
UPSTASH_REDIS_REST_TOKEN  # Redis auth token
SMTP_HOST                 # Email server host
SMTP_PORT                 # Email server port
SMTP_USER                 # Email auth user
SMTP_PASS                 # Email auth password
CLOUDINARY_CLOUD_NAME     # Cloudinary cloud name
CLOUDINARY_API_KEY        # Cloudinary API key
CLOUDINARY_API_SECRET     # Cloudinary API secret
GROQ_API_KEY              # Groq AI API key
SENTRY_DSN                # (Optional) Sentry error tracking
FRONTEND_URL              # Frontend URL for CORS
```

### Frontend
```
NEXT_PUBLIC_API_URL       # Backend API URL
NEXT_PUBLIC_WS_URL        # WebSocket URL
NEXT_PUBLIC_SENTRY_DSN    # (Optional) Sentry client DSN
SENTRY_ORG                # (Optional) Sentry org slug
SENTRY_PROJECT            # (Optional) Sentry project slug
```

## Git Safety
Ensure `.gitignore` includes:
```
.env
.env.*
!.env.example
```

## Generating Secure Secrets
```bash
# Generate a 64-char random secret
openssl rand -hex 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
