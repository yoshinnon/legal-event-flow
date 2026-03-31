locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

# ── ScheduledUpdates ──────────────────────────────────
resource "aws_dynamodb_table" "scheduled_updates" {
  name         = "${local.name_prefix}-ScheduledUpdates"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "UpdateId"
  deletion_protection_enabled = false

  attribute {
    name = "UpdateId"
    type = "S"
  }
  attribute {
    name = "ApplyAt"
    type = "N"
  }

  global_secondary_index {
    name            = "ApplyAt-index"
    hash_key        = "ApplyAt"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "ExpiresAt"
    enabled        = true
  }

  tags = { Name = "${local.name_prefix}-ScheduledUpdates" }
}

# ── UserSettings ──────────────────────────────────────
resource "aws_dynamodb_table" "user_settings" {
  name         = "${local.name_prefix}-UserSettings"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "UserId"
  deletion_protection_enabled = false

  attribute {
    name = "UserId"
    type = "S"
  }

  tags = { Name = "${local.name_prefix}-UserSettings" }
}

# ── IdempotencyKeys ───────────────────────────────────
resource "aws_dynamodb_table" "idempotency_keys" {
  name         = "${local.name_prefix}-IdempotencyKeys"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "MessageId"
  deletion_protection_enabled = false

  attribute {
    name = "MessageId"
    type = "S"
  }

  ttl {
    attribute_name = "TTL"
    enabled        = true
  }

  tags = { Name = "${local.name_prefix}-IdempotencyKeys" }
}

# ── SchemaMigrations ──────────────────────────────────
resource "aws_dynamodb_table" "schema_migrations" {
  name         = "${local.name_prefix}-SchemaMigrations"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "Version"
  deletion_protection_enabled = false

  attribute {
    name = "Version"
    type = "S"
  }

  tags = { Name = "${local.name_prefix}-SchemaMigrations" }
}
