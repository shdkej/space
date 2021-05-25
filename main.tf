terraform {
  required_providers {
    digitalocean = {
      source = "digitalocean/digitalocean"
      version = "~> 1.22"
    }
    cloudflare = {
      source = "cloudflare/cloudflare"
      version = "~> 2.0"
    }
  }
}

terraform {
  backend "s3" {
    endpoint = "sgp1.digitaloceanspaces.com"
    region = "ap-southeast-1"
    key = "terraform.tfstate"
    bucket = "shdkej-state-sgp"

    skip_credentials_validation = true
    skip_metadata_api_check = true
  }
}

provider "cloudflare" {
  email = "shdkej@gmail.com"
  api_key = var.cloudflare_key
}

module "dns" {
  source = "./dns"
  value = module.do.node-ip
}

provider "digitalocean" {
  token = var.do_token
}

module "do" {
  source = "./do"
}
