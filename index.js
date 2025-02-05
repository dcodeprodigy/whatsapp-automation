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
initDB();

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
        const c = await venom
          .create({
            session: "whatsapp-bot",
            multidevice: true,
            headless: true,
            sessionStorage: {
              set: async (key, value) => {
                await mongoClient
                  .db()
                  .collection("venomSessions")
                  .updateOne({ key }, { $set: { value } }, { upsert: true });
              },
              get: async (key) => {
                const doc = await mongoClient
                  .db()
                  .collection("venomSessions")
                  .findOne({ key });
                return doc ? doc.value : null;
              },
              remove: async (key) => {
                await mongoClient
                  .db()
                  .collection("venomSessions")
                  .deleteOne({ key });
              },
            },
            autoClose: 5 * 60 * 1000,
          })
          .then((client) => {
            console.log("Venom bot is ready!");
          });
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
      chat.id.server === identifiers.groupIdentifier &&
      chat.contact.name === identifiers.groupName
    ) {
      identifiers.groupID = chat.id._serialized;
      data = await getGroupContacts(client);
      break;
    }
  }

  for (let i = 0; i < data.gMembers.length; i++) {
    if (stopBot === true) {
      stopBot = false; // reset for next schedule
      return; // end function prematurely
    }

    const recepientID = data.gMembers[i].id._serialized;
    // Loops through the group members of specified group
    try {
      const recepientObject = await client.getContact(recepientID); // Will return 'null' if whatsapp account currently loggedIn has never interacted with the contact before
      const alreadySent = await sentContactsCollections.findOne({
        contactID: recepientID,
      });
      if (alreadySent) {
        console.log(`Already messaged ${recepientID}. Skipping...`);
        continue;
      }

      if (recepientObject == null) {
        // It means we have never interacted. Therefore, send message
        await client.sendText(recepientID, " ");
        const recepientObject = await client.getContact(recepientID);
        const recepientName = recepientObject.pushname;
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
      } else {
        const recepientID = recepientObject.id._serialized;
        data.alreadySaved
          ? data.alreadySaved.push(recepientID)
          : (data.alreadySaved = []);
        noOfRetries = 0;
      }
    } catch (error) {
      noOfRetries++;
      console.error(error);
      if (noOfRetries < 2) {
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

function getDelay() {
  let delayVal = Math.random() * (8 - 5) + 5; // Random number between 5 and 8
  return delayVal * 60 * 1000; // Convert to milliseconds
}

async function getGroupContacts(client) {
  try {
    const gMembers = await client.getGroupMembers(identifiers.groupID);
    const allContacts = await client.getAllContacts();
    return { gMembers, allContacts };
  } catch (error) {
    console.error(error);
  }
}

function getMessageText(recepientName) {
  const isNameAvail = recepientName !== null && recepientName !== undefined;
  const messageText = `Hey${
    isNameAvail ? `, ${recepientName}` : ""
  }. \nI am Joseph, although you may or maynot know me as whitePhosphorus.\nAnyway, I'm just looking to get familiar with a little more persons from our department - as we head into 200 level. Kindly Save up my number, then tell me what I should save yours as...Hopefully, we may proceed from there 🙂.\nLooking forward to a reply 😇. \n\n PS. If this message is sent to you more than once ${
    isNameAvail ? "or the name I addressed you as seems a little off" : ""
  }, please forgive my Script${
    isNameAvail ? "...and your whatsapp display name 😅" : " 🙃"
  }`;
  return messageText;
}

cron.schedule("0 17 * * *", () => {
  startBot();
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
});

cron.schedule("0 9 * * *", () => {
  startBot();
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
});

function setStopBot() {
  stopBot = true;
}

const PORT = process.env.PORT; const HOST = process.env.HOST;
app.listen(PORT, HOST, () => {
  console.log(`Server is Running on ${PORT}`);
})

app.get("/", (req, res) => {
  res.status(200).send({status: true, message: "alive"})
})