const venom = require("venom-bot");
const mongoClient = require("./mongoose");
let sentContactsCollections;
let data;
let noOfRetries = 0;
let time;
const identifiers = {
  groupIdentifier: "g.us",
  groupName: "INFORMATION GROUP",
  groupID: "",
};

async function startBot() {
  try {
    await mongoClient.connect();
    console.log("Connected to MongoDB Successful");
    const db = mongoClient.db();
    sentContactsCollections = db.collection("sentContacts");
  } catch (error) {
    throw error;
  }

  const client = await venom.create({
    session: "whatsapp-bot",
    multidevice: true,
    folderNameToken: "tokens",
    autoClose: 160000,
  });

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
    const recepientID = data.gMembers[i].id._serialized;
    // Loops through the group members of specified group
    try {
      const recepientObject = await client.getContact(recepientID); // Will return 'null' if whatsapp account currently loggedIn has never interacted with the contact before
      const alreadySent = sentContactsCollections.findOne({
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
        await client.sendText(recepientID, getMessageText());
        sentContactsCollections.insertOne({
          contactID: recepientID,
          sentAt: new Date(),
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
  let delayVal = Number(Math.random().toFixed(2)) * 5;
  if (delayVal < 2) {
    let diff = 2 - delayVal;
    delayVal = delayVal + diff;
  }
  delayVal = delayVal * 60 * 1000;
  return delayVal;
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

function getMessageText (recepientName) {
  const isNameAvail = recepientName !== null && recepientName !== undefined;
  const messageText = `Hey${isNameAvail ?  `, ${recepientName}` : "" }. \nI am Joseph, although you may or maynot know me as whitePhosphorus.\nAnyway, I'm just looking to get familiar with a little more persons from our department - as we head into 200 level. Kindly Save up my number, then tell me what I should save yours as...Hopefully, we may proceed from there 🙂.\nLooking forward to a reply 😇. \n\n PS. If this message is sent to you more than once ${isNameAvail ? "or the name I addressed you as seems a little off" : ""}, please forgive my Script${isNameAvail ? "...and your whatsapp display name 😅" : " 🙃"}`;
  return messageText;
}


startBot().then(()=>{
  console.log(data.alreadySaved);
});