const ElectionRegistry = artifacts.require("ElectionRegistry");
const { expect } = require("chai");
const { expectRevert } = require("@openzeppelin/test-helpers");

contract("ElectionRegistry", (accounts) => {
	const [admin, nonAdmin] = accounts;

	let electionRegistry;

	beforeEach(async () => {
		electionRegistry = await ElectionRegistry.new({ from: admin });
	});

	it("should set the admin correctly", async () => {
		const contractAdmin = await electionRegistry.admin();
		expect(contractAdmin).to.equal(admin);
	});

	it("should allow admin to create an election", async () => {
		const startTime = Math.floor(Date.now() / 1000);
		const endTime = startTime + 3600;
		const choices = [
			web3.utils.keccak256("Alice"),
			web3.utils.keccak256("Bob"),
		];
		const publicKey = admin;

		const receipt = await electionRegistry.createElection(
			startTime,
			endTime,
			choices,
			publicKey,
			{ from: admin }
		);

		expect(receipt.logs.length).to.equal(1);
		expect(receipt.logs[0].event).to.equal("ElectionCreated");
		expect(receipt.logs[0].args.electionId.toNumber()).to.equal(1);

		const election = await electionRegistry.elections(1);
		expect(election.exists).to.be.true;
		expect(election.startTime.toNumber()).to.equal(startTime);
		expect(election.endTime.toNumber()).to.equal(endTime);
	});

	it("should not allow non-admin to create an election", async () => {
		const startTime = Math.floor(Date.now() / 1000);
		const endTime = startTime + 3600;
		const choices = [
			web3.utils.keccak256("Alice"),
			web3.utils.keccak256("Bob"),
		];
		const publicKey = admin;

		await expectRevert(
			electionRegistry.createElection(startTime, endTime, choices, publicKey, {
				from: nonAdmin,
			}),
			"Only admin can perform this action"
		);
	});

	it("should not allow creation of an election with invalid times", async () => {
		const startTime = Math.floor(Date.now() / 1000) + 3600;
		const endTime = startTime - 3600;
		const choices = [
			web3.utils.keccak256("Alice"),
			web3.utils.keccak256("Bob"),
		];
		const publicKey = admin;

		await expectRevert(
			electionRegistry.createElection(startTime, endTime, choices, publicKey, {
				from: admin,
			}),
			"Invalid election period"
		);
	});

	it("should return correct election choices", async () => {
		const startTime = Math.floor(Date.now() / 1000);
		const endTime = startTime + 3600;
		const choices = [
			web3.utils.keccak256("Alice"),
			web3.utils.keccak256("Bob"),
		];
		const publicKey = admin;

		await electionRegistry.createElection(
			startTime,
			endTime,
			choices,
			publicKey,
			{ from: admin }
		);

		const retrievedChoices = await electionRegistry.getElectionChoices(1);
		expect(retrievedChoices.length).to.equal(2);
		expect(retrievedChoices[0]).to.equal(choices[0]);
		expect(retrievedChoices[1]).to.equal(choices[1]);
	});

	it("should return correct election info", async () => {
		const startTime = Math.floor(Date.now() / 1000);
		const endTime = startTime + 3600;
		const choices = [
			web3.utils.keccak256("Alice"),
			web3.utils.keccak256("Bob"),
		];
		const publicKey = admin;

		await electionRegistry.createElection(
			startTime,
			endTime,
			choices,
			publicKey,
			{ from: admin }
		);

		const electionInfo = await electionRegistry.getElectionInfo(1);
		const retrievedStartTime = electionInfo[0];
		const retrievedEndTime = electionInfo[1];
		const retrievedChoices = electionInfo[2];
		const retrievedPublicKey = electionInfo[3];

		expect(retrievedStartTime.toNumber()).to.equal(startTime);
		expect(retrievedEndTime.toNumber()).to.equal(endTime);
		expect(retrievedChoices.length).to.equal(2);
		expect(retrievedChoices[0]).to.equal(choices[0]);
		expect(retrievedChoices[1]).to.equal(choices[1]);
		expect(retrievedPublicKey.toLowerCase()).to.equal(publicKey.toLowerCase());
	});
});
