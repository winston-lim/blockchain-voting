// Import required modules
const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const crypto = require("crypto");
const fs = require("fs");
// const Web3 = require("web3");
// const NodeRSA = require("node-rsa"); // Added for RSA operations
const MyInfoConnector = require("myinfo-connector-v4-nodejs");

const app = express();
const port = 3001;
const config = require("./config/config.js");
const connector = new MyInfoConnector(config.MYINFO_CONNECTOR_CONFIG);

// Session management
const sessionIdCache = {}; // Stores codeVerifier and NRIC per session
const issuedTokens = {}; // Tracks issued tokens per voter per election

// Middleware setup
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

// // Blockchain setup
// const web3 = new Web3("http://localhost:8545"); // Adjust as needed
// const ElectionRegistryABI =
// 	require("./build/contracts/ElectionRegistry.json").abi;
// const VotingManagerABI = require("./build/contracts/VotingManager.json").abi;

// const electionRegistryAddress = "0xYourElectionRegistryAddress"; // Replace with actual address
// const votingManagerAddress = "0xYourVotingManagerAddress"; // Replace with actual address

// const electionRegistry = new web3.eth.Contract(
// 	ElectionRegistryABI,
// 	electionRegistryAddress
// );
// const votingManager = new web3.eth.Contract(
// 	VotingManagerABI,
// 	votingManagerAddress
// );

// // Admin account setup
// const adminPrivateKey = fs
// 	.readFileSync("./keys/admin_private_key.txt", "utf8")
// 	.trim();
// const adminAccount = web3.eth.accounts.privateKeyToAccount(adminPrivateKey);
// web3.eth.accounts.wallet.add(adminAccount);

// // RSA keys for blind signature
// const adminRSAPrivateKeyPEM = fs
// 	.readFileSync("./keys/admin_rsa_private_key.pem", "utf8")
// 	.trim();
// const adminRSAPrivateKey = new NodeRSA(adminRSAPrivateKeyPEM, "pkcs1-private");

// Existing routes (identity verification and MyInfo data retrieval)

// 1. Get environment variables
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

// 2. Callback function - directs back to home page
app.get("/callback", function (req, res) {
	res.cookie("code", req.query.code);
	res.redirect("http://localhost:3000/protected");
});

// 3. Generate the code verifier and code challenge for PKCE flow
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

// 4. Get Person Data - call MyInfo Token + Person API
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

// --- Updated APIs with Blind Signatures ---

// // 5. Request Voting Token (with blind signature)
// app.post("/api/requestToken", async function (req, res) {
// 	try {
// 		const sid = req.cookies.sid;
// 		const sessionData = sessionIdCache[sid];
// 		if (!sessionData || !sessionData.nric) {
// 			return res.status(401).json({ error: "Unauthorized" });
// 		}
// 		const nric = sessionData.nric;
// 		const electionId = req.body.electionId;
// 		if (!electionId) {
// 			return res.status(400).json({ error: "Missing electionId" });
// 		}
// 		const key = nric + "_" + electionId;
// 		if (issuedTokens[key]) {
// 			return res
// 				.status(400)
// 				.json({ error: "Token already issued for this election" });
// 		}

// 		// Get the blinded token from the request
// 		const blindedTokenHex = req.body.blindedToken;
// 		if (!blindedTokenHex) {
// 			return res.status(400).json({ error: "Missing blindedToken" });
// 		}
// 		const blindedTokenBuffer = Buffer.from(blindedTokenHex, "hex");

// 		// Admin signs the blinded token using RSA blind signature
// 		const signedBlindedTokenBuffer =
// 			adminRSAPrivateKey.sign(blindedTokenBuffer);
// 		const signedBlindedTokenHex = signedBlindedTokenBuffer.toString("hex");

// 		// Mark that the voter has been issued a token
// 		issuedTokens[key] = true;

// 		// Send the signed blinded token back to the voter
// 		res.json({ signedBlindedToken: signedBlindedTokenHex });
// 	} catch (error) {
// 		console.error("Error in requestToken:", error);
// 		res.status(500).json({ error: "Error requesting token" });
// 	}
// });

// // 6. Cast Vote
// app.post("/api/castVote", async function (req, res) {
// 	try {
// 		const { electionId, encryptedVote, token, signedToken } = req.body;
// 		if (!electionId || !encryptedVote || !token || !signedToken) {
// 			return res.status(400).json({ error: "Missing parameters" });
// 		}

// 		// Interact with the VotingManager contract
// 		const tx = votingManager.methods.castVote(
// 			electionId,
// 			encryptedVote,
// 			token,
// 			signedToken
// 		);

// 		// Estimate gas
// 		const gas = await tx.estimateGas({ from: adminAccount.address });

// 		// Send transaction
// 		const receipt = await tx.send({
// 			from: adminAccount.address,
// 			gas: gas,
// 		});

// 		res.json({ message: "Vote cast successfully", receipt: receipt });
// 	} catch (error) {
// 		console.error("Error casting vote:", error);
// 		res.status(500).json({ error: "Error casting vote" });
// 	}
// });

// // 7. Get Election Information
// app.get("/api/elections/:electionId", async function (req, res) {
// 	const electionId = req.params.electionId;
// 	try {
// 		const election = await electionRegistry.methods
// 			.elections(electionId)
// 			.call();
// 		if (!election.exists) {
// 			return res.status(404).json({ error: "Election does not exist" });
// 		}
// 		const choices = await electionRegistry.methods
// 			.getElectionChoices(electionId)
// 			.call();
// 		res.json({
// 			electionId: electionId,
// 			startTime: election.startTime,
// 			endTime: election.endTime,
// 			choices: choices,
// 			publicKey: election.publicKey,
// 		});
// 	} catch (error) {
// 		console.error("Error getting election info:", error);
// 		res.status(500).json({ error: "Error getting election info" });
// 	}
// });

// // 8. Create Election (Admin only)
// app.post("/api/createElection", async function (req, res) {
// 	try {
// 		const { startTime, endTime, choices, publicKey } = req.body;
// 		if (!startTime || !endTime || !choices || !publicKey) {
// 			return res.status(400).json({ error: "Missing parameters" });
// 		}

// 		// Only allow admin to create elections
// 		// Implement proper authentication in production
// 		const tx = electionRegistry.methods.createElection(
// 			startTime,
// 			endTime,
// 			choices,
// 			publicKey
// 		);

// 		const gas = await tx.estimateGas({ from: adminAccount.address });

// 		const receipt = await tx.send({
// 			from: adminAccount.address,
// 			gas: gas,
// 		});

// 		res.json({ message: "Election created", receipt: receipt });
// 	} catch (error) {
// 		console.error("Error creating election:", error);
// 		res.status(500).json({ error: "Error creating election" });
// 	}
// });

// // 9. Tally Votes (Admin only)
// app.post("/api/tallyVotes", async function (req, res) {
// 	try {
// 		const { electionId } = req.body;
// 		if (!electionId) {
// 			return res.status(400).json({ error: "Missing electionId" });
// 		}

// 		// Ensure the election has ended
// 		const election = await electionRegistry.methods
// 			.elections(electionId)
// 			.call();
// 		if (!election.exists) {
// 			return res.status(404).json({ error: "Election does not exist" });
// 		}
// 		const currentTime = Math.floor(Date.now() / 1000);
// 		if (currentTime <= parseInt(election.endTime)) {
// 			return res
// 				.status(400)
// 				.json({ error: "Election has not ended yet; cannot tally votes" });
// 		}

// 		// Retrieve encrypted votes from the VotingManager contract
// 		const voteCount = await votingManager.methods
// 			.getEncryptedVoteCount(electionId)
// 			.call();
// 		let encryptedVotes = [];
// 		for (let i = 0; i < voteCount; i++) {
// 			const encryptedVote = await votingManager.methods
// 				.getEncryptedVote(electionId, i)
// 				.call();
// 			encryptedVotes.push(encryptedVote);
// 		}

// 		// Decrypt votes using the election's private key
// 		// Assume the election's private key is stored securely
// 		const electionPrivateKeyPEM = fs
// 			.readFileSync(`./keys/election_${electionId}_private_key.pem`, "utf8")
// 			.trim();
// 		const electionPrivateKey = new NodeRSA(
// 			electionPrivateKeyPEM,
// 			"pkcs1-private"
// 		);

// 		let decryptedVotes = [];
// 		for (let encVote of encryptedVotes) {
// 			// Decrypt the vote
// 			const decryptedVote = electionPrivateKey.decrypt(
// 				Buffer.from(encVote.slice(2), "hex"),
// 				"utf8"
// 			);
// 			decryptedVotes.push(decryptedVote);
// 		}

// 		// Tally the votes
// 		let voteTally = {};
// 		for (let vote of decryptedVotes) {
// 			if (voteTally[vote]) {
// 				voteTally[vote] += 1;
// 			} else {
// 				voteTally[vote] = 1;
// 			}
// 		}

// 		res.json({ electionId: electionId, results: voteTally });
// 	} catch (error) {
// 		console.error("Error tallying votes:", error);
// 		res.status(500).json({ error: "Error tallying votes" });
// 	}
// });

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
