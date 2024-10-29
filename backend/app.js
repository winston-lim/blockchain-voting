const express = require("express");
var bodyParser = require("body-parser");
var cookieParser = require("cookie-parser");
const cors = require("cors");
const crypto = require("crypto");
var MyInfoConnector = require("myinfo-connector-v4-nodejs");
const fs = require("fs");

const app = express();
const port = 3001;
const config = require("./config/config.js");
const connector = new MyInfoConnector(config.MYINFO_CONNECTOR_CONFIG);

var sessionIdCache = {};

app.use(express.json());

app.use(cors());

app.use(bodyParser.json());
app.use(
	bodyParser.urlencoded({
		extended: false,
	})
);
app.use(cookieParser());
app.use(function (req, res, next) {
	// Website you wish to allow to connect
	res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");

	// Request methods you wish to allow
	res.setHeader(
		"Access-Control-Allow-Methods",
		"GET, POST, OPTIONS, PUT, PATCH, DELETE"
	);

	// Request headers you wish to allow
	res.setHeader(
		"Access-Control-Allow-Headers",
		"X-Requested-With,content-type"
	);

	// Set to true if you need the website to include cookies in the requests sent
	// to the API (e.g. in case you use sessions)
	res.setHeader("Access-Control-Allow-Credentials", true);

	// Pass to next layer of middleware
	next();
});

// get the environment variables (app info) from the config
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
		console.log("Error".red, error);
		res.status(500).send({
			error: error,
		});
	}
});

// app.get("/verify", function (req, res) {
// 	if (req.cookies.sid == "" || sessionIdCache[req.cookies.sid] == undefined) {
// 		res.status(401).send();
// 	} else {
// 		res.status(200).send();
// 	}
// });

// callback function - directs back to home page
app.get("/callback", function (req, res) {
	res.cookie("code", req.query.code);
	res.redirect("http://localhost:3000");
});

//function to read multiple files from a directory
function readFiles(dirname, onFileContent, onError) {
	fs.readdir(dirname, function (err, filenames) {
		if (err) {
			onError(err);
			return;
		}
		filenames.forEach(function (filename) {
			fs.readFile(dirname + filename, "utf8", function (err, content) {
				if (err) {
					onError(err);
					return;
				}
				onFileContent(filename, content);
			});
		});
	});
}

// getPersonData function - call MyInfo Token + Person API
app.post("/getPersonData", async function (req, res, next) {
	try {
		// get variables from frontend
		var authCode = req.body.authCode;
		//retrieve code verifier from session cache
		var codeVerifier = sessionIdCache[req.cookies.sid];
		console.log("Calling MyInfo NodeJs Library...".green);

		// retrieve private siging key and decode to utf8 from FS
		let privateSigningKey = fs.readFileSync(
			config.APP_CONFIG.DEMO_APP_CLIENT_PRIVATE_SIGNING_KEY,
			"utf8"
		);

		let privateEncryptionKeys = [];
		// retrieve private encryption keys and decode to utf8 from FS, insert all keys to array
		readFiles(
			config.APP_CONFIG.DEMO_APP_CLIENT_PRIVATE_ENCRYPTION_KEYS,
			(filename, content) => {
				privateEncryptionKeys.push(content);
			},
			(err) => {
				throw err;
			}
		);

		//call myinfo connector to retrieve data
		let personData = await connector.getMyInfoPersonData(
			authCode,
			codeVerifier,
			privateSigningKey,
			privateEncryptionKeys
		);

		/* 
      P/s: Your logic to handle the person data ...
    */
		console.log(
			"--- Sending Person Data From Your-Server (Backend) to Your-Client (Frontend)---:"
				.green
		);
		console.log(JSON.stringify(personData)); // log the data for demonstration purpose only
		res.status(200).send(personData); //return personData
	} catch (error) {
		console.log("---MyInfo NodeJs Library Error---".red);
		console.log(error);
		res.status(500).send({
			error: error,
		});
	}
});

// Generate the code verifier and code challenge for PKCE flow
app.post("/generateCodeChallenge", async function (req, res, next) {
	try {
		// call connector to generate code_challenge and code_verifier
		let pkceCodePair = connector.generatePKCECodePair();
		// create a session and store code_challenge and code_verifier pair
		let sessionId = crypto.randomBytes(16).toString("hex");
		sessionIdCache[sessionId] = pkceCodePair.codeVerifier;

		//establish a frontend session with browser to retrieve back code_verifier
		res.cookie("sid", sessionId);
		console.log({ sessionId });
		//send code code_challenge to frontend to make /authorize call
		res.status(200).send(pkceCodePair.codeChallenge);
	} catch (error) {
		console.log("Error".red, error);
		res.status(500).send({
			error: error,
		});
	}
});

// catch 404 and forward to error handler
app.use(function (req, res, next) {
	var err = new Error("Not Found");
	err.status = 404;
	next(err);
});

// error handlers
// print stacktrace on error
app.use(function (err, req, res, next) {
	res.status(err.status || 500).send({
		error: err,
	});
});

app.listen(port, () =>
	console.log(`Demo App Client listening on port ${port}!`)
);
