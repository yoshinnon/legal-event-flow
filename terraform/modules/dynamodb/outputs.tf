output "scheduled_updates_name"  { value = aws_dynamodb_table.scheduled_updates.name }
output "user_settings_name"      { value = aws_dynamodb_table.user_settings.name }
output "idempotency_keys_name"   { value = aws_dynamodb_table.idempotency_keys.name }
output "schema_migrations_name"  { value = aws_dynamodb_table.schema_migrations.name }
