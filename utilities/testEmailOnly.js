const {
  message,
  result,
  createDataItemSigner,
} = require("@permaweb/aoconnect");
const fs = require("fs");

// Configuration
const processId = "av9iNwK-M5EWKktelUuXd9fXAaaJAQfiTc84DGpuFCk"; // Your process ID
const myAddress = "j6R9ITLNyll_nckPdnvUGz_sSdnuLVGFIWbymj72SJM"; // Your wallet address

// Load your wallet
const jwk = JSON.parse(fs.readFileSync("/home/stephen/.aos.json"));

// Helper function to wait for response
async function waitForResponse(txId, testName, expectedAction) {
  console.log(`⏳ Waiting for response to: ${testName}`);

  // Wait a bit for the message to be processed
  await new Promise((resolve) => setTimeout(resolve, 5000));

  try {
    const response = await result({
      process: processId,
      message: txId,
    });

    if (response && response.Messages && response.Messages.length > 0) {
      console.log(`✅ ${testName}: RESPONSE RECEIVED`);
      console.log(`   Messages: ${response.Messages.length}`);

      // Look for the specific action we expect
      const targetMessage = response.Messages.find(
        (msg) =>
          msg.Action === expectedAction ||
          msg.Action === "daily-email-update-sent" ||
          msg.Action === "daily-email-relay-sent"
      );

      if (targetMessage) {
        console.log(`   Found message: ${targetMessage.Action}`);
        if (targetMessage.Data) {
          console.log(`   Data: ${targetMessage.Data}`);
        }
      }
    } else {
      console.log(`⚠️ ${testName}: No messages in response`);
    }
  } catch (error) {
    console.log(`❌ ${testName}: Error checking response - ${error.message}`);
  }
}

// Test the cron-daily-email handler
async function testDailyEmail() {
  console.log("\n📧 Testing Daily Email Handler");
  console.log("==================================================");
  console.log(
    "This test assumes weather and calendar caches are already populated."
  );
  console.log("It will trigger the cron-daily-email handler directly.");

  try {
    const txId = await message({
      process: processId,
      tags: [
        { name: "Action", value: "cron-daily-email" },
        { name: "Email-To", value: "stephen@gigautility.com" },
        { name: "Email-Name", value: "Stephen" },
      ],
      signer: createDataItemSigner(jwk),
      data: "Generate daily email summary",
    });

    console.log("Daily email message sent, TX ID:", txId);
    console.log("✅ Daily Email Request: SENT");

    // Wait for response
    await waitForResponse(
      txId,
      "Daily Email Request",
      "daily-email-update-sent"
    );

    const actions = await result({process: processId, message: txId});
    console.log(actions);
  } catch (error) {
    console.log("❌ Daily Email Request: FAILED -", error.message);
  }
}

// Run the test
async function runTest() {
  console.log("📧 Email-Only Test");
  console.log("=======================");
  console.log("Target Process:", processId);
  console.log("My Address:", myAddress);
  console.log("=======================");

  console.log("\n🚀 Starting Email Test");

  await testDailyEmail();

  console.log("\n📊 Test Summary");
  console.log("=======================");
  console.log("✅ Daily email handler triggered");
  console.log("\n📧 Expected Result:");
  console.log("- Handler should query calendar and weather caches");
  console.log("- Email relay request should be sent to Brevo API");
  console.log("- No response message expected (cron job behavior)");
  console.log("\n🔑 What Happens:");
  console.log("1. Handler queries actual calendar events for tomorrow");
  console.log("2. Handler checks actual weather cache for current/daily data");
  console.log("3. HTML email generated with real data");
  console.log("4. Relay request sent to Brevo API via mock relay");
  console.log("5. Email sent to stephen@gigautility.com");
}

// Execute the test
runTest().catch(console.error);
