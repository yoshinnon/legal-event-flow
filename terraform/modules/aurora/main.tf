locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

# ── Secrets Manager（認証情報の自動生成・保存）─────────
resource "aws_secretsmanager_secret" "aurora" {
  name                    = "${local.name_prefix}-aurora-credentials"
  recovery_window_in_days = var.is_production ? 30 : 0
  tags                    = { Name = "${local.name_prefix}-aurora-credentials" }
}

resource "aws_secretsmanager_secret_version" "aurora" {
  secret_id = aws_secretsmanager_secret.aurora.id
  secret_string = jsonencode({
    username = "postgres"
    password = random_password.aurora.result
    host     = aws_rds_cluster.main.endpoint
    port     = 5432
    dbname   = var.db_name
  })
}

resource "random_password" "aurora" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# ── DB Subnet Group ───────────────────────────────────
resource "aws_db_subnet_group" "main" {
  name       = "${local.name_prefix}-aurora-subnet-group"
  subnet_ids = var.private_subnet_ids
  tags       = { Name = "${local.name_prefix}-aurora-subnet-group" }
}

# ── Aurora Cluster ────────────────────────────────────
resource "aws_rds_cluster" "main" {
  cluster_identifier      = "${local.name_prefix}-aurora"
  engine                  = "aurora-postgresql"
  engine_mode             = "provisioned"
  engine_version          = "16.2"
  database_name           = var.db_name
  master_username         = "postgres"
  master_password         = random_password.aurora.result
  db_subnet_group_name    = aws_db_subnet_group.main.name
  vpc_security_group_ids  = [var.aurora_sg_id]

  serverlessv2_scaling_configuration {
    min_capacity = var.db_min_acu
    max_capacity = var.db_max_acu
  }

  skip_final_snapshot     = !var.is_production
  deletion_protection     = var.is_production

  enabled_cloudwatch_logs_exports = ["postgresql"]

  tags = { Name = "${local.name_prefix}-aurora" }
}

# ── Aurora Instance（Serverless v2 は instance が必要）─
resource "aws_rds_cluster_instance" "main" {
  identifier           = "${local.name_prefix}-aurora-instance-1"
  cluster_identifier   = aws_rds_cluster.main.id
  instance_class       = "db.serverless"
  engine               = aws_rds_cluster.main.engine
  engine_version       = aws_rds_cluster.main.engine_version
  db_subnet_group_name = aws_db_subnet_group.main.name
  tags                 = { Name = "${local.name_prefix}-aurora-instance-1" }
}
