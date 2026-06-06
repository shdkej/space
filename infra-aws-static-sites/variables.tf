variable "aws_region" {
  description = "Region for the S3 origin bucket."
  type        = string
  default     = "ap-northeast-2"
}

variable "route53_zone_name" {
  description = "Route53 hosted zone name."
  type        = string
  default     = "aws.shdkej.com"
}

variable "app_sites" {
  description = "Additional app subdomains under aws.shdkej.com."
  type = map(object({
    domain_name = string
    bucket_name = optional(string)
    api_origins = optional(list(object({
      origin_id    = string
      domain_name  = string
      path_pattern = string
      origin_path  = optional(string, "")
    })), [])
    spa_fallback = optional(bool, true)
    tags         = optional(map(string), {})
  }))
  default = {
    status = {
      domain_name = "status.aws.shdkej.com"
    }
    travel = {
      domain_name = "travel.aws.shdkej.com"
    }
    library = {
      domain_name = "library.aws.shdkej.com"
    }
  }
}

variable "tags" {
  description = "Common tags."
  type        = map(string)
  default = {
    project = "space"
    stack   = "aws-static-sites"
  }
}
