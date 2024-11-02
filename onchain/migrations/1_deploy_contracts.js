const ElectionRegistry = artifacts.require("ElectionRegistry");
const VotingManager = artifacts.require("VotingManager");

module.exports = async function (deployer) {
	// Deploy ElectionRegistry
	await deployer.deploy(ElectionRegistry);
	const electionRegistry = await ElectionRegistry.deployed();

	// Deploy VotingManager with the address of ElectionRegistry
	await deployer.deploy(VotingManager, electionRegistry.address);
};
