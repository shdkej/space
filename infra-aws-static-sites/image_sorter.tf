# Service code lives in github.com/shdkej/image-annotator-api.
# Only immutable artifacts and infrastructure belong in Space.
resource "aws_s3_bucket" "lambda_artifacts" {
  bucket = "space-lambda-artifacts-917213086376-ap-northeast-2"
  tags   = merge(var.tags, { purpose = "lambda-artifacts" })
}
resource "aws_s3_bucket_public_access_block" "lambda_artifacts" {
  bucket                  = aws_s3_bucket.lambda_artifacts.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
resource "aws_s3_bucket_versioning" "lambda_artifacts" {
  bucket = aws_s3_bucket.lambda_artifacts.id
  versioning_configuration { status = "Enabled" }
}
resource "aws_s3_bucket_server_side_encryption_configuration" "lambda_artifacts" {
  bucket = aws_s3_bucket.lambda_artifacts.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}
resource "aws_dynamodb_table" "image_sorter" {
  name         = "image-annotator-sorter"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"
  attribute {
    name = "id"
    type = "S"
  }
  point_in_time_recovery { enabled = true }
  tags = merge(var.tags, { app = "image-annotator" })
}
resource "aws_secretsmanager_secret" "image_annotator_clef" {
  name                    = "image-annotator/cloudflare-clef"
  description             = "Cloudflare Workers AI account and token for Clef image sorting"
  recovery_window_in_days = 7
}
resource "aws_iam_role_policy" "image_sorter" {
  name = "image-annotator-sorter"
  role = aws_iam_role.image_annotator_lambda.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["secretsmanager:GetSecretValue"], Resource = aws_secretsmanager_secret.image_annotator_clef.arn },
      { Effect = "Allow", Action = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:Scan"], Resource = aws_dynamodb_table.image_sorter.arn }
    ]
  })
}
