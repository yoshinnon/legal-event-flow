// TODO: scheduler-handler 実装
import type { Handler } from "aws-lambda";

export const handler: Handler = async (event) => {
  console.log("scheduler-handler invoked", JSON.stringify(event));
};
