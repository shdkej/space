output "app_sites" {
  value = {
    for name, site in module.app_static_sites : name => {
      bucket_name                = site.bucket_name
      cloudfront_distribution_id = site.cloudfront_distribution_id
      cloudfront_domain_name     = site.cloudfront_domain_name
      site_url                   = site.site_url
    }
  }
}

output "app_feedback" {
  value = {
    bucket_name  = aws_s3_bucket.app_feedback.bucket
    function_url = aws_lambda_function_url.app_feedback.function_url
  }
}
