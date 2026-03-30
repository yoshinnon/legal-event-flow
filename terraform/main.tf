terraform {
  required_version = ">= 1.7.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
  default_tags { tags = local.common_tags }
}

module "vpc"           { source = "./modules/vpc"           }
module "aurora"        { source = "./modules/aurora"        }
module "dynamodb"      { source = "./modules/dynamodb"      }
module "sqs"           { source = "./modules/sqs"           }
module "eventbridge"   { source = "./modules/eventbridge"   }
module "cloudwatch"    { source = "./modules/cloudwatch"    }
module "lambda"        { source = "./modules/lambda"        }
module "apigateway"    { source = "./modules/apigateway"    }
module "s3_cloudfront" { source = "./modules/s3_cloudfront" }
module "iam"           { source = "./modules/iam"           }
