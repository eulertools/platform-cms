import { Duration, Fn, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  AuthorizationType,
  CognitoUserPoolsAuthorizer,
  LambdaIntegration,
  LambdaRestApi,
} from "aws-cdk-lib/aws-apigateway";
import * as path from "path";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53targets from "aws-cdk-lib/aws-route53-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import { Effect } from "aws-cdk-lib/aws-iam";
import { Certificate } from "aws-cdk-lib/aws-certificatemanager";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as ssm from "aws-cdk-lib/aws-ssm";
interface AppStackProps extends StackProps {
  hostedZone: string;
}

export class TranslationSystemStack extends Stack {
  constructor(scope: Construct, id: string, props?: AppStackProps) {
    super(scope, id, props);

    const { hostedZone } = props!;

    const translationsTable = new dynamodb.Table(
      this,
      "language-translation-table",
      {
        partitionKey: {
          name: "owner",
          type: dynamodb.AttributeType.STRING,
        },
        sortKey: {
          name: "language",
          type: dynamodb.AttributeType.STRING,
        },
        tableName: "language-translations",
        billingMode: dynamodb.BillingMode.PROVISIONED,
      }
    );

    const userPoolId = ssm.StringParameter.valueForStringParameter(
      this,
      "/directory/cognito/user-pool"
    );

    const userPool = cognito.UserPool.fromUserPoolId(
      this,
      "platform-directory-user-pool-id",
      userPoolId
    );

    const certificateArn = Fn.importValue("certificate-public-api");

    const certificate = Certificate.fromCertificateArn(
      this,
      "Certificate",
      certificateArn
    );

    const apiDynamodbTranslations = new NodejsFunction(
      this,
      "language-translations-dynamodb-api-handler",
      {
        functionName: "language-translations-dynamodb-api-handler",
        handler: "handler",
        description:
          "Create language translations api that retrieves records from dynamodb",
        entry: path.join(
          __dirname,
          `/../src/language-translations-handler/translations.ts`
        ),
        runtime: lambda.Runtime.NODEJS_14_X,
        timeout: Duration.minutes(1),
        environment: {
          TRANSLATION_TABLE: translationsTable.tableName,
        },
      }
    );

    translationsTable.grantReadWriteData(apiDynamodbTranslations);

    apiDynamodbTranslations.grantInvoke(
      new iam.ServicePrincipal("apigateway.amazonaws.com")
    );

    const publicZone = route53.HostedZone.fromLookup(
      this,
      "public-hosted-zone",
      {
        privateZone: false,
        domainName: hostedZone,
      }
    );

    const apiResourcePolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          effect: Effect.ALLOW,
          actions: ["execute-api:Invoke"],
          principals: [new iam.AnyPrincipal()],
          resources: ["execute-api:/*"],
        }),
      ],
    });

    const restApi = new LambdaRestApi(this, `language-translations-api`, {
      handler: apiDynamodbTranslations,
      description:
        "Platform Directory API includes language translations related to the catalogs",
      deployOptions: {
        stageName: process.env.ENV,
      },
      defaultCorsPreflightOptions: {
        allowHeaders: ["Content-Type", "Authorization"],
        allowMethods: ["OPTIONS", "GET", "POST", "PUT", "PATCH", "DELETE"],
        allowCredentials: true,
        allowOrigins: [
          `https://workflows.${hostedZone}`,
          "http://localhost:8080",
        ],
      },
      restApiName: "language-translations-api",
      proxy: false,
      policy: apiResourcePolicy,
    });

    restApi.addDomainName("language-translations-api", {
      domainName: `translations.api.${hostedZone}`,
      certificate: certificate,
    });

    new route53.ARecord(
      this,
      "custom-domain-alias-record-language-translations",
      {
        recordName: "translations.api",
        zone: publicZone,
        target: route53.RecordTarget.fromAlias(
          new route53targets.ApiGateway(restApi)
        ),
      }
    );

    const authorizer = new CognitoUserPoolsAuthorizer(
      this,
      "api-gateway-cognito-authorizer",
      {
        cognitoUserPools: [userPool],
        authorizerName: "cognito-authorizer",
        identitySource: "method.request.header.Authorization",
      }
    );

    const translations = restApi.root.addResource("translations");
    const ownerTranslations = translations.addResource("{owner}");
    const lnTranslations = translations.addResource("ln");
    const getOwnerTranslations = lnTranslations.addResource("{owner}");

    ownerTranslations.addMethod(
      "POST",
      new LambdaIntegration(apiDynamodbTranslations)
    );

    ownerTranslations.addMethod(
      "GET",
      new LambdaIntegration(apiDynamodbTranslations)
    );

    getOwnerTranslations.addMethod(
      "GET",
      new LambdaIntegration(apiDynamodbTranslations),
      {
        authorizer: authorizer,
        authorizationType: AuthorizationType.COGNITO,
      }
    );

    getOwnerTranslations.addMethod(
      "DELETE",
      new LambdaIntegration(apiDynamodbTranslations),
      {
        authorizer: authorizer,
        authorizationType: AuthorizationType.COGNITO,
      }
    );

    getOwnerTranslations.addMethod(
      "PUT",
      new LambdaIntegration(apiDynamodbTranslations),
      {
        authorizer: authorizer,
        authorizationType: AuthorizationType.COGNITO,
      }
    );
  }
}
