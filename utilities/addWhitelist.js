/**
 * AgentHack - Add Whitelist Utility
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
const { message, createDataItemSigner } = require("@permaweb/aoconnect");
const fs = require("fs");

const relayAddress = process.env.RELAY_PROCESS_ID;
const myAddress = process.env.AGENT_PROCESS_ID;

// Load your wallet from environment variable
const walletPath = process.env.WALLET_PATH.replace(
  "~",
  process.env.HOME || require("os").homedir()
);
const jwk = JSON.parse(fs.readFileSync(walletPath));

async function main() {
  const signer = createDataItemSigner(jwk);
  const result = await message({
    process: relayAddress,
    tags: [
      { name: "Action", value: "Whitelist-Manage" },
      { name: "Operation", value: "add" },
      { name: "Address", value: myAddress },
    ],
    signer: signer,
    data: "",
  });
  console.log(result);
}

main();

// send({Target = "L7ZEASGMlsjY2AMpTwbX178slBpaHJJxznWN8oywiZY", Action = "Relay-Request", ["Request-URL"] = "https://bobinstein.com/ar-io/info"})
