variable "project_name"        { type = string }
variable "environment"         { type = string }
variable "eventbridge_rule_arn" {
  type    = string
  default = "*"  # EventBridgeモジュール作成後に差し替え
}
