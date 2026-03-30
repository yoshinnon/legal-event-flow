// TODO: migrate-handler 実装
import type { Handler } from "aws-lambda";

export const handler: Handler = async (event) => {
  console.log("migrate-handler invoked", JSON.stringify(event));
};
