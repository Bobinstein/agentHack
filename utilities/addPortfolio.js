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
    tags: [
      { name: "Action", value: "Add-Token-To-Portfolio" },
      { name: "TokenId", value: "4hXj_E-5fAKmo4E8KjgQvuDJKAFk9P2grhycVmISDLs" },
    ],
    signer: createDataItemSigner(jwk),
    data: "Add Token to Portfolio",
  });

  console.log(txId);
}

main();
