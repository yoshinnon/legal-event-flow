locals {
  name_prefix = "${var.project_name}-${var.environment}"

  functions = {
    api-handler       = { timeout = 30,  description = "REST API リクエスト処理" }
    scheduler-handler = { timeout = 30,  description = "予約反映チェック（毎時起動）" }
    consumer-handler  = { timeout = 60,  description = "SQSイベント処理・S3アーカイブ" }
    migrate-handler   = { timeout = 300, description = "Auroraマイグレーション専用" }
  }
}

# ── Lambda 関数（4関数共通パターン）──────────────────
resource "aws_lambda_function" "functions" {
  for_each = local.functions

  function_name = "${local.name_prefix}-${each.key}"
  description   = each.value.description
  role          = var.lambda_role_arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  timeout       = each.value.timeout
  filename      = "${path.module}/placeholder.zip"  # CI/CDでupdate-function-codeにより上書き

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [var.lambda_sg_id]
  }

  environment {
    variables = {
      DB_SECRET_ARN           = var.aurora_secret_arn
      TABLE_SCHEDULED_UPDATES = var.table_scheduled_updates
      TABLE_USER_SETTINGS     = var.table_user_settings
      TABLE_IDEMPOTENCY_KEYS  = var.table_idempotency_keys
      TABLE_SCHEMA_MIGRATIONS = var.table_schema_migrations
      SQS_QUEUE_URL           = var.sqs_queue_url
      EVENTBRIDGE_BUS_NAME    = "default"
      S3_ARCHIVE_BUCKET       = var.archive_bucket_name
    }
  }

  depends_on = [var.log_group_arns]

  tags = { Name = "${local.name_prefix}-${each.key}" }
}

# ── SQS → consumer-handler トリガー ──────────────────
resource "aws_lambda_event_source_mapping" "sqs_consumer" {
  event_source_arn                   = var.sqs_queue_arn
  function_name                      = aws_lambda_function.functions["consumer-handler"].arn
  batch_size                         = 10
  function_response_types            = ["ReportBatchItemFailures"]
}

# ── placeholder.zip（初回apply用の空ファイル）─────────
data "archive_file" "placeholder" {
  type        = "zip"
  output_path = "${path.module}/placeholder.zip"

  source {
    content  = "exports.handler = async () => ({ statusCode: 200 });"
    filename = "index.js"
  }
}
