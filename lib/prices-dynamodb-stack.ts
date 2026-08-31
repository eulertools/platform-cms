import { Duration, Fn, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Runtime, StartingPosition } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as path from "path";
import { DynamoEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";

export class PricesDynamodbStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const tableArn = Fn.importValue("ws-connection-table-arn");

    const wsApiId = Fn.importValue("ws-api-id");

    const wsConnectionDomainName = Fn.importValue(
      "ws-connection-api-domain-name"
    );

    const wsConnectionTable = dynamodb.Table.fromTableArn(
      this,
      "ws-connections-table",
      tableArn
    );

    const pricesTtable = new dynamodb.Table(this, "prices-table", {
      partitionKey: {
        name: "identifier",
        type: dynamodb.AttributeType.STRING,
      },
      tableName: "prices-table",
      billingMode: dynamodb.BillingMode.PROVISIONED,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    const apiDynamodbPrices = new NodejsFunction(
      this,
      "prices-dynamodb-api-handler",
      {
        functionName: "prices-dynamodb-api-handler",
        handler: "handler",
        description: "Create prices api that retrieves records from dynamodb",
        entry: path.join(__dirname, `/../src/prices-handler/index.ts`),
        runtime: Runtime.NODEJS_14_X,
        timeout: Duration.minutes(1),
        initialPolicy: [
          new PolicyStatement({
            actions: ["execute-api:ManageConnections"],
            resources: [
              `arn:aws:execute-api:${this.region}:${this.account}:${wsApiId}/*`,
            ],
            effect: Effect.ALLOW,
          }),
        ],
        environment: {
          WS_CONNECTION_TABLE_NAME: wsConnectionTable.tableName,
          WS_CONNECTION_API_DOMAIN_NAME: wsConnectionDomainName,
        },
      }
    );

    wsConnectionTable.grantReadWriteData(apiDynamodbPrices);

    apiDynamodbPrices.addEventSource(
      new DynamoEventSource(pricesTtable, {
        startingPosition: StartingPosition.LATEST,
      })
    );
  }
}
