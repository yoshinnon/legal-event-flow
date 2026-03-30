// Aurora (PostgreSQL) 接続ユーティリティ
// Secrets Manager からの認証情報取得をキャッシュし、コネクションプールを管理
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { Pool } from "pg";

let pool: Pool | null = null;

async function getSecret(): Promise<{ username: string; password: string; host: string; port: number; dbname: string }> {
  const client = new SecretsManagerClient({});
  const res = await client.send(new GetSecretValueCommand({ SecretId: process.env.DB_SECRET_ARN! }));
  return JSON.parse(res.SecretString!);
}

export async function getPool(): Promise<Pool> {
  if (pool) return pool;
  const secret = await getSecret();
  pool = new Pool({
    host:     secret.host,
    port:     secret.port,
    database: secret.dbname,
    user:     secret.username,
    password: secret.password,
    max:      5,
    ssl:      { rejectUnauthorized: false },
    keepAlive: true,
  });
  return pool;
}
