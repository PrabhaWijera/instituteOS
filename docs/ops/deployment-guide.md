# AWS Free Tier Deployment Guide

This guide provides step-by-step instructions for deploying NexClass to **AWS Free Tier** using a combination of **AWS EC2**, **AWS RDS (PostgreSQL)**, and **Docker Compose** with **Nginx** and **Certbot (SSL)**.

---

## Architecture Overview

To stay completely within the AWS Free Tier while ensuring optimal performance and stability, we use the following setup:

```mermaid
graph TD
    User([User Browser]) -->|HTTPS: 443| Nginx[Nginx Reverse Proxy]
    subgraph AWS EC2 Instance (t2.micro/t3.micro - 1GB RAM)
        Nginx -->|Proxy: Port 3000| Frontend[Frontend Container: Next.js]
        Nginx -->|Proxy: Port 4000| Backend[Backend Container: Express]
    end
    subgraph AWS RDS (db.t3.micro/db.t4g.micro)
        Backend -->|Port 5432| RDS[PostgreSQL Database]
    end
    Backend -.->|API Call| Redis[Upstash Redis (External Free Tier)]
    Backend -.->|Media Uploads| Cloudinary[Cloudinary (External Free Tier)]
    Backend -.->|AI Requests| Groq[Groq AI (External Free Tier)]
```

### Free Tier Resources Used
1. **AWS EC2**: `t2.micro` or `t3.micro` instance (Ubuntu 24.04 LTS) — Free for 750 hours/month for 12 months.
2. **AWS RDS**: `db.t3.micro` or `db.t4g.micro` PostgreSQL instance — Free for 750 hours/month for 12 months.
3. **AWS Elastic Container Registry (ECR)**: Private repositories for backend and frontend Docker images — Free up to 500 MB/month.

---

## Prerequisites
- An active **AWS Account**.
- A **Domain Name** (e.g., `example.com` or a free subdomain from DuckDNS/No-IP) with access to DNS records.
- Local machine with **Docker** installed for building and pushing images.

---

## Step 1: Set Up AWS RDS (PostgreSQL)

Using a managed database like RDS ensures backups, automated scaling, and offloads PostgreSQL memory usage from your 1GB EC2 instance.

1. Navigate to the **RDS Console** on AWS.
2. Click **Create Database**.
3. Choose **Standard create** > **PostgreSQL**.
4. Select **Engine Version**: `PostgreSQL 16.x` (or matches your local version).
5. Templates: Select **Free Tier** (this configures a single instance, `db.t3.micro`/`db.t4g.micro` with 20 GB Storage).
6. **Settings**:
   - DB Instance Identifier: `nexclass-db`
   - Master Username: `nexclass`
   - Master Password: Set a strong password (e.g., `nexclass_secure_password`).
7. **Connectivity**:
   - VPC: Default VPC
   - Public Access: Select **No** (backend and database will communicate inside the same VPC).
   - VPC Security Group: Create New (e.g., `nexclass-rds-sg`).
8. Click **Create Database**.

---

## Step 2: Set Up AWS EC2 Instance

1. Navigate to the **EC2 Console** and click **Launch Instance**.
2. **Name**: `nexclass-prod`.
3. **AMI**: `Ubuntu Server 24.04 LTS` (64-bit x86).
4. **Instance Type**: `t2.micro` (or `t3.micro` if in a region where t2 isn't available). Ensure it is marked **Free tier eligible**.
5. **Key Pair**: Create a new key pair (`nexclass-key.pem`), download it, and keep it safe.
6. **Network Settings**:
   - Create Security Group.
   - Allow **SSH traffic** from: **My IP** (or Anywhere `0.0.0.0/0` if you move locations, though My IP is more secure).
   - Allow **HTTPS traffic** from the internet (`0.0.0.0/0`).
   - Allow **HTTP traffic** from the internet (`0.0.0.0/0`).
7. Click **Launch Instance**.

### Configure Security Groups
To allow your EC2 instance to connect to your RDS database:
1. Go to the **RDS Console** > Databases > `nexclass-db` > **Connectivity & Security**.
2. Click the link under **VPC security groups** (the one created in Step 1).
3. Select the security group and edit **Inbound Rules**.
4. Add a rule:
   - **Type**: PostgreSQL (Port 5432).
   - **Source**: Select the security group of your **EC2 instance**.
5. Save rules. This secures your database so only your EC2 instance can talk to it.

---

## Step 3: Build & Push Docker Images

Building Next.js and Prisma apps on a `t2.micro` (1GB RAM) instance directly can cause memory crashes. It is highly recommended to build images locally or in GitHub Actions, and pull them to EC2.

### 1. Build and Push Backend Image
On your local machine, navigate to the `backend` folder:
```bash
# Log in to Docker Hub or AWS ECR
docker login

# Build the backend image
docker build -t yourdockerusername/nexclass-backend:latest ./backend

# Push the backend image
docker push yourdockerusername/nexclass-backend:latest
```

### 2. Build and Push Frontend Image
On your local machine, navigate to the `frontend` folder. Since Next.js requires environment variables during build time for public APIs:
```bash
# Build the frontend image (replace domains with your actual domain names)
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api \
  --build-arg NEXT_PUBLIC_WS_URL=wss://api.yourdomain.com/ws \
  -t yourdockerusername/nexclass-frontend:latest ./frontend

# Push the frontend image
docker push yourdockerusername/nexclass-frontend:latest
```

---

## Step 4: Configure the EC2 Instance

Connect to your EC2 instance using SSH:
```bash
chmod 400 nexclass-key.pem
ssh -i nexclass-key.pem ubuntu@<your-ec2-public-ip>
```

Once connected, run the following commands to set up the server:

### 1. Install Docker & Docker Compose
```bash
# Update packages
sudo apt-get update && sudo apt-get upgrade -y

# Install Docker
sudo apt-get install -y docker.io docker-compose-v2

# Add ubuntu user to docker group (so you don't need sudo for docker commands)
sudo usermod -aG docker $USER
newgrp docker
```

### 2. Setup Virtual Memory (Swap File)
A swap file acts as virtual RAM to prevent the EC2 instance from crashing during high-load periods:
```bash
# Create a 2GB swap file
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make swap persistent across reboots
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 3. Create Deployment Directory
```bash
mkdir -p ~/nexclass
cd ~/nexclass
```

### 4. Create Production Environment File (`.env`)
Create a production `.env` file in `~/nexclass/.env`:
```bash
nano .env
```
Paste and fill out the production environment variables:
```ini
# Production Environment Configuration
NODE_ENV=production

# Database (Use your RDS endpoint here)
DATABASE_URL="postgresql://nexclass:<rds_password>@<your-rds-endpoint>:5432/nexclass?sslmode=require"

# JWT Secrets (Generate secure 32+ character strings)
JWT_ACCESS_SECRET="run-openssl-rand-hex-32-to-generate-this"
JWT_REFRESH_SECRET="run-openssl-rand-hex-32-to-generate-another"
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Third Party Services (Use your credentials from local .env)
UPSTASH_REDIS_REST_URL="https://..."
UPSTASH_REDIS_REST_TOKEN="..."

SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
EMAIL_FROM="NexClass <your-email@gmail.com>"
APP_NAME=NexClass

CLOUDINARY_CLOUD_NAME="..."
CLOUDINARY_API_KEY="..."
CLOUDINARY_API_SECRET="..."

GROQ_API_KEY="..."
GROQ_MODEL=llama-3.3-70b-versatile

# Host URLs
FRONTEND_URL="https://app.yourdomain.com"
PORT=4000
```

### 5. Create `docker-compose.prod.yml`
Create a production Docker Compose file:
```bash
nano docker-compose.prod.yml
```
Add the following content (notice we use the pre-built images and omit the local PostgreSQL container since we are using RDS):
```yaml
version: '3.8'

services:
  backend:
    image: yourdockerusername/nexclass-backend:latest
    container_name: nexclass-backend
    restart: unless-stopped
    ports:
      - '4000:4000'
    env_file:
      - .env

  frontend:
    image: yourdockerusername/nexclass-frontend:latest
    container_name: nexclass-frontend
    restart: unless-stopped
    ports:
      - '3000:3000'
    env_file:
      - .env
    depends_on:
      - backend
```

### 6. Start the Services
```bash
# Pull latest images and run in detached mode
docker compose -f docker-compose.prod.yml up -d
```
Prisma migrations will run automatically on startup via `backend/docker-entrypoint.sh`.

---

## Step 5: Configure Nginx & SSL (HTTPS)

We will use Nginx on the host system to route incoming traffic on port 80/443 to the backend and frontend Docker containers, and use Let's Encrypt to get SSL certificates.

### 1. Point DNS Records
Go to your DNS provider (Cloudflare, Namecheap, GoDaddy, etc.) and add two **A Records**:
- Name: `app` | Value: `<your-ec2-public-ip>`
- Name: `api` | Value: `<your-ec2-public-ip>`

### 2. Install Nginx and Certbot
```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

### 3. Configure Nginx
Create a configuration file for NexClass:
```bash
sudo nano /etc/nginx/sites-available/nexclass
```
Paste the following server blocks:
```nginx
# Frontend Nginx Config
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

# Backend Nginx Config
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
```
Activate the configuration:
```bash
sudo ln -s /etc/nginx/sites-available/nexclass /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

### 4. Enable SSL with Let's Encrypt
Run Certbot to automatically fetch and configure HTTPS certificates for your domains:
```bash
sudo certbot --nginx -d app.yourdomain.com -d api.yourdomain.com
```
Follow the interactive prompts (enter email, agree to Terms of Service, enable redirecting HTTP to HTTPS).

---

## Step 6: Post-Deployment Verification

1. **Verify Services Run**:
   ```bash
   docker compose -f docker-compose.prod.yml ps
   ```
2. **View Logs**:
   ```bash
   # View backend logs to verify connection to RDS
   docker compose -f docker-compose.prod.yml logs backend --tail=50
   ```
3. **Verify API Health Check**:
   Open a browser and navigate to `https://api.yourdomain.com/api/health` or run:
   ```bash
   curl https://api.yourdomain.com/api/health
   ```
4. **Access the App**:
   Navigate to `https://app.yourdomain.com` in your browser. You should see the login screen. You can log in using your configured superadmin credentials.
