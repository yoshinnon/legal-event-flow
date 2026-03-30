output "api_gateway_endpoint" {
  description = "API Gateway エンドポイント URL"
  value       = module.apigateway.endpoint
}

output "cloudfront_distribution_id" {
  description = "CloudFront ディストリビューション ID"
  value       = module.s3_cloudfront.distribution_id
}

output "cloudfront_domain" {
  description = "CloudFront ドメイン名"
  value       = module.s3_cloudfront.domain_name
}

output "s3_bucket_name" {
  description = "React ホスティング用 S3 バケット名"
  value       = module.s3_cloudfront.bucket_name
}

output "aurora_cluster_endpoint" {
  description = "Aurora クラスターエンドポイント（Lambdaが使用）"
  value       = module.aurora.cluster_endpoint
  sensitive   = true
}
