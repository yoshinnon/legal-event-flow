output "api_handler_arn"       { value = aws_lambda_function.functions["api-handler"].arn }
output "scheduler_handler_arn" { value = aws_lambda_function.functions["scheduler-handler"].arn }
output "scheduler_handler_name"{ value = aws_lambda_function.functions["scheduler-handler"].function_name }
output "consumer_handler_arn"  { value = aws_lambda_function.functions["consumer-handler"].arn }
output "migrate_handler_arn"   { value = aws_lambda_function.functions["migrate-handler"].arn }
