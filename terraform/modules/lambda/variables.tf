variable "project_name"            { type = string }
variable "environment"             { type = string }
variable "lambda_role_arn"         { type = string }
variable "private_subnet_ids"      { type = list(string) }
variable "lambda_sg_id"            { type = string }
variable "aurora_secret_arn"       { type = string }
variable "table_scheduled_updates" { type = string }
variable "table_user_settings"     { type = string }
variable "table_idempotency_keys"  { type = string }
variable "table_schema_migrations" { type = string }
variable "sqs_queue_url"           { type = string }
variable "sqs_queue_arn"           { type = string }
variable "archive_bucket_name"     { type = string; default = "" }
variable "log_group_arns"          { type = list(string) }
