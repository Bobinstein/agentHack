/**
 * AgentHack - Get Started Utility
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
const agentProcessId = process.env.AGENT_PROCESS_ID;
const relayProcessId = process.env.RELAY_PROCESS_ID;
const crontrollerProcessId = process.env.CRONTROLLER_PROCESS_ID;
const userWalletAddress = process.env.USER_WALLET_ADDRESS;
const weatherLocation = process.env.WEATHER_LOCATION || "New York,NY,US";

// Load your wallet from environment variable
const walletPath = process.env.WALLET_PATH.replace(
  "~",
  process.env.HOME || require("os").homedir()
);
const jwk = JSON.parse(fs.readFileSync(walletPath));

async function initializeAgent() {
  console.log("🚀 Starting AgentHack initialization...");
  console.log(`Agent Process ID: ${agentProcessId}`);
  console.log(`Relay Process ID: ${relayProcessId}`);
  console.log(`Crontroller Process ID: ${crontrollerProcessId}`);
  console.log(`User Wallet: ${userWalletAddress}`);
  console.log(`Weather Location: ${weatherLocation}`);

  try {
    // 1. Add user wallet address to whitelist for the mock relay process
    console.log("\n👤 Adding user wallet to relay whitelist...");
    const whitelistTxId = await message({
      process: relayProcessId,
      tags: [
        { name: "Action", value: "Whitelist-Manage" },
        { name: "Operation", value: "add" },
        { name: "Address", value: userWalletAddress },
      ],
      signer: createDataItemSigner(jwk),
      data: "",
    });
    console.log(`✅ User wallet added to relay whitelist: ${whitelistTxId}`);

        console.log("\n👤 Adding agent to relay whitelist...");
        const agentWhitelistTxId = await message({
          process: relayProcessId,
          tags: [
            { name: "Action", value: "Whitelist-Manage" },
            { name: "Operation", value: "add" },
            { name: "Address", value: agentProcessId },
          ],
          signer: createDataItemSigner(jwk),
          data: "",
        });
        console.log(
          `✅ Agent added to relay whitelist: ${agentWhitelistTxId}`
        );

    // 2. Set crontroller process ID and relay process ID in the agent
    console.log("\n⏰ Setting crontroller process ID in agent...");
    const crontrollerTxId = await message({
      process: agentProcessId,
      tags: [
        { name: "Action", value: "Set-Crontroller" },
        { name: "Controller-Id", value: crontrollerProcessId },
      ],
      signer: createDataItemSigner(jwk),
      data: "Setting crontroller process ID",
    });
    console.log(`✅ Crontroller process ID set: ${crontrollerTxId}`);

    const relayTxId = await message({
      process: agentProcessId,
      tags: [
        { name: "Action", value: "set-relay-process-id" },
        { name: "Relay-Process-Id", value: relayProcessId },
      ],
      signer: createDataItemSigner(jwk),
      data: "Setting relay process ID",
    });
    
    console.log(`✅ Relay process ID set: ${relayTxId}`);

    // 3. Set weather location on the agent process
    console.log("\n🌤️ Setting up weather location...");
    const weatherTxId = await message({
      process: agentProcessId,
      tags: [
        { name: "Action", value: "set-weather-location" },
        { name: "Location", value: weatherLocation },
      ],
      signer: createDataItemSigner(jwk),
      data: `Weather location set to: ${weatherLocation}`,
    });
    console.log(`✅ Weather location set: ${weatherTxId}`);

    // 4. Trigger set crons on the agent
    console.log("\n📅 Triggering cron setup...");
    const cronTxId = await message({
      process: agentProcessId,
      tags: [{ name: "Action", value: "trigger-set-crons" }],
      signer: createDataItemSigner(jwk),
      data: "Trigger set crons",
    });
    console.log(`✅ Cron setup triggered: ${cronTxId}`);

    console.log("\n🎉 AgentHack initialization complete!");
    console.log("\nNext steps:");
    console.log("1. Start the relay monitor: cd relay_monitor && yarn start");
    console.log("2. Start the frontend: cd front_end && yarn dev");
    console.log("3. Wait up to 40 minutes for initial data processing");
    console.log("4. Access the frontend at http://localhost:5173");
  } catch (error) {
    console.error("❌ Error during initialization:", error);
    process.exit(1);
  }
}

// Validate environment variables
function validateEnvironment() {
  const requiredVars = [
    "AGENT_PROCESS_ID",
    "RELAY_PROCESS_ID",
    "CRONTROLLER_PROCESS_ID",
    "USER_WALLET_ADDRESS",
    "WALLET_PATH",
  ];

  const missingVars = requiredVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error("❌ Missing required environment variables:");
    missingVars.forEach((varName) => console.error(`   - ${varName}`));
    console.error(
      "\nPlease check your .env file and ensure all required variables are set."
    );
    process.exit(1);
  }

  console.log("✅ All required environment variables are present");
}

// Main execution
async function main() {
  validateEnvironment();
  await initializeAgent();
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
