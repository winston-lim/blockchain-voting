// Common dependencies
const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const fs = require("fs");
const NodeRSA = require("node-rsa");
// Singpass dependencies
const MyInfoConnector = require("myinfo-connector-v4-nodejs");
// Web3 dependencies
const crypto = require("crypto");
// Local dependencies
const {
	adminAccount,
	electionPrivateKeyPath,
	electionPublicKeyPath,
	generateElectionRSAKeys,
	signMessage,
} = require("./helpers/key.js");
const { web3 } = require("./helpers/web3.js");

// ExpressJS setup
const app = express();
const port = 3001;
const config = require("./config/config.js");
const connector = new MyInfoConnector(config.MYINFO_CONNECTOR_CONFIG);

// Session management
const sessionIdCache = {}; // Stores codeVerifier and NRIC per session
const issuedTokens = {}; // Tracks issued tokens per voter per election

// Middlewares
app.use(express.json());
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(function (req, res, next) {
	res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
	res.setHeader(
		"Access-Control-Allow-Methods",
		"GET, POST, OPTIONS, PUT, PATCH, DELETE"
	);
	res.setHeader(
		"Access-Control-Allow-Headers",
		"X-Requested-With,content-type"
	);
	res.setHeader("Access-Control-Allow-Credentials", true);
	next();
});

// Web3 setups
const ElectionRegistryABI =
	require("../onchain/build/contracts/ElectionRegistry.json").abi;
const VotingManagerABI =
	require("../onchain/build/contracts/VotingManager.json").abi;
const electionRegistryAddress =
	require("../shared/DeploymentAddresses.json").ElectionRegistryAddress;
const votingManagerAddress =
	require("../shared/DeploymentAddresses.json").VotingManagerAddress;
const electionRegistry = new web3.eth.Contract(
	ElectionRegistryABI,
	electionRegistryAddress
);
const votingManager = new web3.eth.Contract(
	VotingManagerABI,
	votingManagerAddress
);

// Get environment variables
app.get("/getEnv", function (_, res) {
	try {
		if (
			config.APP_CONFIG.DEMO_APP_CLIENT_ID == undefined ||
			config.APP_CONFIG.DEMO_APP_CLIENT_ID == null
		) {
			res.status(500).send({
				error: "Missing Client ID",
			});
		} else {
			res.status(200).send({
				clientId: config.APP_CONFIG.DEMO_APP_CLIENT_ID,
				redirectUrl: config.APP_CONFIG.DEMO_APP_CALLBACK_URL,
				scope: config.APP_CONFIG.DEMO_APP_SCOPES,
				purpose_id: config.APP_CONFIG.DEMO_APP_PURPOSE_ID,
				authApiUrl: config.APP_CONFIG.MYINFO_API_AUTHORIZE,
				subentity: config.APP_CONFIG.DEMO_APP_SUBENTITY_ID,
			});
		}
	} catch (error) {
		console.log("Error", error);
		res.status(500).send({
			error: error,
		});
	}
});

// Redirection back to authenticated route
app.get("/callback", function (req, res) {
	res.cookie("code", req.query.code);
	res.redirect("http://localhost:3000/protected");
});

// Generate the code verifier and code challenge
app.post("/generateCodeChallenge", async function (req, res) {
	try {
		let pkceCodePair = connector.generatePKCECodePair();
		let sessionId = crypto.randomBytes(16).toString("hex");
		sessionIdCache[sessionId] = { codeVerifier: pkceCodePair.codeVerifier };

		res.cookie("sid", sessionId);
		res.status(200).send(pkceCodePair.codeChallenge);
	} catch (error) {
		console.log("Error", error);
		res.status(500).send({
			error: error,
		});
	}
});

// Get Person Data via call MyInfo Token + Person API
app.post("/getPersonData", async function (req, res) {
	try {
		const authCode = req.body.authCode;
		const sid = req.body.sid;
		const sessionData = sessionIdCache[sid];
		const codeVerifier = sessionData.codeVerifier;
		console.log("Calling MyInfo NodeJs Library...");

		let privateSigningKey = fs.readFileSync(
			config.APP_CONFIG.DEMO_APP_CLIENT_PRIVATE_SIGNING_KEY,
			"utf8"
		);

		let privateEncryptionKeys = [];
		fs.readdirSync(
			config.APP_CONFIG.DEMO_APP_CLIENT_PRIVATE_ENCRYPTION_KEYS
		).forEach((filename) => {
			let content = fs.readFileSync(
				config.APP_CONFIG.DEMO_APP_CLIENT_PRIVATE_ENCRYPTION_KEYS + filename,
				"utf8"
			);
			privateEncryptionKeys.push(content);
		});

		let personData = await connector.getMyInfoPersonData(
			authCode,
			codeVerifier,
			privateSigningKey,
			privateEncryptionKeys
		);

		console.log("--- Received Person Data ---");
		console.log(JSON.stringify(personData));

		// Store NRIC in session data
		sessionData.nric = personData.uinfin.value;
		sessionIdCache[sid] = sessionData;

		res.status(200).send(personData);
	} catch (error) {
		console.log("---MyInfo NodeJs Library Error---");
		console.log(error);
		res.status(500).send({
			error: error,
		});
	}
});

// Request Voting Token (with blind signature)
app.post("/api/requestToken", async function (req, res) {
	try {
		const sid = req.cookies.sid;
		const sessionData = sessionIdCache[sid];
		if (!sessionData || !sessionData.nric) {
			return res.status(401).json({ error: "Unauthorized" });
		}
		const nric = sessionData.nric;
		const electionId = req.body.electionId;
		if (!electionId) {
			return res.status(400).json({ error: "Missing electionId" });
		}
		const key = nric + "_" + electionId;
		if (issuedTokens[key]) {
			return res
				.status(400)
				.json({ error: "Token already issued for this election" });
		}

		// Get the blinded token from the request
		const blindedToken = req.body.blindedToken;
		if (!blindedToken) {
			return res.status(400).json({ error: "Missing blindedToken" });
		}
		// Admin signs the blinded token using ECDSA blind signature
		const signedBlindedTokenHex = await signMessage(blindedToken);

		// Mark that the voter has been issued a token
		issuedTokens[key] = true;

		// Send the signed blinded token back to the voter
		res.json({ signedBlindedToken: signedBlindedTokenHex });
	} catch (error) {
		console.error("Error in requestToken:", error);
		res.status(500).json({ error: "Error requesting token" });
	}
});

// Get Election Information
app.get("/api/elections/:electionId", async function (req, res) {
	const electionId = req.params.electionId;
	try {
		const election = await electionRegistry.methods
			.elections(electionId)
			.call();
		if (!election.exists) {
			return res.status(404).json({ error: "Election does not exist" });
		}
		const choices = await electionRegistry.methods
			.getElectionChoices(electionId)
			.call();
		const resp = {
			electionId: electionId,
			startTime: election.startTime,
			endTime: election.endTime,
			choices: choices,
			publicKey: election.publicKey,
		};
		const sanitizedResp = JSON.parse(
			JSON.stringify(resp, (_, value) =>
				typeof value === "bigint" ? value.toString() : value
			)
		);
		res.json(sanitizedResp);
	} catch (error) {
		console.error("Error getting election info:", error);
		res.status(500).json({ error: "Error getting election info" });
	}
});

// 8. Create Election (Admin only)
app.post("/api/createElection", async function (req, res) {
	try {
		const { startTime, endTime, choices } = req.body;
		if (!startTime || !endTime || !choices) {
			return res.status(400).json({ error: "Missing parameters" });
		}

		// Generate a unique election ID
		const electionId = crypto.randomBytes(4).toString("hex"); // 8-character hex string

		// Generate election RSA keys
		generateElectionRSAKeys(electionId);

		// Read the election public key to include in the contract
		const publicKeyPEM = fs.readFileSync(
			electionPublicKeyPath(electionId),
			"utf8"
		);
		const publicKeyBytes = web3.utils.fromAscii(publicKeyPEM);

		const choicesInBytes32 = choices.map((choice) =>
			web3.utils.keccak256(choice)
		);

		// Only allow admin to create elections
		// Implement proper authentication in production
		const tx = electionRegistry.methods.createElection(
			startTime,
			endTime,
			choicesInBytes32,
			publicKeyBytes // Store the public key in the contract
		);

		const gas = await tx.estimateGas({ from: adminAccount.address });
		const gasPrice = await web3.eth.getGasPrice(); // Retrieve the gas price for non-EIP-1559 networks

		// Send transaction with gas and gasPrice specified
		const receipt = await tx.send({
			from: adminAccount.address,
			gas: gas,
			gasPrice: gasPrice, // Specify gasPrice for compatibility with non-EIP-1559 networks
		});
		// Convert BigInt values in the receipt to strings
		const sanitizedReceipt = JSON.parse(
			JSON.stringify(receipt, (key, value) =>
				typeof value === "bigint" ? value.toString() : value
			)
		);

		res.json({
			message: "Election created",
			receipt: sanitizedReceipt,
			electionId: electionId,
		});
	} catch (error) {
		console.error("Error creating election:", error);
		res.status(500).json({ error: "Error creating election" });
	}
});

// 9. Tally Votes (Admin only)
app.post("/api/tallyVotes", async function (req, res) {
	try {
		const { electionId } = req.body;
		if (!electionId) {
			return res.status(400).json({ error: "Missing electionId" });
		}

		// Ensure the election has ended
		const election = await electionRegistry.methods
			.elections(electionId)
			.call();
		if (!election.exists) {
			return res.status(404).json({ error: "Election does not exist" });
		}
		const currentTime = Math.floor(Date.now() / 1000);
		if (currentTime <= parseInt(election.endTime)) {
			return res
				.status(400)
				.json({ error: "Election has not ended yet; cannot tally votes" });
		}

		// Retrieve encrypted votes from the VotingManager contract
		const voteCount = await votingManager.methods
			.getEncryptedVoteCount(electionId)
			.call();
		let encryptedVotes = [];
		for (let i = 0; i < voteCount; i++) {
			const encryptedVote = await votingManager.methods
				.getEncryptedVote(electionId, i)
				.call();
			encryptedVotes.push(encryptedVote);
		}

		// Decrypt votes using the election's private keys
		generateElectionRSAKeys(electionId);

		const electionPrivateKeyPEM = fs
			.readFileSync(electionPrivateKeyPath(electionId), "utf8")
			.trim();
		const electionPrivateKey = new NodeRSA(
			electionPrivateKeyPEM,
			"pkcs1-private"
		);

		let decryptedVotes = [];
		for (let encVote of encryptedVotes) {
			// Decrypt the vote
			const decryptedVote = electionPrivateKey.decrypt(
				Buffer.from(encVote.slice(2), "hex"),
				"utf8"
			);
			decryptedVotes.push(decryptedVote);
		}

		// Tally the votes
		let voteTally = {};
		for (let vote of decryptedVotes) {
			if (voteTally[vote]) {
				voteTally[vote] += 1;
			} else {
				voteTally[vote] = 1;
			}
		}

		res.json({ electionId: electionId, results: voteTally });
	} catch (error) {
		console.error("Error tallying votes:", error);
		res.status(500).json({ error: "Error tallying votes" });
	}
});

// --- Blinding Debug ---

// Helper function to convert base64url to BigInt
function base64UrlToBigInt(base64Url) {
	const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
	const buffer = Buffer.from(base64, "base64");
	return BigInt("0x" + buffer.toString("hex"));
}

// Helper function to compute modular inverse
function modInverse(a, m) {
	let m0 = m,
		y = 0n,
		x = 1n;

	if (m === 1n) return 0n;

	while (a > 1n) {
		const q = a / m;
		let t = m;
		m = a % m;
		a = t;
		t = y;
		y = x - q * y;
		x = t;
	}

	if (x < 0n) x += m0;
	return x;
}

// Efficient modular exponentiation using Exponentiation by Squaring
function modExp(base, exponent, modulus) {
	let result = 1n; // Start with result = 1
	base = base % modulus; // Reduce base mod modulus to prevent overflow

	while (exponent > 0n) {
		if (exponent % 2n === 1n) {
			// If exponent is odd, multiply base to result
			result = (result * base) % modulus;
		}
		exponent = exponent / 2n; // Divide exponent by 2
		base = (base * base) % modulus; // Square the base
	}

	return result;
}

// Sign the blinded message with the private key
function signBlindedMessage(blindedMessage, privateKey) {
	const dBigInt = base64UrlToBigInt(privateKey.d); // Convert private exponent to BigInt
	const NBigInt = base64UrlToBigInt(privateKey.n); // Convert modulus (N) to BigInt

	// Apply modular exponentiation: S = B^d mod N
	const signedMessage = modExp(BigInt(blindedMessage), dBigInt, NBigInt);

	return signedMessage.toString();
}

// Helper function to verify the signature
function verifySignature(message, signature, publicKey) {
	const messageBuffer = Buffer.from(message);
	const messageInt = BigInt("0x" + messageBuffer.toString("hex"));

	const e = base64UrlToBigInt(publicKey.e); // public exponent
	const n = base64UrlToBigInt(publicKey.n); // modulus

	const signatureInt = BigInt(signature);
	const verifiedMessage = signatureInt ** e % n;

	return verifiedMessage === messageInt;
}

// Blind the message using a random factor r
function blindMessage(message, N, E, r) {
	const messageBuffer = Buffer.from(message);
	const messageInt = BigInt("0x" + messageBuffer.toString("hex"));

	const rBigInt = BigInt("0x" + r);
	const NBigInt = BigInt(N);
	const eBigInt = BigInt(E);

	// B = M * r^e mod n
	const blindedMessage = (messageInt * rBigInt ** eBigInt) % NBigInt;
	return blindedMessage.toString();
}

// Unblind the signature
function unblindSignature(signature, r, N) {
	const rBigInt = BigInt("0x" + r);
	const signatureBigInt = BigInt(signature);
	const NBigInt = BigInt(N);

	// Unblind the signature: S' = S * r^-1 mod n
	const rInverse = modInverse(rBigInt, NBigInt);
	const unblindedSignature = (signatureBigInt * rInverse) % NBigInt;
	return unblindedSignature.toString();
}

// --- Error Handling ---

// Catch 404 and forward to error handler
app.use(function (req, res, next) {
	var err = new Error("Not Found");
	err.status = 404;
	next(err);
});

// Error handlers
app.use(function (err, req, res, next) {
	res.status(err.status || 500).send({
		error: err.message,
	});
});

app.listen(port, () =>
	console.log(`VoteSecure backend listening on port ${port}!`)
);
