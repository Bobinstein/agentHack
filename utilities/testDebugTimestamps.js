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

console.log("🔍 Debug Timestamps Test");
console.log("=======================");
console.log("Target Process:", processId);
console.log("My Address:", myAddress);
console.log("=======================\n");

// Helper function to wait for a response
async function waitForResponse(txId, description, expectedAction) {
  console.log(`⏳ Waiting for response to: ${description}`);

  try {
    // Wait a bit for the message to be processed
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const response = await result({
      process: processId,
      message: txId,
    });

    if (response && response.Messages && response.Messages.length > 0) {
      const messages = response.Messages;
      console.log(`📨 Received ${messages.length} response(s):`);

      messages.forEach((msg, index) => {
        console.log(`  ${index + 1}. Full Message:`);
        console.log(JSON.stringify(msg, null, 2));
      });

      return "success";
    } else {
      console.log("⚠️ No response messages found");
      return "none";
    }
  } catch (error) {
    console.log(`❌ Error checking response: ${error.message}`);
    return "error";
  }
}

// Test the Debug-Timestamps handler
async function testDebugTimestamps() {
  console.log("🔍 Testing Debug-Timestamps Handler");
  console.log("==================================================");
  console.log("This will trigger the Debug-Timestamps handler to analyze:");
  console.log("- Current timestamps and date conversions");
  console.log("- Day boundary calculations");
  console.log("- Time range function results for all events");
  console.log("- Event filtering logic");

  try {
    const txId = await message({
      process: processId,
      tags: [{ name: "Action", value: "Debug-Timestamps" }],
      signer: createDataItemSigner(jwk),
      data: "Debug timestamp calculations and time range functions",
    });

    console.log("Debug-Timestamps message sent, TX ID:", txId);
    console.log("✅ Debug-Timestamps Request: SENT");

    // Wait for response
    await waitForResponse(
      txId,
      "Debug-Timestamps Request",
      "debug-timestamps-complete"
    );
  } catch (error) {
    console.log("❌ Debug-Timestamps Request: FAILED -", error.message);
  }
}

// Main test runner
async function runTest() {
  console.log("🚀 Starting Debug Timestamps Test\n");

  await testDebugTimestamps();

  console.log("\n📊 Test Summary");
  console.log("=======================");
  console.log("✅ Debug-Timestamps handler triggered");
  console.log("\n🔍 Expected Results:");
  console.log("- Current timestamp analysis");
  console.log("- Date conversion verification");
  console.log("- Day boundary calculations");
  console.log("- Time range function tests for all events");
  console.log("- Event filtering logic verification");
  console.log("\n📋 What This Tests:");
  console.log("1. os.time() return value and format");
  console.log("2. timestampToDate() conversion accuracy");
  console.log("3. dateToTimestamp() boundary calculations");
  console.log("4. isToday(), isThisWeek(), isThisMonth() functions");
  console.log("5. Day boundary logic for event filtering");
  console.log("6. All calendar events and their time classifications");
  console.log("\n💡 This will help identify:");
  console.log("- Why events aren't being detected as 'today'");
  console.log("- Date calculation accuracy issues");
  console.log("- Time range function behavior");
  console.log("- Event filtering logic problems");
}

// Execute the test
runTest().catch(console.error);
