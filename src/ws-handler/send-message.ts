const AWS = require("aws-sdk");

const ddb = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });

const { TABLE_NAME } = process.env;

export async function handler(event: any) {
  let connectionData;

  try {
    connectionData = await ddb
      .scan({ TableName: TABLE_NAME, ProjectionExpression: "connectionId" })
      .promise();
  } catch (e: any) {
    return { statusCode: 400, body: e.stack };
  }

  const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    endpoint:
      event.requestContext.domainName + "/" + event.requestContext.stage,
  });

  const postData = JSON.parse(event.body).data;

  const postCalls = connectionData.Items.map(async ({ connectionId }: any) => {
    try {
      await apigwManagementApi
        .postToConnection({ ConnectionId: connectionId, Data: postData })
        .promise();
    } catch (e: any) {
      if (e.statusCode === 410) {
        console.log(`Found stale connection, deleting ${connectionId}`);
        await ddb
          .delete({ TableName: TABLE_NAME, Key: { connectionId } })
          .promise();
      } else {
        throw e;
      }
    }
  });

  try {
    await Promise.all(postCalls);
  } catch (e: any) {
    return { statusCode: 400, body: e.stack };
  }

  return { statusCode: 200, body: "Data sent." };
}
