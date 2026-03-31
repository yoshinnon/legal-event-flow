import { Handler } from "aws-lambda";
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE } from "../../shared/dynamodb";
import { LegalDocumentEvent } from "../../shared/types";

const eb = new EventBridgeClient({});

export const handler: Handler = async () => {
  const now = Math.floor(Date.now() / 1000);

  // 1. GSI "ApplyAt-index" で ApplyAt <= now かつ Status = WAITING をクエリ
  const { Items = [] } = await ddb.send(new QueryCommand({
    TableName:              TABLE.SCHEDULED_UPDATES,
    IndexName:              "ApplyAt-index",
    KeyConditionExpression: "ApplyAt <= :now",
    FilterExpression:       "#s = :waiting",
    ExpressionAttributeNames:  { "#s": "Status" },
    ExpressionAttributeValues: { ":now": now, ":waiting": "WAITING" },
  }));

  console.log(`Found ${Items.length} scheduled update(s) to apply.`);

  for (const item of Items) {
    const eventPayload: LegalDocumentEvent = {
      eventType:  "document.scheduled_publish",
      documentId: item.DocumentId,
      versionId:  item.UpdateId,
      slug:       item.Slug ?? "",
      timestamp:  new Date().toISOString(),
    };

    try {
      // 2. EventBridge にイベント発行
      await eb.send(new PutEventsCommand({
        Entries: [{
          EventBusName: process.env.EVENTBRIDGE_BUS_NAME,
          Source:       "legal-event-flow",
          DetailType:   "document.scheduled_publish",
          Detail:       JSON.stringify(eventPayload),
        }],
      }));

      // 3. Status を EXECUTED に更新（削除はしない・履歴保持）
      await ddb.send(new UpdateCommand({
        TableName: TABLE.SCHEDULED_UPDATES,
        Key:       { UpdateId: item.UpdateId },
        UpdateExpression: "SET #s = :executed",
        ExpressionAttributeNames:  { "#s": "Status" },
        ExpressionAttributeValues: { ":executed": "EXECUTED" },
      }));

      console.log(`✅ Scheduled update ${item.UpdateId} dispatched.`);
    } catch (err) {
      // 失敗は FAILED に記録して続行（1件の失敗で全体を止めない）
      console.error(`❌ Failed to dispatch ${item.UpdateId}:`, err);
      await ddb.send(new UpdateCommand({
        TableName: TABLE.SCHEDULED_UPDATES,
        Key:       { UpdateId: item.UpdateId },
        UpdateExpression: "SET #s = :failed",
        ExpressionAttributeNames:  { "#s": "Status" },
        ExpressionAttributeValues: { ":failed": "FAILED" },
      }));
    }
  }

  return { processed: Items.length };
};
