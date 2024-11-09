const aws = require('aws-sdk');
const { Binary, MongoClient } = require('mongodb');

const sourceBucket = process.env.SOURCE_BUCKET;
const DB_USERNAME = process.env.DB_USERNAME || '';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'homegames';
const DB_HOST = process.env.DB_HOST;
const DB_PORT = process.env.DB_PORT;

const getMongoClient = () => {
    const uri = DB_USERNAME ? `mongodb://${DB_USERNAME}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}` : `mongodb://${DB_HOST}:${DB_PORT}/${DB_NAME}`;
    const params = {};
    if (DB_USERNAME) {
        params.auth = {
            username: DB_USERNAME,
            password: DB_PASSWORD
        };
        params.authSource = 'admin';
    }

    return new MongoClient(uri, params);
};

const getMongoCollection = (collectionName) => new Promise((resolve, reject) => {
    const client = getMongoClient();
    client.connect().then(() => {
        const db = client.db(DB_NAME);
        const collection = db.collection(collectionName);
        resolve(collection);
    });
});

const s3 = new aws.S3();

// s/o chat gpt
const listAllObjects = async (bucketName) => {
  let isTruncated = true;
  let continuationToken = null;
  const allKeys = [];

  try {
    while (isTruncated) {
      const params = {
        Bucket: bucketName,
        MaxKeys: 1000, // Maximum number of keys per request
        ContinuationToken: continuationToken,
      };

      const data = await s3.listObjectsV2(params).promise();

      data.Contents.forEach((item) => {
        allKeys.push(item.Key);
      });

      isTruncated = data.IsTruncated;
      continuationToken = data.NextContinuationToken;
    }

    return allKeys;
  } catch (error) {
    console.error('Error listing objects:', error);
    throw error;
  }
}; 

const download = (list, assetCollection, documentCollection) => {
    if (!list?.length) {
        return;
    }
    const params = {
        Bucket: sourceBucket,
        Key: list[0]
    }
    console.log('params!');
    console.log(params);
    s3.getObject(params, (err, data) => {
        if (data.ContentLength >= 10 * 1000 * 1000) { // 10 MB max
            console.log('too big, skipping');
        } else {
            const assetId = list[0];
            assetCollection.findOne({ assetId }).then(foundAsset => {
                assetCollection.insertOne({ created: Date.now(), developerId: 'c', name: data.ContentDisposition.replaceAll('attachment; filename=', ''), metadata: {'Content-Type': data.ContentType?.replaceAll('type=', '')}, assetId, size: data.ContentLength }).then(() => {
                    console.log('gonna upload doc + ' + assetId);
                    console.log(data);
                    documentCollection.insertOne({ developerId: 'c', assetId, data: new Binary(data.Body), fileSize: data.ContentLength, fileType: data.ContentType?.substring(5) })
                });
            });
        }
        download(list.slice(1), assetCollection, documentCollection);
    });
}


getMongoCollection('assets').then((assetCollection) => {
    getMongoCollection('documents').then(documentCollection => {
        listAllObjects(sourceBucket).then((res) => {
            console.log('heres everything');
            console.log(res);
            download(res, assetCollection, documentCollection);
        });
    });
});

