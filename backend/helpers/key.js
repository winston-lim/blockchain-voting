const fs = require("fs");
const path = require("path");
const NodeRSA = require("node-rsa");
const { web3 } = require("./web3.js");

if (fs.existsSync("./keys")) {
	fs.rmdirSync("./keys", { recursive: true });
}
fs.mkdirSync("./keys", { recursive: true });

const electionPrivateKeyPath = (directory, electionId) =>
	path.join(directory, `election_${electionId}_private_key.pem`);
const electionPublicKeyPath = (directory, electionId) =>
	path.join(directory, `election_${electionId}_public_key.pem`);

function generateElectionRSAKeys(directory, electionId) {
	const privKeyPath = electionPrivateKeyPath(directory, electionId);
	const pubKeyPath = electionPublicKeyPath(directory, electionId);

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

function getElectionRSAKeys(directory, electionId) {
	const privKeyPath = electionPrivateKeyPath(directory, electionId);
	const pubKeyPath = electionPublicKeyPath(directory, electionId);
	console.log({
		privKeyPath,
		pubKeyPath,
	});
	if (!fs.existsSync(privKeyPath) || !fs.existsSync(pubKeyPath)) {
		throw new Error("Election keys not found!");
	}
	const electionRSAPrivateKeyPEM = fs.readFileSync(privKeyPath, "utf8").trim();
	const electionRSAPublicKeyPEM = fs.readFileSync(pubKeyPath, "utf8").trim();
	const electionRSAPrivateKey = new NodeRSA(
		electionRSAPrivateKeyPEM,
		"pkcs1-private"
	);
	const electionRSAPublicKey = new NodeRSA(
		electionRSAPublicKeyPEM,
		"pkcs1-public"
	);
	return [electionRSAPrivateKey, electionRSAPublicKey];
}

// Admin's ETH key
const adminAccountAddress =
	require("../../shared/DeploymentAddresses.json").DeployerAccount;
const adminPrivateKey =
	"0x" +
	require("../../shared/GanacheKeys.json").private_keys[
		adminAccountAddress.toLowerCase()
	];
const adminAccount = web3.eth.accounts.privateKeyToAccount(adminPrivateKey);
web3.eth.accounts.wallet.add(adminAccount);

async function signMessage(message) {
	const { signature } = await web3.eth.sign(message, adminAccountAddress);
	console.log({
		signature,
	});

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
	getElectionRSAKeys,
	adminPrivateKey,
	adminAccount,
	adminAccountAddress,
	signMessage,
};
