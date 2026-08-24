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

resource "aws_lambda_function" "timeline" {
  function_name    = "launch-timeline"
  role             = aws_iam_role.timeline_lambda.arn
  handler          = "timeline.handler"
  runtime          = "python3.12"
  filename         = data.archive_file.timeline_lambda.output_path
  source_code_hash = data.archive_file.timeline_lambda.output_base64sha256
  timeout          = 15
  memory_size      = 256
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
