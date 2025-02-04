const venom = require("venom-bot");
const mongodb = require("mongoose");
const contacts = [
  "2349151008824@s.whatsapp.net",
  "2349010623835@s.whatsapp.net",
];

const message = `Hello, How are You, Bro`;
const noOfRetries = 0;
const venom_object = await venom.create();
venom_object(async (client) => {
  for (let i = 0; i < contacts.length; i++) {
    try {
      await client.sendText(contacts[i], message);
      console.log(`Message Sent to ${contacts[i]}`);
      contacts.splice(i, 1); // first value gets index to be removed. second value chooses number of values to be removed. If not specified, removes till end of array
      let delayVal = Number(Math.random().toFixed(2)) * 5;
      if (delayVal < 2) {
        let diff = 2 - val;
        delayVal = delayVal + diff;
      }
      delayVal = delayVal * 60 * 1000;
      noOfRetries = 0;
      await new Promise(setTimeout(resolve, delayVal));
    } catch (error) {
      noOfRetries++;
      console.error(error);
      if (noOfRetries < 2) {
        console.log(`Retrying Message for ${contacts[i]}`);
        i--;
      } else {
        console.log(
          `Unable to Send Message to ${contacts[i]}. Moving to the Next!`
        );
        noOfRetries = 0;
      }
    } finally {
        // Save Contacts as Sent to DB
    }
  }
});