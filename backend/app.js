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
	adminRSAPrivateKey,
	electionPrivateKeyPath,
	electionPublicKeyPath,
	generateElectionRSAKeys,
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
	require("../onchain/build/contracts/DeploymentAddresses.json").ElectionRegistryAddress;
const votingManagerAddress =
	require("../onchain/build/contracts/DeploymentAddresses.json").VotingManagerAddress;
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
		const blindedTokenHex = req.body.blindedToken;
		if (!blindedTokenHex) {
			return res.status(400).json({ error: "Missing blindedToken" });
		}
		const blindedTokenBuffer = Buffer.from(blindedTokenHex, "hex");

		// Admin signs the blinded token using RSA blind signature
		const signedBlindedTokenBuffer =
			adminRSAPrivateKey.sign(blindedTokenBuffer);
		const signedBlindedTokenHex = signedBlindedTokenBuffer.toString("hex");

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
		res.json({
			electionId: electionId,
			startTime: election.startTime,
			endTime: election.endTime,
			choices: choices,
			publicKey: election.publicKey,
		});
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
