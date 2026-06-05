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
