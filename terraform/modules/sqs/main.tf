locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

# ── DLQ ──────────────────────────────────────────────
resource "aws_sqs_queue" "dlq" {
  name                      = "${local.name_prefix}-legal-document-events-dlq"
  message_retention_seconds = 1209600  # 14日
  tags                      = { Name = "${local.name_prefix}-dlq" }
}

# ── メインキュー ──────────────────────────────────────
resource "aws_sqs_queue" "main" {
  name                       = "${local.name_prefix}-legal-document-events"
  message_retention_seconds  = 86400   # 1日
  visibility_timeout_seconds = 60

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = 3
  })

  tags = { Name = "${local.name_prefix}-legal-document-events" }
}

# ── EventBridge からの送信を許可するポリシー ────────────
resource "aws_sqs_queue_policy" "main" {
  queue_url = aws_sqs_queue.main.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowEventBridge"
      Effect    = "Allow"
      Principal = { Service = "events.amazonaws.com" }
      Action    = "sqs:SendMessage"
      Resource  = aws_sqs_queue.main.arn
      Condition = {
        ArnEquals = { "aws:SourceArn" = var.eventbridge_rule_arn }
      }
    }]
  })
}
