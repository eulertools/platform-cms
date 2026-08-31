import { getHeaders } from "../headers-helper";

const AWS = require("aws-sdk");
AWS.config.update({ region: process.env.AWS_REGION });

const ddbClient = new AWS.DynamoDB.DocumentClient();

export async function handler(event: any, context: any, callback: any) {
  let body;
  let statusCode = 200;
  const headers = getHeaders(event);

  let path = event.resource;
  let httpMethod = event.httpMethod;
  let route = httpMethod.concat(" ").concat(path);

  try {
    switch (route) {
      case "POST /translations/{owner}":
        const translationsData = JSON.parse(event.body);
        const putParams = {
          TableName: process.env.TRANSLATION_TABLE,
          Item: {
            owner: event.pathParameters.owner,
            language: translationsData.language,
            namespace: translationsData.namespace,
            content: translationsData.content,
            created_at: new Date().toISOString(),
            deleted_at: "-",
            isDelete: false,
          },
        };
        try {
          console.log({ message: "Inserting" });
          await ddbClient.put(putParams).promise();
          console.log({ message: "Inserted Successfully" });
          body = "Records Inserted Successfully";
        } catch (err: any) {
          console.log({
            message: "Failed while inserting language, error occured: ",
            error: JSON.stringify(err),
          });
          statusCode = 400;
          body = err.message;
        }
        break;
      case "GET /translations/{owner}":
        const getOneQueryString = event.queryStringParameters;
        const readLanguageParams = {
          TableName: process.env.TRANSLATION_TABLE,
          KeyConditionExpression: "#owner = :owner",
          ExpressionAttributeNames: {
            "#owner": "owner",
          },
          ExpressionAttributeValues: {
            ":owner": event.pathParameters.owner,
          },
        };
        if (getOneQueryString) {
          const readOneLanguageParams = {
            TableName: process.env.TRANSLATION_TABLE,
            KeyConditionExpression: "#owner = :owner and #language = :language",
            ExpressionAttributeNames: {
              "#owner": "owner",
              "#language": "language",
            },
            ExpressionAttributeValues: {
              ":owner": event.pathParameters.owner,
              ":language": getOneQueryString.language,
            },
          };
          try {
            const items = await ddbClient
              .query(readOneLanguageParams)
              .promise()
              .then((res: any) => {
                return res.Items;
              });
            const result = items.filter((item: any) => {
              return item.namespace === getOneQueryString.namespace;
            });
            body = result;
          } catch (err: any) {
            console.log({
              message: "Failed while retrieveing language, error occured: ",
              error: JSON.stringify(err),
            });
            statusCode = 400;
            body = err.message;
          }
        } else {
          try {
            body = await ddbClient.query(readLanguageParams).promise();
          } catch (err: any) {
            console.log({
              message: "Failed while retrieveing language, error occured: ",
              error: JSON.stringify(err),
            });
            statusCode = 400;
            body = err.message;
          }
        }
        break;
      case "GET /translations/ln/{owner}":
        const getQuerySting = event.queryStringParameters;
        const readlanguageByIDParams = {
          TableName: process.env.TRANSLATION_TABLE,
          KeyConditionExpression: "#owner = :owner and #language = :language",
          ExpressionAttributeNames: {
            "#owner": "owner",
            "#language": "language",
          },
          ExpressionAttributeValues: {
            ":owner": event.pathParameters.owner,
            ":language": getQuerySting.language,
          },
        };
        try {
          const items = await ddbClient
            .query(readlanguageByIDParams)
            .promise()
            .then((res: any) => {
              return res.Items;
            });
          const result = items.filter((item: any) => {
            return item.namespace === getQuerySting.namespace;
          });
          body = result;
        } catch (err: any) {
          console.log({
            message: "Failed while retrieveing language, error occured: ",
            error: JSON.stringify(err),
          });
          statusCode = 400;
          body = err.message;
        }
        break;
      case "PUT /translations/ln/{owner}":
        const putQueryString = event.queryStringParameters;
        const data = JSON.parse(event.body);
        const getlanguageParams = {
          TableName: process.env.TRANSLATION_TABLE,
          KeyConditionExpression: "#owner = :owner and #language = :language ",
          ExpressionAttributeNames: {
            "#owner": "owner",
            "#language": "language",
          },
          ExpressionAttributeValues: {
            ":owner": event.pathParameters.owner,
            ":language": putQueryString.language,
          },
        };
        try {
          const items = await ddbClient
            .query(getlanguageParams)
            .promise()
            .then((record: any) => {
              return record.Items;
            });
          const filteredData = items.filter((item: any) => {
            return item.namespace === putQueryString.namespace;
          });
          filteredData.forEach(async (item: any) => {
            Object.assign(item, data);
            await ddbClient
              .put({
                TableName: process.env.TRANSLATION_TABLE,
                Item: item,
              })
              .promise();
          });
          body = "Language updated successfully";
        } catch (err: any) {
          console.log({
            message: "Failed while updating language, error occured: ",
            error: JSON.stringify(err),
          });
          statusCode = 400;
          body = err.message;
        }
        break;
      case "DELETE /translations/ln/{owner}":
        const delQueryString = event.queryStringParameters;
        const updateDeleteparams = {
          TableName: process.env.TRANSLATION_TABLE,
          KeyConditionExpression: "#owner = :owner and #language = :language",
          ExpressionAttributeNames: {
            "#owner": "owner",
            "#language": "language",
          },
          ExpressionAttributeValues: {
            ":owner": event.pathParameters.owner,
            ":language": delQueryString.language,
          },
        };
        try {
          const res = await ddbClient.query(updateDeleteparams).promise();
          if (res) {
            const data = res.Items.filter((item: any) => {
              return item.namespace === delQueryString.namespace;
            });
            data.forEach(async (record: any) => {
              if (!record.isDelete) {
                record.deleted_at = new Date().toISOString();
                record.isDelete = true;
                const updateDeleteParam = {
                  TableName: process.env.TRANSLATION_TABLE,
                  Item: record,
                };
                await ddbClient.put(updateDeleteParam).promise();
              }
            });
          }
          body = "Records Deleted Successfully";
        } catch (err: any) {
          console.log({
            message: "Failed while deleting language, error occured: ",
            error: JSON.stringify(err),
          });
          statusCode = 400;
          body = err.message;
        }
        break;
      default:
        throw new Error(`Unsupported route: "${route}"`);
    }
  } catch (err: any) {
    console.log({ error: JSON.stringify(err) });
    statusCode = 400;
    body = err.message;
  } finally {
    console.log({ data: body });
    body = JSON.stringify(body);
  }

  return {
    statusCode,
    body,
    headers,
  };
}
