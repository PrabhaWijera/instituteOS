###############################################################################
# NexClass — Free-Tier Infrastructure (Terraform)
#
# Stack:
#   Oracle Cloud (OCI) Always Free — ARM VM (4 vCPU, 24 GB RAM)
#   Cloudflare R2                  — Database backup storage (10 GB free, no egress fees)
#   Neon / Supabase                — Managed PostgreSQL (external, free tier)
#
# No NAT Gateway (removed — RDS is gone, ARM VM needs direct internet access)
# No RDS (replaced by Neon / Supabase — set DATABASE_URL in your .env)
# No S3  (replaced by Cloudflare R2)
#
# Prerequisites:
#   1. Oracle Cloud account — https://cloud.oracle.com (Always Free, no credit card expiry)
#   2. Cloudflare account  — https://dash.cloudflare.com (R2 free tier: 10 GB)
#   3. terraform init
#   4. cp terraform.tfvars.example terraform.tfvars  # fill in values
#   5. terraform plan && terraform apply
###############################################################################

terraform {
  required_version = ">= 1.6"

  required_providers {
    oci = {
      source  = "oracle/oci"
      version = "~> 6.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }

  # Remote state — store in Cloudflare R2 (S3-compatible) or local
  # backend "s3" {
  #   bucket                      = "nexclass-tf-state"
  #   key                         = "prod/terraform.tfstate"
  #   region                      = "auto"
  #   endpoint                    = "https://<CF_ACCOUNT_ID>.r2.cloudflarestorage.com"
  #   access_key                  = "<R2_ACCESS_KEY_ID>"
  #   secret_key                  = "<R2_SECRET_ACCESS_KEY>"
  #   skip_credentials_validation = true
  #   skip_metadata_api_check     = true
  #   skip_region_validation      = true
  #   force_path_style            = true
  # }
}

###############################################################################
# Variables
###############################################################################

# ── Oracle Cloud ──────────────────────────────────────────────────────────────
variable "tenancy_ocid" {
  description = "OCI tenancy OCID — Profile → Tenancy information in the OCI Console"
  type        = string
}

variable "user_ocid" {
  description = "OCI user OCID — Profile → User settings in the OCI Console"
  type        = string
}

variable "fingerprint" {
  description = "API key fingerprint — generated when you add an API key to your OCI user"
  type        = string
}

variable "private_key_path" {
  description = "Path to your OCI API private key file (PEM)"
  type        = string
  default     = "~/.oci/oci_api_key.pem"
}

variable "region" {
  description = "OCI region (e.g. ap-mumbai-1, us-ashburn-1)"
  type        = string
  default     = "ap-mumbai-1"
}

variable "compartment_ocid" {
  description = "OCI compartment OCID — use tenancy OCID for root compartment"
  type        = string
}

variable "app_name" {
  description = "Application name prefix used in resource names"
  type        = string
  default     = "nexclass"
}

variable "environment" {
  description = "Deployment environment (staging | production)"
  type        = string
  default     = "production"
}

variable "vm_ocpus" {
  description = "Number of OCPUs for the ARM VM (Always Free: up to 4)"
  type        = number
  default     = 2
}

variable "vm_memory_gb" {
  description = "RAM in GB for the ARM VM (Always Free: up to 24 GB)"
  type        = number
  default     = 12
}

variable "ssh_public_key" {
  description = "SSH public key content (paste contents of ~/.ssh/id_rsa.pub)"
  type        = string
}

variable "ssh_allowed_cidrs" {
  description = "CIDR blocks allowed to SSH into the VM (restrict to your IP in production)"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

# ── Cloudflare R2 ─────────────────────────────────────────────────────────────
variable "cloudflare_api_token" {
  description = "Cloudflare API token with R2:Edit permission"
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare account ID — visible in the R2 dashboard URL"
  type        = string
}

###############################################################################
# Providers
###############################################################################

provider "oci" {
  tenancy_ocid     = var.tenancy_ocid
  user_ocid        = var.user_ocid
  fingerprint      = var.fingerprint
  private_key_path = var.private_key_path
  region           = var.region
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

###############################################################################
# Oracle Cloud — Networking (VCN, Subnet, Gateway, Route Table)
###############################################################################

resource "oci_core_vcn" "main" {
  compartment_id = var.compartment_ocid
  display_name   = "${var.app_name}-vcn"
  cidr_blocks    = ["10.0.0.0/16"]
  dns_label      = var.app_name
}

resource "oci_core_internet_gateway" "main" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.main.id
  display_name   = "${var.app_name}-igw"
  enabled        = true
}

resource "oci_core_default_route_table" "main" {
  manage_default_resource_id = oci_core_vcn.main.default_route_table_id

  route_rules {
    destination       = "0.0.0.0/0"
    destination_type  = "CIDR_BLOCK"
    network_entity_id = oci_core_internet_gateway.main.id
  }
}

resource "oci_core_subnet" "public" {
  compartment_id    = var.compartment_ocid
  vcn_id            = oci_core_vcn.main.id
  display_name      = "${var.app_name}-public-subnet"
  cidr_block        = "10.0.1.0/24"
  dns_label         = "public"
  route_table_id    = oci_core_vcn.main.default_route_table_id
  security_list_ids = [oci_core_security_list.main.id]
}

###############################################################################
# Oracle Cloud — Security List (equivalent to Security Group)
###############################################################################

resource "oci_core_security_list" "main" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.main.id
  display_name   = "${var.app_name}-security-list"

  # Inbound: HTTP
  ingress_security_rules {
    protocol  = "6"  # TCP
    source    = "0.0.0.0/0"
    stateless = false
    tcp_options {
      min = 80
      max = 80
    }
  }

  # Inbound: HTTPS
  ingress_security_rules {
    protocol  = "6"
    source    = "0.0.0.0/0"
    stateless = false
    tcp_options {
      min = 443
      max = 443
    }
  }

  # Inbound: SSH (restrict to your IP in production)
  dynamic "ingress_security_rules" {
    for_each = var.ssh_allowed_cidrs
    content {
      protocol  = "6"
      source    = ingress_security_rules.value
      stateless = false
      tcp_options {
        min = 22
        max = 22
      }
    }
  }

  # Inbound: Backend API (only if not behind Nginx — remove if using Nginx)
  ingress_security_rules {
    protocol  = "6"
    source    = "0.0.0.0/0"
    stateless = false
    tcp_options {
      min = 4000
      max = 4000
    }
  }

  # Inbound: ICMP (ping)
  ingress_security_rules {
    protocol  = "1"  # ICMP
    source    = "0.0.0.0/0"
    stateless = false
    icmp_options {
      type = 3
      code = 4
    }
  }

  # Outbound: all traffic
  egress_security_rules {
    protocol    = "all"
    destination = "0.0.0.0/0"
    stateless   = false
  }
}

###############################################################################
# Oracle Cloud — ARM VM (Always Free: up to 4 OCPU, 24 GB RAM)
#
# Shape: VM.Standard.A1.Flex (ARM Ampere)
# This runs your Docker containers: Express backend + Next.js frontend
# + the full observability stack (Prometheus, Grafana, Loki, Jaeger)
###############################################################################

data "oci_identity_availability_domains" "ads" {
  compartment_id = var.tenancy_ocid
}

# Ubuntu 22.04 LTS (ARM) — check OCI console for the latest image OCID in your region
data "oci_core_images" "ubuntu_arm" {
  compartment_id           = var.compartment_ocid
  operating_system         = "Canonical Ubuntu"
  operating_system_version = "22.04"
  shape                    = "VM.Standard.A1.Flex"
  sort_by                  = "TIMECREATED"
  sort_order               = "DESC"
}

resource "oci_core_instance" "app" {
  compartment_id      = var.compartment_ocid
  availability_domain = data.oci_identity_availability_domains.ads.availability_domains[0].name
  display_name        = "${var.app_name}-server"
  shape               = "VM.Standard.A1.Flex"

  shape_config {
    ocpus         = var.vm_ocpus    # 2 OCPU (Always Free allows up to 4)
    memory_in_gbs = var.vm_memory_gb  # 12 GB (Always Free allows up to 24)
  }

  source_details {
    source_type             = "image"
    source_id               = data.oci_core_images.ubuntu_arm.images[0].id
    boot_volume_size_in_gbs = 50  # Always Free: up to 200 GB total block storage
  }

  create_vnic_details {
    subnet_id        = oci_core_subnet.public.id
    assign_public_ip = true
    display_name     = "${var.app_name}-vnic"
    hostname_label   = var.app_name
  }

  metadata = {
    ssh_authorized_keys = var.ssh_public_key
    user_data = base64encode(<<-EOF
      #!/bin/bash
      set -e

      # Update system
      apt-get update -y
      apt-get upgrade -y

      # Install Docker
      curl -fsSL https://get.docker.com | sh
      usermod -aG docker ubuntu
      systemctl enable docker
      systemctl start docker

      # Install Docker Compose
      curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-aarch64" \
        -o /usr/local/bin/docker-compose
      chmod +x /usr/local/bin/docker-compose

      # Install useful tools
      apt-get install -y nginx certbot python3-certbot-nginx postgresql-client git awscli

      # Clone your repo (replace with your actual repo URL)
      # git clone https://github.com/YOUR_ORG/nexclass.git /opt/nexclass
      # cd /opt/nexclass && docker-compose -f docker-compose.prod.yml up -d

      echo "Setup complete. SSH in and finish deployment."
    EOF
    )
  }

  freeform_tags = {
    Project     = var.app_name
    Environment = var.environment
  }
}

###############################################################################
# Cloudflare R2 — Database Backup Bucket
#
# S3-compatible storage — no egress fees.
# Backup script uses AWS CLI with --endpoint-url pointing to R2.
###############################################################################

resource "cloudflare_r2_bucket" "backups" {
  account_id = var.cloudflare_account_id
  name       = "${var.app_name}-db-backups"
  location   = "APAC"  # Change to EEUR or WNAM if appropriate
}

###############################################################################
# Outputs
###############################################################################

output "vm_public_ip" {
  description = "Public IP of the application server — use this for DNS and SSH"
  value       = oci_core_instance.app.public_ip
}

output "vm_shape" {
  description = "VM shape and resources"
  value       = "${var.vm_ocpus} OCPU, ${var.vm_memory_gb} GB RAM (ARM Ampere A1)"
}

output "r2_bucket_name" {
  description = "Cloudflare R2 bucket name for database backups"
  value       = cloudflare_r2_bucket.backups.name
}

output "r2_endpoint" {
  description = "R2 S3-compatible endpoint URL (use in backup script)"
  value       = "https://${var.cloudflare_account_id}.r2.cloudflarestorage.com"
}

output "ssh_command" {
  description = "SSH command to connect to your server"
  value       = "ssh ubuntu@${oci_core_instance.app.public_ip}"
}

output "next_steps" {
  description = "Post-provisioning checklist"
  value       = <<-MSG
    1. SSH into the server: ssh ubuntu@${oci_core_instance.app.public_ip}
    2. Clone the repo: git clone https://github.com/YOUR_ORG/nexclass.git /opt/nexclass
    3. Create .env file with your DATABASE_URL (from Neon/Supabase), then:
         cd /opt/nexclass && docker-compose -f docker-compose.prod.yml up -d
    4. Set up Nginx + SSL: sudo certbot --nginx -d yourdomain.com
    5. Add cron for daily backups:
         30 1 * * * /opt/nexclass/scripts/db-backup.sh >> /var/log/nexclass-backup.log 2>&1
  MSG
}
