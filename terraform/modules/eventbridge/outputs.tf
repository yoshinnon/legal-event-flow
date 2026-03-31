output "document_publish_rule_arn" { value = aws_cloudwatch_event_rule.document_publish.arn }
output "scheduler_rule_arn"        { value = aws_cloudwatch_event_rule.scheduler.arn }
