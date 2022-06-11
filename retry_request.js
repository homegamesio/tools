const aws = require('aws-sdk');

const requestId = '';

if (requestId) {
    const dynamoClient = new aws.DynamoDB({ region: 'us-west-2' });

    const params = {
        TableName: 'publish_requests',
        Limit: 1,
        IndexName: 'request_id-index',
        ExpressionAttributeNames: {
            '#requestId': 'request_id'
        },
        ExpressionAttributeValues: {
            ':requestId': {
                S: requestId
            }
        },
        KeyConditionExpression: '#requestId = :requestId'
    }

    console.log(params);

    dynamoClient.query(params, (err, result) => {
        console.log('wat this');
        console.log(err);
        console.log(result);
        const gameId = result.Items[0].game_id.S;
        const sourceInfoHash = result.Items[0].source_info_hash.S;
        const messageBody = JSON.stringify({
            gameId,
            sourceInfoHash,
            squishVersion: result.Items[0].squish_version.S
        });
    
        const sqsParams = {
            MessageBody: messageBody,
            MessageGroupId: `${Date.now()}`,
            MessageDeduplicationId: requestId,
            QueueUrl: // insert here
        }
    
        const sqs = new aws.SQS({ region: 'us-west-2' });
    
        sqs.sendMessage(sqsParams, (err, sqsResponse) => {
            console.log('sent request?');
            console.log(err);
            console.log(sqsResponse);
        });
    });
} else {
    console.log('request id required');
}
