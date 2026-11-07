data "archive_file" "image_annotator_lambda" {
  type        = "zip"
  source_file = "${path.module}/lambda/image_annotator.py"
  output_path = "${path.module}/.terraform/image-annotator-lambda.zip"
}

data "aws_secretsmanager_secret" "image_annotator_openai" {
  name = "image-annotator/openai-api-key"
}

resource "aws_iam_role" "image_annotator_lambda" {
  name = "image-annotator-lambda-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Action    = "sts:AssumeRole",
      Effect    = "Allow",
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "image_annotator_lambda_basic" {
  role       = aws_iam_role.image_annotator_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "image_annotator_openai_secret" {
  name = "image-annotator-openai-secret"
  role = aws_iam_role.image_annotator_lambda.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Action   = ["secretsmanager:GetSecretValue"],
      Effect   = "Allow",
      Resource = data.aws_secretsmanager_secret.image_annotator_openai.arn
    }]
  })
}

resource "aws_lambda_function" "image_annotator" {
  function_name    = "image-annotator"
  role             = aws_iam_role.image_annotator_lambda.arn
  handler          = "image_annotator.handler"
  runtime          = "python3.12"
  filename         = data.archive_file.image_annotator_lambda.output_path
  source_code_hash = data.archive_file.image_annotator_lambda.output_base64sha256
  timeout          = 60
  memory_size      = 128

  environment {
    variables = {
      IMAGE_LIST_URL            = var.image_annotator_image_list_url
      IMAGE_ADMIN_TOKEN         = var.image_annotator_image_admin_token
      SUPABASE_URL              = var.image_annotator_supabase_url
      SUPABASE_SERVICE_ROLE_KEY = var.image_annotator_supabase_service_role_key
      ARCHIVE_PROXY_TOKEN       = var.image_annotator_proxy_token
      OPENAI_SECRET_ARN         = data.aws_secretsmanager_secret.image_annotator_openai.arn
      PUBLIC_IMAGE_BASE_URL     = var.image_annotator_public_image_base_url
      ALLOWED_ORIGINS           = join(",", var.image_annotator_allowed_origins)
    }
  }
}

resource "aws_lambda_function_url" "image_annotator" {
  function_name      = aws_lambda_function.image_annotator.function_name
  authorization_type = "NONE"
  cors {
    allow_credentials = false
    allow_headers     = ["content-type"]
    allow_methods     = ["GET", "POST", "PUT"]
    allow_origins     = var.image_annotator_allowed_origins
    max_age           = 3600
  }
}

resource "aws_lambda_permission" "image_annotator_function_url" {
  statement_id           = "AllowPublicFunctionUrlInvoke"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.image_annotator.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

resource "aws_lambda_permission" "image_annotator_invoke" {
  statement_id             = "AllowPublicFunctionUrlInvokeFunction"
  action                   = "lambda:InvokeFunction"
  function_name            = aws_lambda_function.image_annotator.function_name
  principal                = "*"
  invoked_via_function_url = true
}

output "image_annotator" {
  value = { function_url = aws_lambda_function_url.image_annotator.function_url }
}
