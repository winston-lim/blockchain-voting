const fs = require("fs");
const path = require("path");
const ElectionRegistry = artifacts.require("ElectionRegistry");
const VotingManager = artifacts.require("VotingManager");

module.exports = async function (deployer, _, accounts) {
	const deployerAccount = accounts[0];
	await deployer.deploy(ElectionRegistry);
	const electionRegistry = await ElectionRegistry.deployed();

	await deployer.deploy(VotingManager, electionRegistry.address);
	const votingManager = await VotingManager.deployed();

	// Store contracts' deployed addresses
	const addresses = {
		DeployerAccount: deployerAccount,
		ElectionRegistryAddress: electionRegistry.address,
		VotingManagerAddress: votingManager.address,
	};
	const outputPath = path.resolve(
		__dirname,
		"../build/contracts/DeploymentAddresses.json"
	);
	fs.writeFileSync(outputPath, JSON.stringify(addresses, null, 2));
};
