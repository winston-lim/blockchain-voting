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
	getElectionRSAKeys,
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
const electionHashedChoices = {}; // public key to unencrypted choices

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

// Create Election (Admin only)
app.post("/api/createElection", async function (req, res) {
	try {
		const { startTime, endTime, choices } = req.body;
		if (!startTime || !endTime || !choices) {
			return res.status(400).json({ error: "Missing parameters" });
		}

		// Generate a unique election ID
		const electionId = 1;

		// Generate election RSA keys
		generateElectionRSAKeys("./keys", electionId);

		// Read the election public key to include in the contract
		const publicKeyPEM = fs.readFileSync(
			electionPublicKeyPath("./keys", electionId),
			"utf8"
		);
		const publicKeyBytes = web3.utils.fromAscii(publicKeyPEM);

		const choicesInBytes32 = choices.map((choice) => {
			const hashedChoice = web3.utils.keccak256(choice);
			if (!(publicKeyBytes in electionHashedChoices)) {
				electionHashedChoices[publicKeyBytes] = {};
			}
			electionHashedChoices[publicKeyBytes][hashedChoice] = choice;
			return hashedChoice;
		});

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
			gasPrice,
		});
		// Convert BigInt values in the receipt to strings
		const sanitizedReceipt = JSON.parse(
			JSON.stringify(receipt, (_, value) =>
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

// Get Election Information
app.get("/api/elections/:electionId", async function (req, res) {
	const electionId = req.params.electionId;
	console.log({ electionId });
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
		console.log({
			pk: election.publicKey,
			electionHashedChoices,
			choices,
		});
		const resp = {
			electionId: electionId,
			startTime: election.startTime,
			endTime: election.endTime,
			choices: choices.map((hashedChoice) => ({
				original: electionHashedChoices[election.publicKey][hashedChoice],
				hashed: hashedChoice,
			})),
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

// Cast vote
app.post("/api/castVote", async function (req, res) {
	try {
		const electionId = 1;
		const { sid, vote } = req.body;
		const sessionData = sessionIdCache[sid];
		if (!sessionData || !sessionData.nric) {
			return res.status(401).json({ error: "Unauthorized" });
		}
		const nric = sessionData.nric;
		const key = nric + "_" + electionId;
		if (!electionId || !vote) {
			return res.status(400).json({ error: "Missing parameters" });
		}
		if (issuedTokens[key]) {
			return res
				.status(400)
				.json({ error: "Token already issued for this election" });
		}
		// Token issuance
		const token = web3.utils.randomHex(32);
		// Compute tokenHash for fixed size
		const tokenHash = web3.utils.soliditySha3(token);
		// Admin signs the tokenHash
		const signedToken = await signMessage(tokenHash);
		// Encrypt vote
		const electionRSAPublicKey = getElectionRSAKeys("./keys", electionId)[1];
		const salt = web3.utils.randomHex(16).slice(2);
		const encryptedVote = electionRSAPublicKey.encrypt(vote + salt);

		// Interact with the VotingManager contract
		const tx = votingManager.methods.castVote(
			electionId,
			encryptedVote,
			token,
			signedToken
		);
		// Estimate gas
		const gas = await tx.estimateGas({ from: adminAccount.address });
		const gasPrice = await web3.eth.getGasPrice(); // Retrieve the gas price for non-EIP-1559 networks
		// Send transaction
		const receipt = await tx.send({
			from: adminAccount.address,
			gas: gas,
			gasPrice,
		});
		issuedTokens[key] = true;
		// Convert BigInt values in the receipt to strings
		const sanitizedReceipt = JSON.parse(
			JSON.stringify(receipt, (_, value) =>
				typeof value === "bigint" ? value.toString() : value
			)
		);
		res.json({ message: "Vote cast successfully", receipt: sanitizedReceipt });
	} catch (error) {
		console.error("Error casting vote:", error);
		res.status(500).json({ error: "Error casting vote" });
	}
});

// Tally Votes (Admin only)
app.get("/api/tallyVotes", async function (_, res) {
	try {
		const electionId = 1;
		if (!electionId) {
			return res.status(400).json({ error: "Missing electionId" });
		}

		const election = await electionRegistry.methods
			.elections(electionId)
			.call();
		if (!election.exists) {
			return res.status(404).json({ error: "Election does not exist" });
		}
		// // Ensure the election has ended
		// const currentTime = Math.floor(Date.now() / 1000);
		// if (currentTime <= parseInt(election.endTime)) {
		// 	return res
		// 		.status(400)
		// 		.json({ error: "Election has not ended yet; cannot tally votes" });
		// }

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
		const electionPrivateKey = getElectionRSAKeys("./keys", electionId)[0];

		let decryptedVotes = [];
		for (let encVote of encryptedVotes) {
			// Decrypt the vote
			const decryptedVote = electionPrivateKey.decrypt(
				Buffer.from(encVote.slice(2), "hex"),
				"utf8"
			);
			const removeSalt = decryptedVote.slice(0, decryptedVote.length - 32);
			decryptedVotes.push(removeSalt);
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
