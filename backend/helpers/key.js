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
const adminEthKeyPath = path.join(KEYS_DIRECTORY, "admin_private_key.txt");
const adminRSAPrivateKeyPath = path.join(
	KEYS_DIRECTORY,
	"admin_rsa_private_key.pem"
);
const adminRSAPublicKeyPath = path.join(
	KEYS_DIRECTORY,
	"admin_rsa_public_key.pem"
);
const electionPrivateKeyPath = (electionId) =>
	path.join(KEYS_DIRECTORY, `election_${electionId}_private_key.pem`);
const electionPublicKeyPath = (electionId) =>
	path.join(KEYS_DIRECTORY, `election_${electionId}_public_key.pem`);

function generateAdminEthereumKey() {
	if (!fs.existsSync(adminEthKeyPath)) {
		console.log(
			"Admin Ethereum private key not found. Generating a new one..."
		);
		const adminWallet = Wallet.generate();
		const privateKey = adminWallet.getPrivateKeyString(); // Hex string starting with '0x'

		// Save the private key to a file
		fs.writeFileSync(adminEthKeyPath, privateKey, { mode: 0o600 });
		console.log("Admin Ethereum private key generated and saved.");
	} else {
		console.log("Admin Ethereum private key already exists.");
	}
}

function generateAdminRSAKeys() {
	if (
		!fs.existsSync(adminRSAPrivateKeyPath) ||
		!fs.existsSync(adminRSAPublicKeyPath)
	) {
		console.log("Admin RSA keys not found. Generating new ones...");
		const key = new NodeRSA({ b: 2048 });

		// Generate private key
		const privateKey = key.exportKey("pkcs1-private-pem");
		fs.writeFileSync(adminRSAPrivateKeyPath, privateKey, { mode: 0o600 });

		// Generate public key
		const publicKey = key.exportKey("pkcs1-public-pem");
		fs.writeFileSync(adminRSAPublicKeyPath, publicKey, { mode: 0o644 });

		console.log("Admin RSA keys generated and saved.");
	} else {
		console.log("Admin RSA keys already exist.");
	}
}

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

// Admin's RSA keys
generateAdminRSAKeys();

const adminRSAPrivateKeyPEM = fs
	.readFileSync(adminRSAPrivateKeyPath, "utf8")
	.trim();
const adminRSAPublicKeyPEM = fs
	.readFileSync(adminRSAPublicKeyPath, "utf8")
	.trim();
const adminRSAPrivateKey = new NodeRSA(adminRSAPrivateKeyPEM, "pkcs1-private");
const adminRSAPublicKey = new NodeRSA(adminRSAPublicKeyPEM, "pkcs1-public");

module.exports = {
	adminAccount,
	adminRSAPrivateKey,
	adminRSAPublicKey,
	electionPrivateKeyPath,
	electionPublicKeyPath,
	generateElectionRSAKeys,
};
