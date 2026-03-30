terraform {
  backend "s3" {
    # bucket と region は init 時に -backend-config で渡す
    key            = "legal-event-flow/terraform.tfstate"
    region         = "ap-northeast-1"
    encrypt        = true
    use_lockfile   = true  # Terraform 1.7+ ネイティブロック（DynamoDB不要）
  }
}
