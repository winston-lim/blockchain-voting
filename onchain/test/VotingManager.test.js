const ElectionRegistry = artifacts.require("ElectionRegistry");
const VotingManager = artifacts.require("VotingManager");
const { expect } = require("chai");
const { Buffer } = require("buffer");
const { expectRevert, time } = require("@openzeppelin/test-helpers");
const _ = require("web3-utils"); // For soliditySha3
const crypto = require("crypto");
const EC = require("elliptic").ec;
const ec = new EC("secp256k1");

async function signMessage(message, account) {
    const signature = await web3.eth.sign(message, account);

    // Convert signature to buffer
    const signatureBuffer = Buffer.from(signature.slice(2), "hex");

    // Extract r, s, v
    const r = signatureBuffer.slice(0, 32);
    const s = signatureBuffer.slice(32, 64);
    let v = signatureBuffer[64];

    // Adjust v
    if (v < 27) {
        v += 27;
    }

    // Reconstruct the signature
    const adjustedSignature =
        "0x" + Buffer.concat([r, s, Buffer.from([v])]).toString("hex");

    return adjustedSignature;
}

contract("VotingManager", (accounts) => {
    const [admin, voter1, voter2] = accounts;

    const generateRequiredTokens = async () => {
        // Token issuance
        const token = web3.utils.randomHex(32);

        // Compute tokenHash
        const tokenHash = web3.utils.soliditySha3(token);

        // Admin signs the tokenHash
        const signedToken = await signMessage(tokenHash, admin);

        // Encrypted vote (simulated)
        const encryptedVote = web3.utils.randomHex(32);
        return [token, signedToken, encryptedVote];
    };

    const generateRequiredTokensWithBlinding = async () => {
        // Token issuance
        const token = web3.utils.randomHex(32);

        // Compute tokenHash
        const tokenHash = web3.utils.soliditySha3(token);


        // Generate a random blinding factor and blind the hash
        const blindingFactor = ec.genKeyPair().getPrivate();
        const tokenHashPoint = ec.keyFromPrivate(tokenHash).getPublic();
        const blindedTokenHash = tokenHashPoint.mul(blindingFactor);

        // Admin signs the blinded tokenHash
        const signedBlindedToken = await signMessage(blindedTokenHash, admin);

        const signedBlindedTokenPoint = ec.keyFromPublic(signedBlindedToken, "hex").getPublic();
        const signedTokenHashPoint = signedBlindedTokenPoint.mul(blindingFactor.invm(ec.curve.n)); // Inverse of blinding factor
        const signedTokenHash = signedTokenHashPoint.encode("hex");

        // Encrypted vote (simulated)
        const encryptedVote = web3.utils.randomHex(32);
        return [token, signedTokenHash, encryptedVote];
    }

    let electionRegistry;
    let votingManager;

    beforeEach(async () => {
        // Deploy contracts
        electionRegistry = await ElectionRegistry.new({ from: admin });
        votingManager = await VotingManager.new(electionRegistry.address, {
            from: admin,
        });

        // Create an election
        const startTime = (await time.latest()).toNumber();
        const endTime = startTime + 3600; // 1 hour from now
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
    });

    it("should allow a voter to cast a vote with a valid token", async () => {
        const electionId = 1;

        const [token, signedToken, encryptedVote] = await generateRequiredTokens();

        // Voter casts the vote
        await votingManager.castVote(
            electionId,
            encryptedVote,
            token,
            signedToken,
            { from: voter1 }
        );

        // Verify vote count
        const voteCount = await votingManager.getEncryptedVoteCount(electionId);
        expect(voteCount.toNumber()).to.equal(1);

        // Verify the vote was stored
        const storedVote = await votingManager.getEncryptedVote(electionId, 0);
        expect(storedVote).to.equal(encryptedVote);
    });

    it("should prevent a voter from casting multiple votes with the same token", async () => {
        const electionId = 1;

        const [token, signedToken, encryptedVote] = await generateRequiredTokens();

        // Voter casts the first vote
        await votingManager.castVote(
            electionId,
            encryptedVote,
            token,
            signedToken,
            { from: voter1 }
        );

        // Attempt to cast a second vote with the same token
        await expectRevert(
            votingManager.castVote(electionId, encryptedVote, token, signedToken, {
                from: voter1,
            }),
            "Token has already been used"
        );
    });

    it("should prevent casting a vote with an invalid token", async () => {
        const electionId = 1;

        // Invalid token (random token not signed by admin)
        const invalidToken = web3.utils.randomHex(32);
        const invalidSignedToken = await signMessage(invalidToken, voter1); // Signed by voter1

        // Encrypted vote (simulated)
        const encryptedVote = web3.utils.randomHex(32);

        // Attempt to cast a vote with an invalid token
        await expectRevert(
            votingManager.castVote(
                electionId,
                encryptedVote,
                invalidToken,
                invalidSignedToken,
                { from: voter2 }
            ),
            "Invalid token signature"
        );
    });

    it("should prevent casting a vote after the election has ended", async () => {
        const electionId = 1;

        // Fast-forward time to after the election end time
        await time.increase(3601); // Increase time by 1 hour and 1 second

        const [token, signedToken, encryptedVote] = await generateRequiredTokens();

        // Attempt to cast a vote after the election has ended
        await expectRevert(
            votingManager.castVote(electionId, encryptedVote, token, signedToken, {
                from: voter2,
            }),
            "Election has ended"
        );
    });

    it("should prevent casting a vote before the election has started", async () => {
        // Create a future election
        const futureStartTime = (await time.latest()).toNumber() + 3600; // Starts in 1 hour
        const futureEndTime = futureStartTime + 3600; // Ends 1 hour after start
        const choices = [
            web3.utils.keccak256("David"),
            web3.utils.keccak256("Eve"),
        ];
        const publicKey = admin;

        await electionRegistry.createElection(
            futureStartTime,
            futureEndTime,
            choices,
            publicKey,
            { from: admin }
        );

        const electionId = 2;

        const [token, signedToken, encryptedVote] = await generateRequiredTokens();

        // Attempt to cast a vote before the election has started
        await expectRevert(
            votingManager.castVote(electionId, encryptedVote, token, signedToken, {
                from: voter1,
            }),
            "Election has not started"
        );
    });

    it("should store multiple votes correctly", async () => {
        const electionId = 1;

        // Voter 1 casts a vote
        // Token issuance
        const [token1, signedToken1, encryptedVote1] =
            await generateRequiredTokens();

        await votingManager.castVote(
            electionId,
            encryptedVote1,
            token1,
            signedToken1,
            { from: voter1 }
        );

        // Voter 2 casts a vote
        const [token2, signedToken2, encryptedVote2] =
            await generateRequiredTokens();

        await votingManager.castVote(
            electionId,
            encryptedVote2,
            token2,
            signedToken2,
            { from: voter2 }
        );

        // Verify vote count
        const voteCount = await votingManager.getEncryptedVoteCount(electionId);
        expect(voteCount.toNumber()).to.equal(2);

        // Verify stored votes
        const storedVote1 = await votingManager.getEncryptedVote(electionId, 0);
        const storedVote2 = await votingManager.getEncryptedVote(electionId, 1);

        expect([storedVote1, storedVote2]).to.have.members([
            encryptedVote1,
            encryptedVote2,
        ]);
    });

    it("should allow a voter to cast a vote with a valid blinded token", async () => {
        const electionId = 1;

        const [token, signedToken, encryptedVote] = await generateRequiredTokensWithBlinding();

        // Voter casts the vote
        await votingManager.castVote(
            electionId,
            encryptedVote,
            token,
            signedToken,
            { from: voter1 }
        );

        // Verify vote count
        const voteCount = await votingManager.getEncryptedVoteCount(electionId);
        expect(voteCount.toNumber()).to.equal(1);

        // Verify the vote was stored
        const storedVote = await votingManager.getEncryptedVote(electionId, 0);
        expect(storedVote).to.equal(encryptedVote);
    });
});
