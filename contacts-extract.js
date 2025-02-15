const mongoClient = require("./mongoose");
require("dotenv").config();
let collection;

async function initDB() {
    
  try {
    await mongoClient.connect(process.env.MONGOURI);
    console.log("Connected to MongoDB Atlas");
    const db = mongoClient.db();
    collection = db.collection("sentContacts");
  } catch (error) {
    throw error;
  }
}



let string = `2349047258875@c.us,2349064948063@c.us,2347047248405@c.us,2348133727380@c.us,2347047443129@c.us,2349038698180@c.us,2349031516436@c.us,2349137718782@c.us,2348074363382@c.us,2349158774256@c.us,2349070893234@c.us,2348058218010@c.us,2348142822339@c.us,2349047258875@c.us,2349011903698@c.us`

const numbers = string.split(",");
console.log(Array.isArray(numbers));

async function runInsert () {
    for (const number of numbers) {
    await collection.insertOne({
        contactID: number,
        sentAt: new Date().toLocaleTimeString("en-NG", {
          timeZone: "Africa/Lagos",
        }),
      });
      console.log(`Insert ${number} to database`);
}
}


initDB()
  .then(()=>{
    console.log("Atlas Ready to be worked with")
    runInsert().then(() => {
        console.log('Done inserting');
    }).catch(err => {
        throw err
    })
})
  .catch(async () => {
    process.exit(1);
  });