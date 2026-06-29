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

variable "virtue_feedback_sender_email" {
  description = "Verified SES sender email for Virtue feedback notifications."
  type        = string
}

variable "virtue_feedback_recipient_email" {
  description = "Email address that receives Virtue feedback notifications."
  type        = string
}

variable "virtue_feedback_allowed_origins" {
  description = "Allowed browser origins for the Virtue feedback Lambda Function URL."
  type        = list(string)
  default = [
    "https://virtue.aws.shdkej.com",
    "https://virtue.oracle.shdkej.com",
    "http://localhost:3000",
  ]
}
