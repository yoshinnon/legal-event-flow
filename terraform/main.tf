# ==============================================================
# terraform destroy 完全削除設定 確認済みリスト
# ==============================================================
# | リソース                          | 設定                        | 値                          |
# |----------------------------------|-----------------------------|-----------------------------|
# | aws_s3_bucket（全バケット）        | force_destroy               | true                        |
# | aws_rds_cluster                  | skip_final_snapshot         | !var.is_production          |
# | aws_rds_cluster                  | deletion_protection         | var.is_production           |
# | aws_dynamodb_table（全テーブル）   | deletion_protection_enabled | false                       |
# | aws_secretsmanager_secret        | recovery_window_in_days     | is_production ? 30 : 0      |
# | aws_cloudwatch_log_group（全て）  | Terraform管理下             | ✅ cloudwatchモジュールで定義 |
# ==============================================================

terraform {
  required_version = ">= 1.7.0"
  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 5.0" }
    random = { source = "hashicorp/random", version = "~> 3.0" }
    archive = { source = "hashicorp/archive", version = "~> 2.0" }
  }
}

provider "aws" {
  region = var.aws_region
  default_tags { tags = local.common_tags }
}

data "aws_caller_identity" "current" {}

# ── モジュール呼び出し ─────────────────────────────────

module "vpc" {
  source       = "./modules/vpc"
  project_name = var.project_name
  environment  = var.environment
  aws_region   = var.aws_region
}

module "cloudwatch" {
  source             = "./modules/cloudwatch"
  project_name       = var.project_name
  environment        = var.environment
  log_retention_days = var.log_retention_days
}

module "aurora" {
  source             = "./modules/aurora"
  project_name       = var.project_name
  environment        = var.environment
  is_production      = var.is_production
  db_min_acu         = var.db_min_acu
  db_max_acu         = var.db_max_acu
  private_subnet_ids = module.vpc.private_subnet_ids
  aurora_sg_id       = module.vpc.aurora_sg_id
}

module "dynamodb" {
  source       = "./modules/dynamodb"
  project_name = var.project_name
  environment  = var.environment
}

module "sqs" {
  source              = "./modules/sqs"
  project_name        = var.project_name
  environment         = var.environment
  eventbridge_rule_arn = module.eventbridge.document_publish_rule_arn
}

module "iam" {
  source           = "./modules/iam"
  project_name     = var.project_name
  environment      = var.environment
  aws_region       = var.aws_region
  account_id       = data.aws_caller_identity.current.account_id
  github_repo      = var.github_repo
  aurora_secret_arn = module.aurora.secret_arn
  sqs_queue_arn    = module.sqs.queue_arn
}

module "lambda" {
  source                  = "./modules/lambda"
  project_name            = var.project_name
  environment             = var.environment
  lambda_role_arn         = module.iam.lambda_role_arn
  private_subnet_ids      = module.vpc.private_subnet_ids
  lambda_sg_id            = module.vpc.lambda_sg_id
  aurora_secret_arn       = module.aurora.secret_arn
  table_scheduled_updates = module.dynamodb.scheduled_updates_name
  table_user_settings     = module.dynamodb.user_settings_name
  table_idempotency_keys  = module.dynamodb.idempotency_keys_name
  table_schema_migrations = module.dynamodb.schema_migrations_name
  sqs_queue_url           = module.sqs.queue_url
  sqs_queue_arn           = module.sqs.queue_arn
  log_group_arns = [
    module.cloudwatch.api_handler_log_group_arn,
    module.cloudwatch.scheduler_handler_log_group_arn,
    module.cloudwatch.consumer_handler_log_group_arn,
    module.cloudwatch.migrate_handler_log_group_arn,
  ]
}

module "eventbridge" {
  source                = "./modules/eventbridge"
  project_name          = var.project_name
  environment           = var.environment
  sqs_queue_arn         = module.sqs.queue_arn
  scheduler_lambda_arn  = module.lambda.scheduler_handler_arn
  scheduler_lambda_name = module.lambda.scheduler_handler_name
}

module "apigateway" {
  source                   = "./modules/apigateway"
  project_name             = var.project_name
  environment              = var.environment
  api_handler_arn          = module.lambda.api_handler_arn
  api_gateway_log_group_arn = module.cloudwatch.api_gateway_log_group_arn
}

module "s3_cloudfront" {
  source       = "./modules/s3_cloudfront"
  project_name = var.project_name
  environment  = var.environment
  force_destroy = var.force_destroy
}
