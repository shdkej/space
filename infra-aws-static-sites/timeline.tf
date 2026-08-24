data "archive_file" "timeline_lambda" {
  type        = "zip"
  source_file = "${path.module}/lambda/timeline.py"
  output_path = "${path.module}/.terraform/timeline-lambda.zip"
}

resource "aws_iam_role" "timeline_lambda" {
  name = "launch-timeline-lambda-role"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Action = "sts:AssumeRole", Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" } }]
  })
}

resource "aws_iam_role_policy_attachment" "timeline_lambda_basic" {
  role       = aws_iam_role.timeline_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_s3_bucket" "timeline_cache" {
  bucket = "launch-timeline-cache-${data.aws_caller_identity.current.account_id}-${var.aws_region}"
}

resource "aws_s3_bucket_public_access_block" "timeline_cache" {
  bucket                  = aws_s3_bucket.timeline_cache.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "timeline_cache" {
  bucket = aws_s3_bucket.timeline_cache.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_iam_role_policy" "timeline_cache" {
  name = "launch-timeline-cache"
  role = aws_iam_role.timeline_lambda.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:GetObject", "s3:PutObject"]
      Resource = "${aws_s3_bucket.timeline_cache.arn}/profiles/*"
    }]
  })
}

resource "aws_lambda_function" "timeline" {
  function_name    = "launch-timeline"
  role             = aws_iam_role.timeline_lambda.arn
  handler          = "timeline.handler"
  runtime          = "python3.12"
  filename         = data.archive_file.timeline_lambda.output_path
  source_code_hash = data.archive_file.timeline_lambda.output_base64sha256
  timeout          = 15
  memory_size      = 256

  environment {
    variables = {
      X_BEARER_TOKEN             = var.launch_timeline_x_bearer_token
      TIMELINE_CACHE_BUCKET      = aws_s3_bucket.timeline_cache.bucket
      TIMELINE_CACHE_TTL_SECONDS = "86400"
    }
  }
}

resource "aws_lambda_function_url" "timeline" {
  function_name      = aws_lambda_function.timeline.function_name
  authorization_type = "NONE"
  cors {
    allow_credentials = false
    allow_headers     = ["content-type"]
    allow_methods     = ["GET"]
    allow_origins     = ["*"]
    max_age           = 300
  }
}

resource "aws_lambda_permission" "timeline_function_url" {
  statement_id           = "AllowPublicLaunchTimelineFunctionUrlInvoke"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.timeline.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

resource "aws_lambda_permission" "timeline_function_invoke" {
  statement_id  = "AllowPublicLaunchTimelineFunctionInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.timeline.function_name
  principal     = "*"
}
