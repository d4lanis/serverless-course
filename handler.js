const { v4: uuidv4 } = require("uuid");
const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({ region: process.env.REGION });
const doc = DynamoDBDocumentClient.from(client);

const sqsClient = new SQSClient({ region: process.env.REGION });

exports.newOrder = async (event) => {
  const orderId = uuidv4();
  console.log("orderId", orderId);

  try {
    orderDetails = JSON.parse(event.body);
  } catch (error) {
    console.log(error);
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "Bad request",
      }),
    };
  }

  console.log("orderDetails", orderDetails);

  const order = { orderId, ...orderDetails };

  await saveOrder(order);

  await sendMessagetoQueue(order, process.env.ORDERS_TO_SEND_QUEUE);

  return {
    statusCode: 200,
    body: JSON.stringify({ message: order }),
  };
};

exports.getOrder = async (event) => {
  console.log(event);

  const orderId = event.pathParameters.orderId;

  const orderDetails = {
    orderId,
    orderStatus: "pending",
  };

  const order = { orderId, ...orderDetails };

  return {
    statusCode: 200,
    body: JSON.stringify({ message: order }),
  };
};

exports.prepareOrder = async (event) => {
  const body = JSON.parse(event.Records[0].body);
  const orderId = body.orderId;

  await updateStatusInOrder(orderId, "COMPLETED");

  return console.log(event);
};

exports.sendOrder = async (event) => {
  console.log(event);

  const order = {
    orderId: event.orderId,
    pizza: event.pizza,
    customerId: event.pizza,
  };

  await sendMessagetoQueue(order, process.env.ORDERS_TO_SEND_QUEUE);
};

async function sendMessagetoQueue(message, queueURL) {
  const params = {
    QueueUrl: queueURL,
    MessageBody: JSON.stringify(message),
  };

  console.log(params);

  try {
    const command = new SendMessageCommand(params);
    const data = await sqsClient.send(command);
    console.log("Message sent", data);

    return data;
  } catch (error) {
    console.error("Error sending message", error);
    throw error;
  }
}

async function saveOrder(order) {
  const params = {
    TableName: process.env.ORDERS_TABLE,
    Item: order,
  };

  console.log(params);

  try {
    const command = new PutCommand(params);
    const response = await doc.send(command);
    console.log("order saved", response);

    return response;
  } catch (error) {
    console.error("Error saving order", error);
    throw error;
  }
}

async function updateStatusInOrder(orderId, status) {
  const params = {
    TableName: process.env.ORDERS_TABLE,
    Key: { orderId },
    UpdateExpression: "SET orderStatus = :c",
    ExpressionAttributeValues: {
      ":c": status,
    },
    ReturnValues: "ALL_NEW",
  };

  console.log(params);

  try {
    const command = new UpdateCommand(params);
    const response = await doc.send(commnand);

    console.log("Iitem updated", response);

    return response.Attributes;
  } catch (error) {
    console.error("Error updating item", error);
    throw error;
  }
}
