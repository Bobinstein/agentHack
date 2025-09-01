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

async function main() {
 const txId = await message({
   process: processId,
   tags: [{ name: "Action", value: "trigger-set-crons" }],
   signer: createDataItemSigner(jwk),
   data: "Trigger set crons",
 });

 console.log(txId);
}

main();