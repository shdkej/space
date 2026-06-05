module "app_static_sites" {
  for_each = var.app_sites
  source   = "../modules/static-site-aws"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  domain_name       = each.value.domain_name
  route53_zone_name = var.route53_zone_name
  bucket_name       = try(each.value.bucket_name, null)
  api_origins       = try(each.value.api_origins, [])
  spa_fallback      = try(each.value.spa_fallback, true)
  tags = merge(
    var.tags,
    {
      app = each.key
    },
    try(each.value.tags, {})
  )
}
