locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

# ── Lambda ロググループ（4関数）──────────────────────
resource "aws_cloudwatch_log_group" "api_handler" {
  name              = "/aws/lambda/${local.name_prefix}-api-handler"
  retention_in_days = var.log_retention_days
  tags              = { Name = "${local.name_prefix}-api-handler-logs" }
}

resource "aws_cloudwatch_log_group" "scheduler_handler" {
  name              = "/aws/lambda/${local.name_prefix}-scheduler-handler"
  retention_in_days = var.log_retention_days
  tags              = { Name = "${local.name_prefix}-scheduler-handler-logs" }
}

resource "aws_cloudwatch_log_group" "consumer_handler" {
  name              = "/aws/lambda/${local.name_prefix}-consumer-handler"
  retention_in_days = var.log_retention_days
  tags              = { Name = "${local.name_prefix}-consumer-handler-logs" }
}

resource "aws_cloudwatch_log_group" "migrate_handler" {
  name              = "/aws/lambda/${local.name_prefix}-migrate-handler"
  retention_in_days = var.log_retention_days
  tags              = { Name = "${local.name_prefix}-migrate-handler-logs" }
}

# ── API Gateway アクセスログ ──────────────────────────
resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/apigateway/${local.name_prefix}"
  retention_in_days = var.log_retention_days
  tags              = { Name = "${local.name_prefix}-apigateway-logs" }
}

# ── Aurora 監査ログ ───────────────────────────────────
resource "aws_cloudwatch_log_group" "aurora" {
  name              = "/aws/rds/cluster/${local.name_prefix}-aurora/postgresql"
  retention_in_days = var.log_retention_days
  tags              = { Name = "${local.name_prefix}-aurora-logs" }
}
