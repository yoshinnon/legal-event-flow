# ── 全般 ────────────────────────────────────────────
variable "project_name" {
  description = "全リソース名の接頭辞"
  type        = string
  default     = "legal-event-flow"
}

variable "environment" {
  description = "環境識別子 (dev / prod)"
  type        = string
  default     = "dev"
  validation {
    condition     = contains(["dev", "prod"], var.environment)
    error_message = "environment は 'dev' または 'prod' を指定してください。"
  }
}

variable "is_production" {
  description = "本番フラグ。false なら削除保護OFF・スナップショットスキップ"
  type        = bool
  default     = false
}

# ── AWS ─────────────────────────────────────────────
variable "aws_region" {
  description = "AWSリージョン"
  type        = string
  default     = "ap-northeast-1"
}

variable "github_repo" {
  description = "GitHub OIDC 用リポジトリ (例: username/legal-event-flow)"
  type        = string
}

# ── RDS ─────────────────────────────────────────────
variable "db_min_acu" {
  description = "Aurora v2 最小 ACU（コスト抑制）"
  type        = number
  default     = 0.5
}

variable "db_max_acu" {
  description = "Aurora v2 最大 ACU"
  type        = number
  default     = 4
}

variable "skip_final_snapshot" {
  description = "destroy 時のスナップショットをスキップするか"
  type        = bool
  default     = true
}

# ── Logs ─────────────────────────────────────────────
variable "log_retention_days" {
  description = "CloudWatch Logs 保持日数（デフォルト7日でコスト抑制）"
  type        = number
  default     = 7
}

# ── S3 ──────────────────────────────────────────────
variable "force_destroy" {
  description = "S3バケット削除時に中身も強制削除するか"
  type        = bool
  default     = true
}
