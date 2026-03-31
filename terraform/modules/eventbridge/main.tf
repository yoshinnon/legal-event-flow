locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

# ── ルール1: document.published → SQS ────────────────
resource "aws_cloudwatch_event_rule" "document_publish" {
  name           = "${local.name_prefix}-document-publish-rule"
  description    = "api-handlerが発行したdocument.publishedイベントをSQSへルーティング"
  event_bus_name = "default"

  event_pattern = jsonencode({
    source      = ["legal-event-flow"]
    detail-type = ["document.published", "document.scheduled_publish"]
  })

  tags = { Name = "${local.name_prefix}-document-publish-rule" }
}

resource "aws_cloudwatch_event_target" "sqs" {
  rule      = aws_cloudwatch_event_rule.document_publish.name
  target_id = "SendToSQS"
  arn       = var.sqs_queue_arn
}

# ── ルール2: 毎時 → scheduler-handler Lambda ─────────
resource "aws_cloudwatch_event_rule" "scheduler" {
  name                = "${local.name_prefix}-scheduler-rule"
  description         = "毎時scheduler-handlerを起動して予約反映をチェック"
  schedule_expression = "cron(0 * * * ? *)"
  tags                = { Name = "${local.name_prefix}-scheduler-rule" }
}

resource "aws_cloudwatch_event_target" "scheduler_lambda" {
  rule      = aws_cloudwatch_event_rule.scheduler.name
  target_id = "InvokeSchedulerLambda"
  arn       = var.scheduler_lambda_arn
}

# ── Lambda 起動許可 ────────────────────────────────────
resource "aws_lambda_permission" "eventbridge_scheduler" {
  statement_id  = "AllowEventBridgeInvokeScheduler"
  action        = "lambda:InvokeFunction"
  function_name = var.scheduler_lambda_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.scheduler.arn
}
