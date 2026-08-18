data "archive_file" "infinity_action_lambda" {
  type        = "zip"
  source_file = "${path.module}/lambda/infinity_action.py"
  output_path = "${path.module}/.terraform/infinity-action-lambda.zip"
}

resource "aws_s3_bucket" "infinity_action_queue" {
  bucket = "infinity-action-queue-${data.aws_caller_identity.current.account_id}-${var.aws_region}"

  tags = merge(var.tags, {
    app     = "infinity"
    service = "dashboard-action"
  })
}

resource "aws_s3_bucket_public_access_block" "infinity_action_queue" {
  bucket = aws_s3_bucket.infinity_action_queue.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "infinity_action_queue" {
  bucket = aws_s3_bucket.infinity_action_queue.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "infinity_action_queue" {
  bucket = aws_s3_bucket.infinity_action_queue.id

  rule {
    id     = "expire-action-requests-after-90-days"
    status = "Enabled"

    filter {
      prefix = "action_requests/"
    }

    expiration {
      days = 90
    }
  }
}

resource "aws_iam_role" "infinity_action_lambda" {
  name = "infinity-action-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(var.tags, {
    app     = "infinity"
    service = "dashboard-action"
  })
}

resource "aws_iam_role_policy_attachment" "infinity_action_lambda_basic" {
  role       = aws_iam_role.infinity_action_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "infinity_action_lambda" {
  name = "infinity-action-lambda-policy"
  role = aws_iam_role.infinity_action_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject"
        ]
        Resource = [
          "${aws_s3_bucket.infinity_action_queue.arn}/action_requests/inbox/*",
          "${aws_s3_bucket.infinity_action_queue.arn}/action_requests/dedupe/*"
        ]
      }
    ]
  })
}

resource "aws_lambda_function" "infinity_action" {
  function_name    = "infinity-action"
  role             = aws_iam_role.infinity_action_lambda.arn
  handler          = "infinity_action.handler"
  runtime          = "python3.12"
  filename         = data.archive_file.infinity_action_lambda.output_path
  source_code_hash = data.archive_file.infinity_action_lambda.output_base64sha256
  timeout          = 10
  memory_size      = 128

  environment {
    variables = {
      ACTION_BUCKET       = aws_s3_bucket.infinity_action_queue.bucket
      ACTION_TOKEN_SHA256 = var.infinity_action_token_sha256
      ALLOWED_ORIGINS     = join(",", var.infinity_action_allowed_origins)
    }
  }

  tags = merge(var.tags, {
    app     = "infinity"
    service = "dashboard-action"
  })
}

resource "aws_lambda_function_url" "infinity_action" {
  function_name      = aws_lambda_function.infinity_action.function_name
  authorization_type = "NONE"

  cors {
    allow_credentials = false
    allow_headers     = ["content-type"]
    allow_methods     = ["POST"]
    allow_origins     = var.infinity_action_allowed_origins
    max_age           = 3600
  }
}

resource "aws_lambda_permission" "infinity_action_function_url" {
  statement_id           = "AllowPublicFunctionUrlInvoke"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.infinity_action.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}
