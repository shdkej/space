data "aws_caller_identity" "current" {}

data "archive_file" "virtue_feedback_lambda" {
  type        = "zip"
  source_file = "${path.module}/lambda/virtue_feedback.py"
  output_path = "${path.module}/.terraform/virtue-feedback-lambda.zip"
}

resource "aws_s3_bucket" "virtue_feedback" {
  bucket = "virtue-feedback-${data.aws_caller_identity.current.account_id}-${var.aws_region}"

  tags = merge(var.tags, {
    app     = "virtue"
    service = "feedback"
  })
}

resource "aws_s3_bucket_public_access_block" "virtue_feedback" {
  bucket = aws_s3_bucket.virtue_feedback.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "virtue_feedback" {
  bucket = aws_s3_bucket.virtue_feedback.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "virtue_feedback" {
  bucket = aws_s3_bucket.virtue_feedback.id

  rule {
    id     = "expire-feedback-after-2-years"
    status = "Enabled"

    filter {
      prefix = ""
    }

    expiration {
      days = 730
    }
  }
}

resource "aws_ses_email_identity" "virtue_feedback_sender" {
  email = var.virtue_feedback_sender_email
}

resource "aws_ses_email_identity" "virtue_feedback_recipient" {
  count = var.virtue_feedback_recipient_email == var.virtue_feedback_sender_email ? 0 : 1
  email = var.virtue_feedback_recipient_email
}

resource "aws_iam_role" "virtue_feedback_lambda" {
  name = "virtue-feedback-lambda-role"

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
    app     = "virtue"
    service = "feedback"
  })
}

resource "aws_iam_role_policy_attachment" "virtue_feedback_lambda_basic" {
  role       = aws_iam_role.virtue_feedback_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "virtue_feedback_lambda" {
  name = "virtue-feedback-lambda-policy"
  role = aws_iam_role.virtue_feedback_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject"
        ]
        Resource = "${aws_s3_bucket.virtue_feedback.arn}/feedback/*"
      },
      {
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_lambda_function" "virtue_feedback" {
  function_name    = "virtue-feedback"
  role             = aws_iam_role.virtue_feedback_lambda.arn
  handler          = "virtue_feedback.handler"
  runtime          = "python3.12"
  filename         = data.archive_file.virtue_feedback_lambda.output_path
  source_code_hash = data.archive_file.virtue_feedback_lambda.output_base64sha256
  timeout          = 10
  memory_size      = 128

  environment {
    variables = {
      APP_NAME                 = "Virtue"
      FEEDBACK_BUCKET          = aws_s3_bucket.virtue_feedback.bucket
      FEEDBACK_RECIPIENT_EMAIL = var.virtue_feedback_recipient_email
      FEEDBACK_SENDER_EMAIL    = var.virtue_feedback_sender_email
      ALLOWED_ORIGINS          = join(",", var.virtue_feedback_allowed_origins)
    }
  }

  tags = merge(var.tags, {
    app     = "virtue"
    service = "feedback"
  })
}

resource "aws_lambda_function_url" "virtue_feedback" {
  function_name      = aws_lambda_function.virtue_feedback.function_name
  authorization_type = "NONE"

  cors {
    allow_credentials = false
    allow_headers     = ["content-type"]
    allow_methods     = ["POST"]
    allow_origins     = var.virtue_feedback_allowed_origins
    max_age           = 3600
  }
}

resource "aws_lambda_permission" "virtue_feedback_function_url" {
  statement_id           = "AllowPublicFunctionUrlInvoke"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.virtue_feedback.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

resource "aws_lambda_permission" "virtue_feedback_function_invoke" {
  statement_id  = "AllowPublicFunctionUrlFunctionInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.virtue_feedback.function_name
  principal     = "*"
}
