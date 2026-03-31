import { Handler } from "aws-lambda";
import { readdirSync, readFileSync } from "fs";
import path from "path";
import { getPool } from "../../shared/db";
import { ddb, TABLE } from "../../shared/dynamodb";
import { GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

export const handler: Handler = async () => {
  const pool = await getPool();
  const client = await pool.connect();

  try {
    // 1. 適用済みバージョンをDynamoDBから取得
    const { Items = [] } = await ddb.send(new ScanCommand({ TableName: TABLE.SCHEMA_MIGRATIONS }));
    const applied = new Set(Items.map((i) => i.Version as string));

    // 2. migrations/*.sql を連番順にスキャン
    const migrationsDir = path.join(__dirname, "migrations");
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    const pending = files.filter((f) => !applied.has(f.replace(".sql", "")));

    if (pending.length === 0) {
      console.log("No migrations to apply.");
      return { status: "ok", applied: [] };
    }

    const appliedVersions: string[] = [];

    for (const file of pending) {
      const version = file.replace(".sql", "");
      const sql = readFileSync(path.join(migrationsDir, file), "utf-8");

      console.log(`Applying migration: ${file}`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${file} failed: ${err}`);
      }

      // 3. 適用済みとしてDynamoDBに記録
      await ddb.send(new PutCommand({
        TableName: TABLE.SCHEMA_MIGRATIONS,
        Item: {
          Version:     version,
          AppliedAt:   new Date().toISOString(),
          Description: file,
        },
      }));

      appliedVersions.push(version);
      console.log(`✅ ${file} applied.`);
    }

    return { status: "ok", applied: appliedVersions };
  } finally {
    client.release();
  }
};
