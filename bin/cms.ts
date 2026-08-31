#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { TranslationSystemStack } from "../lib/translation-system-stack";
import { WebSocketApiStack } from "../lib/websocket-api-stack";
import { PricesDynamodbStack } from "../lib/prices-dynamodb-stack";

const app = new cdk.App();

const hostedZone =
  process.env.CDK_DEFAULT_ACCOUNT === process.env.CDK_DEV_ACCOUNT
    ? "dev.euler.tools"
    : "prod.euler.tools";

new TranslationSystemStack(app, "language-translation-system-stack", {
  hostedZone,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});

new WebSocketApiStack(app, "web-socket-api-stack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});

new PricesDynamodbStack(app, "prices-dynamodb-stack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
