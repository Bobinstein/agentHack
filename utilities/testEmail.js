const { message, createDataItemSigner } = require("@permaweb/aoconnect");
const fs = require("fs");

const relayAddress = "L7ZEASGMlsjY2AMpTwbX178slBpaHJJxznWN8oywiZY";
const myAddress = "j6R9ITLNyll_nckPdnvUGz_sSdnuLVGFIWbymj72SJM";

const jwk = JSON.parse(fs.readFileSync("/home/stephen/.aos.json"));

async function testSendEmail() {
  const signer = createDataItemSigner(jwk);

  // Web3Forms API endpoint
  const web3formsUrl = "https://api.web3forms.com/submit";

  // Match the exact field structure from the successful implementation
  // Note: successful version only uses 'from_name', not 'from_email'
  const formData = [
    "access_key=d6ab7874-bbf4-4a99-8994-cbf2722c9357",
    "subject=Test Email from AO Relay",
    "message=This is a test email sent via the AO relay process using web3forms API.",
    "from_name=AO Relay Test",
    "botcheck=",
  ].join("&");

  const result = await message({
    process: relayAddress,
    tags: [
      { name: "Action", value: "Relay-Request" },
      { name: "Request-URL", value: web3formsUrl },
      { name: "Method", value: "POST" },
      // Don't set Content-Type - let Web3Forms auto-detect like the successful implementation
      { name: "Headers", value: JSON.stringify({}) },
      { name: "Body", value: formData },
      { name: "Timeout", value: "30000" },
      { name: "X-Email-Test", value: "true" },
      { name: "X-Request-Type", value: "email" },
    ],
    signer: signer,
    data: "Email test request via AO relay",
  });

  console.log("Email test message sent:", result);
  return result;
}

// Export the function
module.exports = { testSendEmail };

// Run if called directly
if (require.main === module) {
  testSendEmail().catch(console.error);
}
