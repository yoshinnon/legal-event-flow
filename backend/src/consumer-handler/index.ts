// TODO: consumer-handler 実装
import type { Handler } from "aws-lambda";

export const handler: Handler = async (event) => {
  console.log("consumer-handler invoked", JSON.stringify(event));
};
