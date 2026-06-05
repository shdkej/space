variable "domain_name" {
  description = "Public hostname for the static site."
  type        = string
}

variable "route53_zone_name" {
  description = "Route53 hosted zone name that owns domain_name."
  type        = string
}

variable "bucket_name" {
  description = "Optional S3 bucket name. Defaults to static-<domain>."
  type        = string
  default     = null
}

variable "index_document" {
  description = "Default root object for CloudFront."
  type        = string
  default     = "index.html"
}

variable "spa_fallback" {
  description = "Return index_document for 403/404 so SPA routing works."
  type        = bool
  default     = true
}

variable "price_class" {
  description = "CloudFront price class."
  type        = string
  default     = "PriceClass_200"
}

variable "api_origins" {
  description = "Optional API origins routed by CloudFront, e.g. /api/* to API Gateway or Lambda Function URL."
  type = list(object({
    origin_id    = string
    domain_name  = string
    path_pattern = string
    origin_path  = optional(string, "")
  }))
  default = []
}

variable "tags" {
  description = "Tags applied to AWS resources."
  type        = map(string)
  default     = {}
}
