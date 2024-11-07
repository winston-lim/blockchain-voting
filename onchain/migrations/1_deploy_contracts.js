const ElectionRegistry = artifacts.require("ElectionRegistry");
const VotingManager = artifacts.require("VotingManager");

module.exports = async function (deployer) {
	await deployer.deploy(ElectionRegistry);
	const electionRegistry = await ElectionRegistry.deployed();

	await deployer.deploy(VotingManager, electionRegistry.address);
};
