const { message, createDataItemSigner } = require("@permaweb/aoconnect");
const fs = require("fs");

const relayAddress = "L7ZEASGMlsjY2AMpTwbX178slBpaHJJxznWN8oywiZY";
const myAddress = "av9iNwK-M5EWKktelUuXd9fXAaaJAQfiTc84DGpuFCk";

const jwk = JSON.parse(fs.readFileSync("/home/stephen/.aos.json"));

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
