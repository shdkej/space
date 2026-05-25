terraform {
  required_version = ">= 1.5"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
  }

  # 원격 상태: infra-oracle 과 동일한 Oracle Object Storage(S3 호환) 백엔드, key만 분리.
  # 인증: AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY 환경변수에 OCI Customer Secret Key를 넣는다.
  backend "s3" {
    bucket                      = "terraform-state"
    key                         = "cloudflare-images/terraform.tfstate"
    region                      = "ap-seoul-1"
    endpoints = {
      s3 = "https://cnnxdotc2gaj.compat.objectstorage.ap-seoul-1.oraclecloud.com"
    }
    skip_credentials_validation = true
    skip_metadata_api_check     = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    force_path_style            = true
    skip_s3_checksum            = true
  }
}

# API Token 방식 권장. CLOUDFLARE_API_TOKEN 환경변수로 주입하면 아래 블록은 비워둬도 된다.
provider "cloudflare" {
  api_token = var.cloudflare_api_token
}
