// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

contract ElectionRegistry {
    address public admin;

    struct Election {
        uint256 startTime;
        uint256 endTime;
        bytes32[] choices; // List of valid choices (hashed)
        bool exists;
        bytes publicKey; // Address representing the election's public key
    }

    mapping(uint256 => Election) public elections;
    uint256 public electionCount;

    event ElectionCreated(uint256 electionId, uint256 startTime, uint256 endTime);

    constructor() {
        admin = msg.sender;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }

    function createElection(
        uint256 _startTime,
        uint256 _endTime,
        bytes32[] memory _choices,
        bytes memory _publicKey // Placeholder for the public key
    ) public onlyAdmin {
        require(_startTime < _endTime, "Invalid election period");
        require(_choices.length > 0, "At least one choice is required");

        electionCount += 1;
        elections[electionCount] = Election({
            startTime: _startTime,
            endTime: _endTime,
            choices: _choices,
            exists: true,
            publicKey: _publicKey
        });

        emit ElectionCreated(electionCount, _startTime, _endTime);
    }

    function getElectionChoices(uint256 _electionId) public view returns (bytes32[] memory) {
        require(elections[_electionId].exists, "Election does not exist");
        return elections[_electionId].choices;
    }

    function getElectionInfo(uint256 _electionId)
        public
        view
        returns (uint256, uint256, bytes32[] memory, bytes memory)
    {
        require(elections[_electionId].exists, "Election does not exist");
        Election storage election = elections[_electionId];
        return (election.startTime, election.endTime, election.choices, election.publicKey);
    }
}
