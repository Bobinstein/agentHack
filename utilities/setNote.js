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
    tags: [{ name: "Action", value: "Set-note" }, { name: "Note", value: "This is a test note" }],
    signer: createDataItemSigner(jwk),
    data: "The note is only set from data, not the note tag.",
  });

  console.log(txId);
}

main();
