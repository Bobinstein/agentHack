/**
 * AgentHack - Test Complete Data Dump Utility
 * Copyright (C) 2024  Stephen
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

require("dotenv").config();
const {
  message,
  result,
  createDataItemSigner,
} = require("@permaweb/aoconnect");
const fs = require("fs");

// Configuration from environment variables
const processId = process.env.AGENT_PROCESS_ID;
const myAddress = process.env.USER_WALLET_ADDRESS;

// Load your wallet from environment variable
const walletPath = process.env.WALLET_PATH.replace(
  "~",
  process.env.HOME || require("os").homedir()
);
const jwk = JSON.parse(fs.readFileSync(walletPath));

console.log("📊 Complete Data Dump Test");
console.log("==========================");
console.log("Target Process:", processId);
console.log("My Address:", myAddress);
console.log("==========================\n");

// Helper function to wait for response
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
            `     Data: ${msg.Data.substring(0, 200)}${
              msg.Data.length > 200 ? "..." : ""
            }`
          );
        }
      });

      // Look for the daily summary response
      const summaryMessage = messages.find(
        (msg) => msg.Action === "daily-summary-response"
      );

      if (summaryMessage) {
        console.log("\n📊 Complete Data Dump Received!");
        console.log("=================================");

        try {
          const completeData = JSON.parse(summaryMessage.Data);

          console.log(`📅 Date: ${completeData.date}`);
          console.log(
            `🕐 Generated At: ${new Date(
              completeData.generatedAt * 1000
            ).toISOString()}`
          );
          console.log(`🌍 Timezone: ${completeData.timezone}`);
          console.log(`📊 Request Type: ${completeData.requestType}`);

          // Note
          if (completeData.note) {
            console.log(`📝 Note: ${completeData.note}`);
          }

          // Portfolio - Show complete data
          if (completeData.portfolio) {
            console.log(
              `💼 Portfolio: ${completeData.portfolio.itemCount || 0} tokens`
            );
            if (completeData.portfolio.totalValue) {
              console.log(
                `💰 Total Value: $${completeData.portfolio.totalValue.toFixed(
                  2
                )}`
              );
            }
            if (completeData.portfolio.rawPortfolio) {
              console.log(
                `📋 Raw Portfolio Data: Available (${
                  Object.keys(completeData.portfolio.rawPortfolio).length
                } entries)`
              );
            }
            if (completeData.portfolio.balances) {
              console.log(
                `📊 Parsed Balances: Available (${
                  Object.keys(completeData.portfolio.balances).length
                } tokens)`
              );
            }
          }

          // Distributions - Show ALL distributions
          if (completeData.distributions) {
            const distCount = Object.keys(completeData.distributions).length;
            console.log(`🪙 Distributions: ${distCount} token types`);

            for (const [tokenType, distData] of Object.entries(
              completeData.distributions
            )) {
              console.log(`   ${tokenType}: ${distData.parsed} tokens`);
              if (distData.usdValue) {
                console.log(`     USD Value: $${distData.usdValue.toFixed(2)}`);
              }
              if (distData.allData) {
                console.log(`     Raw Data: Available`);
              }
            }
          }

          // Calendar - Show ALL events
          if (completeData.calendar) {
            console.log(
              `📅 Calendar: ${
                completeData.calendar.eventCount || 0
              } events today`
            );
            console.log(
              `   Total events: ${completeData.calendar.totalEvents || 0}`
            );
            if (completeData.calendar.allEvents) {
              console.log(
                `   All Events: ${completeData.calendar.allEvents.length} total events available`
              );
            }
            if (completeData.calendar.rawEvents) {
              console.log(`   Raw Events: Complete event data available`);
            }
            if (completeData.calendar.moduleData) {
              console.log(
                `   Module Data: Complete calendar module data available`
              );
            }
          }

          // Weather - Show complete cache data
          if (completeData.weather) {
            console.log(`🌤️ Weather for: ${completeData.weather.location}`);
            if (
              completeData.weather.current &&
              !completeData.weather.current.error
            ) {
              console.log(`   Current: Available`);
            } else {
              console.log(
                `   Current: ${
                  completeData.weather.current?.error || "Unknown"
                }`
              );
            }
            if (
              completeData.weather.daily &&
              !completeData.weather.daily.error
            ) {
              console.log(`   Forecast: Available`);
            } else {
              console.log(
                `   Forecast: ${completeData.weather.daily?.error || "Unknown"}`
              );
            }
            if (completeData.weather.completeCache) {
              console.log(
                `   Complete Cache: All weather cache data available`
              );
            }
            if (completeData.weather.cacheTimestamps) {
              console.log(`   Cache Timestamps: Last updated times available`);
            }
            if (completeData.weather.moduleData) {
              console.log(
                `   Module Data: Complete weather module data available`
              );
            }
          }

          // Token Prices - Show ALL price data
          if (
            completeData.tokenPrices &&
            Object.keys(completeData.tokenPrices).length > 0
          ) {
            console.log(
              `💱 Token Prices: ${
                Object.keys(completeData.tokenPrices).length
              } tokens`
            );
            for (const [ticker, priceData] of Object.entries(
              completeData.tokenPrices
            )) {
              console.log(
                `   ${ticker}: $${priceData.price?.toFixed(6) || "N/A"}`
              );
              if (priceData.allData) {
                console.log(`     Complete Price Data: Available`);
              }
            }
          }

          // System Status - Show complete system info
          if (completeData.system) {
            console.log(
              `🖥️ System: Process ${completeData.system.processId?.substring(
                0,
                8
              )}...`
            );
            console.log(
              `   Uptime: ${completeData.system.uptime || "Unknown"} seconds`
            );
            if (completeData.system.processInfo) {
              console.log(`   Process Info: Complete system details available`);
            }
          }

          // Global state information
          if (completeData.globals) {
            console.log(`🌐 Global State:`);
            console.log(
              `   Calendar Module: ${
                completeData.globals.hasCalendar ? "Available" : "Not Available"
              }`
            );
            console.log(
              `   Weather Module: ${
                completeData.globals.hasWeather ? "Available" : "Not Available"
              }`
            );
            console.log(
              `   Weather Cache: ${
                completeData.globals.hasWeatherCache
                  ? "Available"
                  : "Not Available"
              }`
            );
            console.log(
              `   Token Portfolio: ${
                completeData.globals.hasTokenPortfolio
                  ? "Available"
                  : "Not Available"
              }`
            );
            console.log(
              `   Last Distributions: ${
                completeData.globals.hasLastDist ? "Available" : "Not Available"
              }`
            );
            console.log(
              `   Token Prices: ${
                completeData.globals.hasTokenPrices
                  ? "Available"
                  : "Not Available"
              }`
            );
          }

          // Data size information
          const dataSize = summaryMessage.Tags?.find(
            (tag) => tag.name === "Data-Size"
          )?.value;
          if (dataSize) {
            console.log(`📏 Data Size: ${dataSize} characters`);
          }
        } catch (parseError) {
          console.log("❌ Error parsing complete data:", parseError.message);
          console.log("Raw data:", summaryMessage.Data);
        }
      } else {
        console.log("⚠️ No daily summary response found in messages");
      }

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

// Test the get-daily-summary handler
async function testCompleteDataDump() {
  console.log("🔹 Testing Get Complete Data Dump Handler");
  console.log("=========================================");
  console.log("This will trigger the get-daily-summary handler to return:");
  console.log("- Complete note data");
  console.log("- ALL token portfolio data (raw + parsed)");
  console.log("- ALL calendar events (not just today's)");
  console.log("- Complete weather cache data");
  console.log("- ALL distribution data");
  console.log("- Complete token price data");
  console.log("- Full system information");
  console.log("- Global state information");

  try {
    const messageTxId = await message({
      process: processId,
      tags: [{ name: "Action", value: "get-daily-summary" }],
      signer: createDataItemSigner(jwk),
      data: "Get complete, unfiltered data dump",
    });

    console.log("Get complete data dump message sent, TX ID:", messageTxId);
    console.log("✅ Get Complete Data Dump: REQUEST SENT");

    // Wait for response
    await waitForResponse(
      messageTxId,
      "Get Complete Data Dump",
      "daily-summary-response"
    );
  } catch (error) {
    console.log("❌ Get Complete Data Dump: FAILED -", error.message);
  }
}

// Main test runner
async function runTest() {
  console.log("🚀 Starting Complete Data Dump Test\n");

  await testCompleteDataDump();

  console.log("\n📊 Test Summary");
  console.log("================");
  console.log("✅ Get complete data dump handler triggered");
  console.log("\n📊 Expected Results:");
  console.log("- Handler should return ALL available data unfiltered");
  console.log("- Response should include complete module data");
  console.log("- Data should be comprehensive, not just summary");
  console.log("\n🔑 What This Tests:");
  console.log("1. Complete data aggregation from all modules");
  console.log("2. Unfiltered access to all stored data");
  console.log("3. Raw data availability alongside processed data");
  console.log("4. Complete calendar event access (all events)");
  console.log("5. Full weather cache data");
  console.log("6. Complete portfolio and distribution data");
  console.log("7. All token price information");
  console.log("8. Complete system state information");
  console.log("9. Global module availability status");
}

// Execute the test
runTest().catch(console.error);
