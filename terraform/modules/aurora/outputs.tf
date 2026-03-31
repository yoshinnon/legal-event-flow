output "cluster_endpoint" { value = aws_rds_cluster.main.endpoint }
output "secret_arn"       { value = aws_secretsmanager_secret.aurora.arn }
output "cluster_id"       { value = aws_rds_cluster.main.id }
