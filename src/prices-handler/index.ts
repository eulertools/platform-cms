const AWS = require("aws-sdk");

const ddb = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });

export async function handler(event: any) {
  let connectionData;

  try {
    connectionData = await ddb
      .scan({
        TableName: process.env.WS_CONNECTION_TABLE_NAME,
        ProjectionExpression: "connectionId",
      })
      .promise();
  } catch (e: any) {
    console.log({
      message: "Failed while fetching the connection: ",
      error: JSON.stringify(e),
    });
    return { statusCode: 400, body: e.stack };
  }

  const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    endpoint: process.env.WS_CONNECTION_API_DOMAIN_NAME,
  });

  const postData = event.Records.map((record: any) => {
    return record.dynamodb.NewImage.prices.S;
  });

  const postCalls = connectionData.Items.map(async ({ connectionId }: any) => {
    try {
      await apigwManagementApi
        .postToConnection({
          ConnectionId: connectionId,
          Data: postData[0],
        })
        .promise()
        .then(() => {
          console.log({ message: "Posted successfully" });
        })
        .catch((err: any) => {
          console.log({
            message: "Failed while posting the data to the connections: ",
            error: JSON.stringify(err),
          });
          throw err;
        });
    } catch (e: any) {
      console.log({
        message: "Failed while fetching the connection: ",
        error: JSON.stringify(e),
      });
      if (e.statusCode === 410) {
        console.log(`Found stale connection, deleting ${connectionId}`);
        await ddb
          .delete({
            TableName: process.env.WS_CONNECTION_TABLE_NAME,
            Key: { connectionId },
          })
          .promise();
      } else {
        throw e;
      }
    }
  });

  try {
    await Promise.all(postCalls);
  } catch (e: any) {
    console.log({
      message: "Failed, error occured: ",
      error: JSON.stringify(e),
    });

    return { statusCode: 400, body: e.stack };
  }

  return { statusCode: 200, body: "Data sent." };
}
