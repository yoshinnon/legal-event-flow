locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

# ── Lambda 実行ロール ──────────────────────────────────
resource "aws_iam_role" "lambda" {
  name = "${local.name_prefix}-lambda-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
  tags = { Name = "${local.name_prefix}-lambda-role" }
}

resource "aws_iam_role_policy" "lambda" {
  name   = "${local.name_prefix}-lambda-policy"
  role   = aws_iam_role.lambda.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "SecretsManager"
        Effect = "Allow"
        Action = ["secretsmanager:GetSecretValue"]
        Resource = [var.aurora_secret_arn]
      },
      {
        Sid    = "DynamoDB"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem",
          "dynamodb:DeleteItem", "dynamodb:Query", "dynamodb:Scan"
        ]
        Resource = ["arn:aws:dynamodb:${var.aws_region}:${var.account_id}:table/${local.name_prefix}-*"]
      },
      {
        Sid    = "SQS"
        Effect = "Allow"
        Action = [
          "sqs:SendMessage", "sqs:ReceiveMessage",
          "sqs:DeleteMessage", "sqs:GetQueueAttributes"
        ]
        Resource = [var.sqs_queue_arn]
      },
      {
        Sid    = "EventBridge"
        Effect = "Allow"
        Action = ["events:PutEvents"]
        Resource = ["*"]
      },
      {
        Sid    = "S3Archive"
        Effect = "Allow"
        Action = ["s3:PutObject"]
        Resource = ["arn:aws:s3:::${local.name_prefix}-logs/*"]
      },
      {
        Sid    = "Logs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"
        ]
        Resource = ["arn:aws:logs:*:*:*"]
      },
      {
        Sid    = "VPC"
        Effect = "Allow"
        Action = [
          "ec2:CreateNetworkInterface",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DeleteNetworkInterface"
        ]
        Resource = ["*"]
      }
    ]
  })
}

# ── GitHub Actions OIDC ロール ─────────────────────────
resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

resource "aws_iam_role" "github_actions" {
  name = "${local.name_prefix}-github-actions-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringLike = {
          "token.actions.githubusercontent.com:sub" = "repo:${var.github_repo}:*"
        }
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
      }
    }]
  })
  tags = { Name = "${local.name_prefix}-github-actions-role" }
}

resource "aws_iam_role_policy" "github_actions" {
  name   = "${local.name_prefix}-github-actions-policy"
  role   = aws_iam_role.github_actions.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Lambda"
        Effect = "Allow"
        Action = ["lambda:UpdateFunctionCode", "lambda:GetFunction"]
        Resource = ["arn:aws:lambda:${var.aws_region}:${var.account_id}:function:${local.name_prefix}-*"]
      },
      {
        Sid    = "LambdaInvoke"
        Effect = "Allow"
        Action = ["lambda:InvokeFunction"]
        Resource = ["arn:aws:lambda:${var.aws_region}:${var.account_id}:function:${local.name_prefix}-migrate-handler"]
      },
      {
        Sid    = "S3Frontend"
        Effect = "Allow"
        Action = ["s3:PutObject", "s3:DeleteObject", "s3:ListBucket"]
        Resource = [
          "arn:aws:s3:::${local.name_prefix}-frontend",
          "arn:aws:s3:::${local.name_prefix}-frontend/*"
        ]
      },
      {
        Sid    = "CloudFront"
        Effect = "Allow"
        Action = ["cloudfront:CreateInvalidation"]
        Resource = ["*"]
      },
      {
        Sid    = "Terraform"
        Effect = "Allow"
        Action = [
          "s3:GetObject", "s3:PutObject", "s3:ListBucket",
          "iam:*", "ec2:*", "rds:*", "dynamodb:*",
          "sqs:*", "events:*", "lambda:*", "apigateway:*",
          "cloudfront:*", "logs:*", "secretsmanager:*",
          "cloudwatch:*"
        ]
        Resource = ["*"]
      }
    ]
  })
}
