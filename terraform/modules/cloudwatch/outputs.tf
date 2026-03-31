output "api_handler_log_group_arn"       { value = aws_cloudwatch_log_group.api_handler.arn }
output "scheduler_handler_log_group_arn" { value = aws_cloudwatch_log_group.scheduler_handler.arn }
output "consumer_handler_log_group_arn"  { value = aws_cloudwatch_log_group.consumer_handler.arn }
output "migrate_handler_log_group_arn"   { value = aws_cloudwatch_log_group.migrate_handler.arn }
output "api_gateway_log_group_arn"       { value = aws_cloudwatch_log_group.api_gateway.arn }
