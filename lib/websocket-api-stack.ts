import { Runtime } from "aws-cdk-lib/aws-lambda";
import {
  CfnApi,
  CfnDeployment,
  CfnIntegration,
  CfnRoute,
  CfnStage,
} from "aws-cdk-lib/aws-apigatewayv2";
import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import {
  Effect,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";
import { AttributeType, Table } from "aws-cdk-lib/aws-dynamodb";
import * as path from "path";
import { Construct, DependencyGroup } from "constructs";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";

export class WebSocketApiStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    const tableName = "ws_connections";

    const name = id + "-api";
    const api = new CfnApi(this, name, {
      name: "WDISSockets",
      protocolType: "WEBSOCKET",
      routeSelectionExpression: "$request.body.action",
    });

    const table = new Table(this, `${name}-table`, {
      tableName: tableName,
      partitionKey: {
        name: "connectionId",
        type: AttributeType.STRING,
      },
      readCapacity: 5,
      writeCapacity: 5,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const connectFunc = new NodejsFunction(this, "connect-lambda", {
      entry: path.join(__dirname, `/../src/ws-handler/connect.ts`),
      handler: "handler",
      runtime: Runtime.NODEJS_14_X,
      timeout: Duration.seconds(300),
      memorySize: 256,
      environment: {
        TABLE_NAME: tableName,
      },
    });

    table.grantReadWriteData(connectFunc);

    const disconnectFunc = new NodejsFunction(this, "disconnect-lambda", {
      entry: path.join(__dirname, `/../src/ws-handler/disconnect.ts`),
      handler: "handler",
      runtime: Runtime.NODEJS_14_X,
      timeout: Duration.seconds(300),
      memorySize: 256,
      environment: {
        TABLE_NAME: tableName,
      },
    });

    table.grantReadWriteData(disconnectFunc);

    const messageFunc = new NodejsFunction(this, "message-lambda", {
      entry: path.join(__dirname, `/../src/ws-handler/send-message.ts`),
      handler: "handler",
      runtime: Runtime.NODEJS_14_X,
      timeout: Duration.seconds(300),
      memorySize: 256,
      initialPolicy: [
        new PolicyStatement({
          actions: ["execute-api:ManageConnections"],
          resources: [
            `arn:aws:execute-api:${this.region}:${this.account}:${api.ref}/*`,
          ],
          effect: Effect.ALLOW,
        }),
      ],
      environment: {
        TABLE_NAME: tableName,
      },
    });

    table.grantReadWriteData(messageFunc);

    const policy = new PolicyStatement({
      effect: Effect.ALLOW,
      resources: [
        connectFunc.functionArn,
        disconnectFunc.functionArn,
        messageFunc.functionArn,
      ],
      actions: ["lambda:InvokeFunction"],
    });

    const role = new Role(this, `${name}-iam-role`, {
      assumedBy: new ServicePrincipal("apigateway.amazonaws.com"),
    });
    role.addToPolicy(policy);

    const connectIntegration = new CfnIntegration(
      this,
      "connect-lambda-integration",
      {
        apiId: api.ref,
        integrationType: "AWS_PROXY",
        integrationUri: `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${connectFunc.functionArn}/invocations`,
        credentialsArn: role.roleArn,
      }
    );
    const disconnectIntegration = new CfnIntegration(
      this,
      "disconnect-lambda-integration",
      {
        apiId: api.ref,
        integrationType: "AWS_PROXY",
        integrationUri: `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${disconnectFunc.functionArn}/invocations`,
        credentialsArn: role.roleArn,
      }
    );
    const messageIntegration = new CfnIntegration(
      this,
      "message-lambda-integration",
      {
        apiId: api.ref,
        integrationType: "AWS_PROXY",
        integrationUri: `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${messageFunc.functionArn}/invocations`,
        credentialsArn: role.roleArn,
      }
    );

    const connectRoute = new CfnRoute(this, "connect-route", {
      apiId: api.ref,
      routeKey: "$connect",
      authorizationType: "NONE",
      target: "integrations/" + connectIntegration.ref,
    });

    const disconnectRoute = new CfnRoute(this, "disconnect-route", {
      apiId: api.ref,
      routeKey: "$disconnect",
      authorizationType: "NONE",
      target: "integrations/" + disconnectIntegration.ref,
    });

    const messageRoute = new CfnRoute(this, "message-route", {
      apiId: api.ref,
      routeKey: "sendmessage",
      authorizationType: "NONE",
      target: "integrations/" + messageIntegration.ref,
    });

    const deployment = new CfnDeployment(this, `${name}-deployment`, {
      apiId: api.ref,
    });

    const stage = new CfnStage(this, `${name}-stage`, {
      apiId: api.ref,
      autoDeploy: true,
      deploymentId: deployment.ref,
      stageName: process.env.ENV || "prod",
    });

    const dependencies = new DependencyGroup();
    dependencies.add(connectRoute);
    dependencies.add(disconnectRoute);
    dependencies.add(messageRoute);
    deployment.node.addDependency(dependencies);

    new CfnOutput(this, "ws-connection-table-arn", {
      value: table.tableArn,
      exportName: "ws-connection-table-arn",
    });

    new CfnOutput(this, "ws-api-id", {
      value: api.ref,
      exportName: "ws-api-id",
    });

    new CfnOutput(this, "ws-connection-api-domain-name", {
      value: `${api.ref}.execute-api.us-east-1.amazonaws.com/${stage.stageName}/`,
      exportName: "ws-connection-api-domain-name",
    });
  }
}
