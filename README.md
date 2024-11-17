# Blockchain voting

## Problem

Physical voting has both high cost and security concerns.
In contrast, voting via blockchain has the following benefits:

1. Transparency
   - Each transaction is visible in real time, allowing it to be verifiable by anyone
2. Low cost
   - Software infrastructure scales more cheaply than physical infrastructure, leading to lower costs
3. Privacy
   - Processes are verified but anonymous, maintaining privacy while ensuring security
4. Online
   - Accessible to anyone with access to the internet, making it highly convenient

## Solution

This blockchain-based voting system designed to enhance transparency, security, affordability, and accessibility for both election administrators and voters. Utilizing blockchain technology, this system creates a secure and private platform for casting votes, allowing voters to confidently participate in elections while enabling administrators to efficiently manage the voting process with confidence in the integrity of the results.

# Setup

## Node

1. Install Node Version Manager (nvm) from https://github.com/nvm-sh/nvm
2. Install node 18 via `nvm install 18`
3. Install pnpm via `npn i -g pnpm`

## Onchain

1. Ensure node-18 is being used via `nvm use 18 && node -v`
2. Install ganache-cli via `npm i -g ganache-cli` (https://www.npmjs.com/package/ganache-cli)
3. Install truffle via `npm i -g truffle` (https://www.npmjs.com/package/truffle)
4. Change into onchain directory via `cd onchain/`
5. Run setup script via `make setup`
6. Run contract migrations via `make migrate`

## Backend

1. Ensure node-18 is being used via `nvm use 18 && node -v`
2. Install dependencies via `pnpm install`
3. Run server via `pnpm run start`

## Frontend

1. Ensure node-18 is being used via `nvm use 18 && node -v`
2. Install dependencies via `pnpm install`
3. Run web client via `pnpm run start`

# Demo

<video width="320" height="240" controls>
  <source src="./documentation/videos/demo.mp4" type="video/mp4">
</video>
