const fs = require("fs");
const path = require("path");
const NodeRSA = require("node-rsa");
const Wallet = require("ethereumjs-wallet").default;
const { web3 } = require("./web3.js");

const KEYS_DIRECTORY = "./keys";
// Ensure the KEYS_DIRECTORY exists
if (!fs.existsSync(KEYS_DIRECTORY)) {
    fs.mkdirSync(KEYS_DIRECTORY, { recursive: true });
}
const electionPrivateKeyPath = (electionId) =>
    path.join(KEYS_DIRECTORY, `election_${electionId}_private_key.pem`);
const electionPublicKeyPath = (electionId) =>
    path.join(KEYS_DIRECTORY, `election_${electionId}_public_key.pem`);

function generateElectionRSAKeys(electionId) {
    const privKeyPath = electionPrivateKeyPath(electionId);
    const pubKeyPath = electionPublicKeyPath(electionId);

    if (!fs.existsSync(privKeyPath) || !fs.existsSync(pubKeyPath)) {
        console.log(
            `Election RSA keys not found for election ${electionId}. Generating new ones...`
        );
        const key = new NodeRSA({ b: 2048 });

        // Generate private key
        const privateKey = key.exportKey("pkcs1-private-pem");
        fs.writeFileSync(privKeyPath, privateKey, { mode: 0o600 });

        // Generate public key
        const publicKey = key.exportKey("pkcs1-public-pem");
        fs.writeFileSync(pubKeyPath, publicKey, { mode: 0o644 });

        console.log(
            `Election RSA keys generated and saved for election ${electionId}.`
        );
    } else {
        console.log(`Election RSA keys already exist for election ${electionId}.`);
    }
}

// Admin's ETH key
const adminAccountAddress =
    require("../../onchain/build/contracts/DeploymentAddresses.json").DeployerAccount;
const adminPrivateKey =
    require("../../onchain/build/contracts/GanacheKeys.json").private_keys[
    adminAccountAddress.toLowerCase()
    ];
const adminAccount = web3.eth.accounts.privateKeyToAccount(
    "0x" + adminPrivateKey
);
web3.eth.accounts.wallet.add(adminAccount);

async function signMessage(message) {
    const signature = await web3.eth.sign(message, adminAccount);

    // Convert signature to buffer
    const signatureBuffer = Buffer.from(signature.slice(2), "hex");

    // Extract r, s, v
    const r = signatureBuffer.slice(0, 32);
    const s = signatureBuffer.slice(32, 64);
    let v = signatureBuffer[64];

    // Adjust v
    if (v < 27) {
        v += 27;
    }

    // Reconstruct the signature
    const adjustedSignature =
        "0x" + Buffer.concat([r, s, Buffer.from([v])]).toString("hex");

    return adjustedSignature;
}

module.exports = {
    electionPrivateKeyPath,
    electionPublicKeyPath,
    generateElectionRSAKeys,
    adminPrivateKey,
    adminAccount,
    signMessage,
};
