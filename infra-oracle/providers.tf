terraform {
  required_version = ">= 1.5.0"

  backend "s3" {
    bucket                      = "terraform-state"
    key                         = "infra-oracle/terraform.tfstate"
    region                      = "ap-seoul-1"
    skip_region_validation      = true
    skip_credentials_validation = true
    skip_metadata_api_check     = true
    skip_requesting_account_id  = true
    force_path_style            = true
    # endpoint는 -backend-config로 전달
    # 인증은 AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY 환경변수 사용
  }

  required_providers {
    oci = {
      source  = "oracle/oci"
      version = "~> 5.0"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.2"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.5"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.33"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.16"
    }
  }
}

provider "oci" {
  tenancy_ocid     = var.tenancy_ocid
  user_ocid        = var.user_ocid
  fingerprint      = var.oci_fingerprint
  private_key_path = var.oci_private_key_path
  region           = var.oci_region
}

provider "null" {}

provider "kubernetes" {
  config_path = "${path.module}/${var.kubeconfig_path}"
}

provider "helm" {
  kubernetes {
    config_path = "${path.module}/${var.kubeconfig_path}"
  }
}
