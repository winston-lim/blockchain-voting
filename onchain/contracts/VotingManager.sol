// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "./ElectionRegistry.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract VotingManager {
    address public admin;
    ElectionRegistry public electionRegistry;

    struct EncryptedVote {
        bytes encryptedVote;
    }

    mapping(uint256 => EncryptedVote[]) private electionVotes;
    mapping(bytes32 => bool) private tokenUsed; // Tracks used tokens

    event VoteCast(uint256 electionId, bytes32 tokenHash);
    event VoteTallyCompleted(uint256 electionId);

    constructor(address _electionRegistryAddress) {
        admin = msg.sender;
        electionRegistry = ElectionRegistry(_electionRegistryAddress);
    }

    function castVote(
        uint256 _electionId,
        bytes memory _encryptedVote,
        bytes32 _token,
        bytes memory _signature
    ) public {
        (uint256 startTime, uint256 endTime, bool exists,) = electionRegistry.elections(_electionId);
        require(exists, "Election does not exist");
        require(block.timestamp >= startTime, "Election has not started");
        require(block.timestamp <= endTime, "Election has ended");

        // Verify the signature on the token
        bytes32 tokenHash = keccak256(abi.encodePacked(_token));
        require(!tokenUsed[tokenHash], "Token has already been used");

        // Recover the signer's address
        bytes32 ethSignedHash = ECDSA.toEthSignedMessageHash(tokenHash);
        address signer = ECDSA.recover(ethSignedHash, _signature);
        require(signer == admin, "Invalid token signature");

        // Mark token as used to prevent double voting
        tokenUsed[tokenHash] = true;

        // Record the vote
        electionVotes[_electionId].push(EncryptedVote({
            encryptedVote: _encryptedVote
        }));

        emit VoteCast(_electionId, tokenHash);
    }

    function getEncryptedVoteCount(uint256 _electionId) public view returns (uint256) {
        return electionVotes[_electionId].length;
    }

    function getEncryptedVote(uint256 _electionId, uint256 _index) public view returns (bytes memory) {
        require(_index < electionVotes[_electionId].length, "Index out of bounds");
        return electionVotes[_electionId][_index].encryptedVote;
    }
}
