import { SQSHandler, SQSBatchResponse } from "aws-lambda";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE } from "../../shared/dynamodb";
import { LegalDocumentEvent } from "../../shared/types";

const s3 = new S3Client({});
const ARCHIVE_BUCKET = process.env.S3_ARCHIVE_BUCKET ?? "";

export const handler: SQSHandler = async (event): Promise<SQSBatchResponse> => {
  const batchItemFailures: { itemIdentifier: string }[] = [];

  for (const record of event.Records) {
    const messageId = record.messageId;

    try {
      // 1. 冪等性チェック: 処理済みなら即スキップ
      const existing = await ddb.send(new GetCommand({
        TableName: TABLE.IDEMPOTENCY_KEYS,
        Key:       { MessageId: messageId },
      }));
      if (existing.Item) {
        console.log(`Skipping duplicate message: ${messageId}`);
        continue;
      }

      const payload: LegalDocumentEvent = JSON.parse(record.body).detail ?? JSON.parse(record.body);

      // 2. S3 にアーカイブ保存
      const date = new Date().toISOString().split("T")[0];
      await s3.send(new PutObjectCommand({
        Bucket:      ARCHIVE_BUCKET,
        Key:         `logs/${date}/${messageId}.json`,
        Body:        JSON.stringify({ messageId, payload, timestamp: new Date().toISOString() }),
        ContentType: "application/json",
      }));

      // 3. UserSettings から通知対象ユーザーを取得
      const { Items: users = [] } = await ddb.send(new ScanCommand({
        TableName: TABLE.USER_SETTINGS,
      }));

      // 4. 通知モック出力
      for (const user of users) {
        console.log(`[NOTIFY] userId=${user.UserId} event=${payload.eventType} slug=${payload.slug}`);
      }

      // 5. 処理済みとして記録（TTL: 24時間後）
      await ddb.send(new PutCommand({
        TableName: TABLE.IDEMPOTENCY_KEYS,
        Item: {
          MessageId:   messageId,
          ProcessedAt: new Date().toISOString(),
          TTL:         Math.floor(Date.now() / 1000) + 86400,
        },
      }));

      console.log(`✅ Message ${messageId} processed.`);
    } catch (err) {
      console.error(`❌ Failed to process message ${messageId}:`, err);
      batchItemFailures.push({ itemIdentifier: messageId });
    }
  }

  return { batchItemFailures };
};
