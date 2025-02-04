const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = process.env.MONGOURI;
const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
  });

  export default client;