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

variable "tags" {
  description = "Common tags."
  type        = map(string)
  default = {
    project = "space"
    stack   = "aws-static-sites"
  }
}

variable "app_feedback_sender_email" {
  description = "Verified SES sender email for app feedback notifications."
  type        = string
}

variable "app_feedback_recipient_email" {
  description = "Email address that receives app feedback notifications."
  type        = string
}

variable "app_feedback_allowed_origins" {
  description = "Allowed browser origins for the shared app feedback Lambda Function URL."
  type        = list(string)
  default = [
    "https://virtue.aws.shdkej.com",
    "http://localhost:3000",
  ]
}

variable "infinity_action_allowed_origins" {
  description = "Allowed browser origins for the Infinity dashboard action Lambda Function URL."
  type        = list(string)
  default = [
    "https://infinity.aws.shdkej.com",
    "http://localhost:8000",
  ]
}

variable "infinity_action_token_sha256" {
  description = "SHA-256 hash of the shared key required for Infinity dashboard actions."
  type        = string
  sensitive   = true
}
