const {
  message,
  result,
  createDataItemSigner,
} = require("@permaweb/aoconnect");
const fs = require("fs");

const processId = "av9iNwK-M5EWKktelUuXd9fXAaaJAQfiTc84DGpuFCk";
const myAddress = "j6R9ITLNyll_nckPdnvUGz_sSdnuLVGFIWbymj72SJM";

const jwk = JSON.parse(fs.readFileSync("/home/stephen/.aos.json"));

console.log("📧 Daily Email Test");
console.log("=======================");
console.log("Target Process:", processId);
console.log("My Address:", myAddress);
console.log("=======================\n");

// Helper function to wait for a response and check if it was cached or relayed
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
        const action =
          msg.Tags?.find((tag) => tag.name === "Action")?.value || "Unknown";
        const target = msg.Target || "Unknown";
        const source =
          msg.Tags?.find((tag) => tag.name === "Source")?.value || "Unknown";

        console.log(
          `  ${
            index + 1
          }. Action: ${action} | Target: ${target} | Source: ${source}`
        );

        if (msg.Data) {
          console.log(
            `     Data: ${msg.Data.substring(0, 100)}${
              msg.Data.length > 100 ? "..." : ""
            }`
          );
        }
      });

      // Check if this was a relay request or cached response
      const hasRelayMessage = messages.some(
        (msg) => msg.Target === "L7ZEASGMlsjY2AMpTwbX178slBpaHJJxznWN8oywiZY"
      );

      if (hasRelayMessage) {
        console.log("🔄 Response: RELAY REQUEST SENT (will cache result)");
        return "relay";
      } else {
        console.log("💾 Response: SERVED FROM CACHE");
        return "cache";
      }
    } else {
      console.log("⚠️ No response messages found");
      return "none";
    }
  } catch (error) {
    console.log(`❌ Error checking response: ${error.message}`);
    return "error";
  }
}

// Test 1: Set weather location
async function testSetWeatherLocation() {
  console.log("🔹 Testing Set Weather Location");
  console.log("==================================================");

  try {
    const messageTxId = await message({
      process: processId,
      tags: [
        { name: "Action", value: "set-weather-location" },
        { name: "Location", value: "Little France, NY" },
      ],
      signer: createDataItemSigner(jwk),
      data: "Set weather location to Little France, NY",
    });

    console.log("Set weather location message sent, TX ID:", messageTxId);
    console.log("✅ Set Weather Location: REQUEST SENT");

    // Check response (this should be immediate, no relay needed)
    await waitForResponse(
      messageTxId,
      "Set Weather Location",
      "set-weather-location"
    );
  } catch (error) {
    console.log("❌ Set Weather Location: FAILED -", error.message);
  }
}

// Test 2: Set weather units
async function testSetWeatherUnits() {
  console.log("\n🔹 Testing Set Weather Units");
  console.log("==================================================");

  try {
    const messageTxId = await message({
      process: processId,
      tags: [
        { name: "Action", value: "set-weather-units" },
        { name: "Units", value: "metric" },
      ],
      signer: createDataItemSigner(jwk),
      data: "Set weather units to metric",
    });

    console.log("Set weather units message sent, TX ID:", messageTxId);
    console.log("✅ Set Weather Units: REQUEST SENT");

    // Check response (this should be immediate, no relay needed)
    await waitForResponse(
      messageTxId,
      "Set Weather Units",
      "set-weather-units"
    );
  } catch (error) {
    console.log("❌ Set Weather Units: FAILED -", error.message);
  }
}

// Test 3: Add calendar events
async function testAddCalendarEvents() {
  console.log("\n🔹 Testing Add Calendar Events");
  console.log("==================================================");

  // Add Daily Standup event
  try {
    const timestamps = getTodayTimestamps();

    const standupTxId = await message({
      process: processId,
      tags: [
        { name: "Action", value: "add-event" },
        { name: "Event-Name", value: "Daily Standup" },
        { name: "Start-Time", value: timestamps.standupStart.toString() },
        { name: "End-Time", value: timestamps.standupEnd.toString() },
        { name: "Location", value: "Slack Huddle" },
        { name: "Description", value: "Team standup meeting" },
      ],
      signer: createDataItemSigner(jwk),
      data: "Add daily standup event",
    });

    console.log("Daily Standup event added, TX ID:", standupTxId);
    console.log("✅ Daily Standup Event: ADDED");

    // Check response
    await waitForResponse(standupTxId, "Add Daily Standup Event", "add-event");
  } catch (error) {
    console.log("❌ Daily Standup Event: FAILED -", error.message);
  }

  // Add Friday Night Magic event
  try {
    const timestamps = getTodayTimestamps();
    const fnmTxId = await message({
      process: processId,
      tags: [
        { name: "Action", value: "add-event" },
        { name: "Event-Name", value: "Friday Night Magic" },
        { name: "Start-Time", value: timestamps.fnmStart.toString() },
        { name: "End-Time", value: timestamps.fnmEnd.toString() },
        { name: "Location", value: "LGS" },
        { name: "Description", value: "Friday Night Magic tournament" },
      ],
      signer: createDataItemSigner(jwk),
      data: "Add Friday Night Magic event",
    });

    console.log("Friday Night Magic event added, TX ID:", fnmTxId);
    console.log("✅ Friday Night Magic Event: ADDED");

    // Check response
    await waitForResponse(fnmTxId, "Add Friday Night Magic Event", "add-event");
  } catch (error) {
    console.log("❌ Friday Night Magic Event: FAILED -", error.message);
  }
}

// Test 4: Set current weather cache
async function testSetCurrentWeather() {
  console.log("\n🔹 Testing Set Current Weather Cache");
  console.log("==================================================");

  try {
    const messageTxId = await message({
      process: processId,
      tags: [
        { name: "Action", value: "set-current-weather" },
        { name: "Location", value: "Little France, NY" },
      ],
      signer: createDataItemSigner(jwk),
      data: "Set current weather cache for Little France",
    });

    console.log("Set current weather message sent, TX ID:", messageTxId);
    console.log("✅ Set Current Weather: REQUEST SENT");

    // Check response (this will be a relay request)
    const responseType = await waitForResponse(
      messageTxId,
      "Set Current Weather",
      "set-current-weather"
    );

    if (responseType === "relay") {
      console.log("⏳ Waiting 60 seconds for relay processing and caching...");
      await new Promise((resolve) => setTimeout(resolve, 60000));
      console.log("✅ Current weather cache should now be populated");
    }
  } catch (error) {
    console.log("❌ Set Current Weather: FAILED -", error.message);
  }
}

// Test 5: Set daily weather cache
async function testSetDailyWeather() {
  console.log("\n🔹 Testing Set Daily Weather Cache");
  console.log("==================================================");

  try {
    const messageTxId = await message({
      process: processId,
      tags: [
        { name: "Action", value: "set-daily-weather" },
        { name: "Location", value: "Little France, NY" },
      ],
      signer: createDataItemSigner(jwk),
      data: "Set daily weather cache for Little France",
    });

    console.log("Set daily weather message sent, TX ID:", messageTxId);
    console.log("✅ Set Daily Weather: REQUEST SENT");

    // Check response (this will be a relay request)
    const responseType = await waitForResponse(
      messageTxId,
      "Set Daily Weather",
      "set-daily-weather"
    );

    if (responseType === "relay") {
      console.log("⏳ Waiting 60 seconds for relay processing and caching...");
      await new Promise((resolve) => setTimeout(resolve, 60000));
      console.log("✅ Daily weather cache should now be populated");
    }
  } catch (error) {
    console.log("❌ Set Daily Weather: FAILED -", error.message);
  }
}

// Test 6: Trigger daily email summary
async function testDailyEmailSummary() {
  console.log("\n🔹 Testing Daily Email Summary");
  console.log("==================================================");

  try {
    const messageTxId = await message({
      process: processId,
      tags: [
        { name: "Action", value: "cron-daily-email" },
        { name: "Email-To", value: "stephen@gigautility.com" },
        { name: "Email-Name", value: "Stephen" },
      ],
      signer: createDataItemSigner(jwk),
      data: "Trigger daily email summary",
    });

    console.log("Daily email trigger sent, TX ID:", messageTxId);
    console.log("✅ Daily Email Summary: TRIGGERED");

    // Check response (this will be a relay request)
    const responseType = await waitForResponse(
      messageTxId,
      "Daily Email Summary",
      "cron-daily-email"
    );

    if (responseType === "relay") {
      console.log("⏳ Waiting 60 seconds for email relay processing...");
      await new Promise((resolve) => setTimeout(resolve, 60000));
      console.log("✅ Daily email should have been sent via relay");
    }
  } catch (error) {
    console.log("❌ Daily Email Summary: FAILED -", error.message);
  }
}

// Helper function to get today's date and time as timestamps
function getTodayTimestamps() {
  const now = new Date();
  const currentHour = now.getHours();

  // Create events for today, but ensure they're in the future
  const today = new Date();

  // If it's already past the event times, create events for tomorrow instead
  if (currentHour >= 22) {
    today.setDate(today.getDate() + 1);
  }

  // Set specific times for the target date
  const standupTime = new Date(today);
  standupTime.setHours(12, 0, 0, 0); // 12:00 PM

  const fnmStartTime = new Date(today);
  fnmStartTime.setHours(18, 0, 0, 0); // 6:00 PM

  const fnmEndTime = new Date(today);
  fnmEndTime.setHours(22, 0, 0, 0); // 10:00 PM

  return {
    standupStart: Math.floor(standupTime.getTime()),
    standupEnd: Math.floor(standupTime.getTime() + 30 * 60 * 1000), // +30 minutes
    fnmStart: Math.floor(fnmStartTime.getTime()),
    fnmEnd: Math.floor(fnmEndTime.getTime()),
  };
}

// Main test runner
async function runAllTests() {
  console.log("🚀 Starting Daily Email Test\n");

  // // Step 1: Set up basic configuration
  // console.log("📋 Step 1: Setting up basic configuration...");
  // await testSetWeatherLocation();
  // await testSetWeatherUnits();

  // Step 2: Add calendar events for today
  console.log("\n📅 Step 2: Adding calendar events for today...");
  await testAddCalendarEvents();

  // Step 3: Populate weather caches
  // console.log("\n🌤️ Step 3: Populating weather caches...");
  // await testSetCurrentWeather();
  // await testSetDailyWeather();

  // // Step 4: Wait for all caches to be populated
  // console.log("\n⏳ Step 4: Waiting for all caches to be populated...");
  // console.log(
  //   "⏳ Waiting additional 30 seconds to ensure all relay responses are processed..."
  // );
  // await new Promise((resolve) => setTimeout(resolve, 30000));

  // // Step 5: Trigger daily email summary
  // console.log("\n📧 Step 5: Triggering daily email summary...");
  // await testDailyEmailSummary();

  console.log("\n📊 Test Summary");
  console.log("=======================");
  // console.log("✅ Weather location and units configured");
  console.log("✅ Calendar events added for today");
  // console.log("✅ Weather caches populated via relay");
  // console.log("✅ Daily email summary triggered");
  // console.log("\n📧 Expected Result:");
  // console.log("- Email sent to: stephen@gigautility.com");
  // console.log("- Subject: Daily Summary - [today's date]");
  // console.log("- Content: Schedule + Weather summary");
  // console.log("- Sent via: Brevo API through relay process");
  // console.log("\n🔑 Architecture:");
  // console.log("- Weather handlers: Set/Get pattern in weather.lua");
  // console.log("- Cron handlers: Automated tasks in cron.lua");
  // console.log("- Calendar integration: Event management in calendar.lua");
  // console.log("\n📋 Test Flow:");
  // console.log("1. Set weather location and units");
  // console.log("2. Add calendar events for today");
  // console.log("3. Populate weather caches via relay requests");
  // console.log("4. Trigger cron-daily-email handler");
  // console.log("5. Handler queries actual calendar/weather data");
  // console.log("6. Email generated with real data, not samples");
}

// Run all tests
runAllTests().catch(console.error);
