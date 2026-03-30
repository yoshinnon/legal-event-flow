// TODO: api-handler 実装
import type { Handler } from "aws-lambda";

export const handler: Handler = async (event) => {
  console.log("api-handler invoked", JSON.stringify(event));
};
