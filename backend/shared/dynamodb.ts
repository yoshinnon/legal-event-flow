// DynamoDB 操作ユーティリティ
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
export const ddb = DynamoDBDocumentClient.from(client);

export const TABLE = {
  SCHEDULED_UPDATES:  process.env.TABLE_SCHEDULED_UPDATES!,
  USER_SETTINGS:      process.env.TABLE_USER_SETTINGS!,
  IDEMPOTENCY_KEYS:   process.env.TABLE_IDEMPOTENCY_KEYS!,
  SCHEMA_MIGRATIONS:  process.env.TABLE_SCHEMA_MIGRATIONS!,
} as const;
