const app = require("express")();
const venom = require("venom-bot");
const mongoClient = require("./mongoose");
const { DateTime } = require("luxon");
const cron = require("node-cron");
const keepAlive = require("./keepAlive");

let sentContactsCollections;
let data;
let stopBot = false;
let noOfRetries = 0;

const identifiers = {
  groupIdentifier: "g.us",
  groupName: "INFORMATION GROUP",
  groupID: "",
};

async function initDB() {
  try {
    await mongoClient.connect();
    console.log("Connection to MongoDB Successful");
    const db = mongoClient.db();
    sentContactsCollections = db.collection("sentContacts");
  } catch (error) {
    throw error;
  }
}
initDB()
  .then(console.log("Moving on"))
  .catch(async (error) => {
    await initDB();
  });

process.on("SIGINT", async () => {
  console.log("Shutting down bot...");
  await mongoClient.close();
  process.exit(0);
});

function getLocalTime() {
  return DateTime.now().setZone("Africa/Lagos");
}

async function startBot() {
  const client = await createClientWithRetry();
  async function createClientWithRetry(retries = 3) {
    while (retries > 0) {
      try {
        const c = await venom.create({
          session: "whatsapp-bot",
          multidevice: true,
          headless: "new",
          logQR: true,
          folderNameToken: process.env.FOLDER_DIR,
          autoClose: 0,
        });
        console.log("Venom bot is ready!");
        retries = 0;
        return c;
      } catch (error) {
        console.error("Venom failed to start:", error);
        retries--;
        if (retries === 0)
          throw new Error("Max retries reached. Bot shutting down.");
        console.log(`Retrying venom-bot... Attempts left: ${retries}`);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  const chats = await client.getAllChats();
  for (const chat of chats) {
    const gI = chat.id.server;
    const gN = chat.contact.name;
    if (
      gI === identifiers.groupIdentifier &&
      gN === identifiers.groupName
    ) {
      identifiers.groupID = chat.id._serialized;
      data = await getGroupContacts(client);
      console.log(`Found Group chat: ${gN}. Exiting Loop.`);
      break;
    }
  }

  const mem = data.gMembers;
  for (let i = 0; i < mem.length; i++) {
    // Loops through the group members of specified group
    if (stopBot === true) {
      stopBot = false; // reset for next schedule
      console.log("Stoping Bot because schedule exceeded...");
      return; // end loop prematurely
    }

    try {
      // Check if current member has been contacted before (In database & if name property on recepientObject exists)
      // Send msg if no
      // Save to database collection as sent
      // Move to next member
      console.log(
        `Checking if ${data.gMembers[i].id._serialized} is in contacts...`
      );
      const recepientObject = await client.getContact(mem[i].id._serialized);
      console.log(recepientObject);
      const recepientID = recepientObject.id._serialized;

      // Check if contact is in DB
      const isContacted = await sentContactsCollections.findOne({
        contactID: recepientID,
      });

      if (isContacted || recepientObject.name) {
        console.log(
          `Already messaged ${recepientID}(${
            recepientObject.pushname || recepientObject.name
          }). Skipping...`
        );
        if (recepientObject.name) {
          const a = await sentContactsCollections.findOne({ contactID: recepientID });
          if (!a) await sentContactsCollections.insertOne({ contactID: recepientID , addedAt: new Date() })
        }
        continue;
      }

      // It means we have never interacted. Therefore, send message
      console.log(`Attempting to reach group ${recepientID}...`);
      await client.sendText(recepientID, ".");
      const newRecepientObject = await client.getContact(recepientID);
      const recepientName = newRecepientObject.pushname;
      await client.sendText(recepientID, getMessageText(recepientName));
      await sentContactsCollections.insertOne({
        contactID: recepientID,
        sentAt: new Date().toLocaleTimeString("en-NG", {
          timeZone: "Africa/Lagos",
        }),
      });

      let delayVal = getDelay();
      console.log(`Delay added is - ${delayVal}`);
      noOfRetries = 0;
      await new Promise((resolve) => setTimeout(resolve, delayVal));
    } catch (error) {
      noOfRetries++;
      console.error(error);
      if (noOfRetries < 3) {
        console.log(`Retrying message for ${recepientID}`);
        i--;
      } else {
        console.log(
          `Unable to Send message to ${recepientID}. ${
            i + 1 === data.gMembers.length
              ? `Done with script!`
              : `Moving to the next`
          }`
        );
        let delayVal = getDelay();
        console.log(`Delay added is - ${delayVal}`);
        noOfRetries = 0;
        await new Promise((resolve) => setTimeout(resolve, delayVal));
      }
    }
  }
}

function getDelay() { // Random delay between 3 and 5 mins
  let delayVal = Math.random() * (5 - 3) + 3; 
  return delayVal * 60 * 1000; // Convert to milliseconds
}

async function getGroupContacts(client) {
  try {
    const gMembers = await client.getGroupMembers(identifiers.groupID);
    const allContacts = await client.getAllChats();
    return { gMembers, allContacts };
  } catch (error) {
    console.error(error);
  }
}

function getMessageText(recepientName) {
  const isNameAvail = recepientName ? true : false;
  const messageText = `Hey${
    isNameAvail ? `, ${recepientName}` : ""
  }. \nI am Joseph, although you may or maynot know me as whitePhosphorus...which doesn't really matter rn. \nAnyway, I'm just looking to get familiar with a little more persons from our department - especially as we head into 200 level. Kindly Save up my number, then tell me what I should save yours as...Hopefully, we proceed from there 🙂.\nLooking forward to a reply 😇. \n\n`;
  return messageText;
}

cron.schedule(`${process.env.EVENING_SCHEDULE_TIME}`, async () => {
  const interval = setInterval(() => {
    const now = getLocalTime();
    if (now.hour >= 21) {
      clearInterval(interval);
      console.log(
        `Ending evening session at ${new Date().toLocaleTimeString("en-NG", {
          timeZone: "Africa/Lagos",
        })}`
      );
      setStopBot();
      return;
    }
  }, 1 * 60 * 1000);
  await startBot();
});

cron.schedule(`${process.env.MORNING_SCHEDULE_TIME}`, async () => {
  const interval = setInterval(() => {
    const now = getLocalTime();
    if (now.hour >= 12) {
      clearInterval(interval);
      console.log(
        `Ending evening session at ${new Date().toLocaleTimeString("en-NG", {
          timeZone: "Africa/Lagos",
        })}`
      );
      setStopBot();
      return;
    }
  }, 1 * 60 * 1000);
  await startBot();
});

function setStopBot() {
  stopBot = true;
}

const PORT = process.env.PORT;
const HOST = process.env.HOST;
app.listen(PORT, HOST, () => {
  console.log(`Server is Running on ${PORT}`);
});

app.get("/", (req, res) => {
  res.status(200).send({ status: true, message: "alive" });
});