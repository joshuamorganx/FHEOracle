# FHEOracle (FHEVM)

Encrypted ETH/BTC daily price prediction game on Zama FHEVM. Users bet on whether the next day's price is above or below their encrypted prediction and earn encrypted points if correct.

## Overview

FHEOracle is a privacy-preserving, on-chain prediction game for two assets (ETH and BTC). Users submit encrypted predictions and encrypted direction flags, stake ETH, and later claim encrypted points if they predicted correctly. Daily prices are recorded on-chain by a designated oracle at UTC 00:00 (day index boundaries).

The project combines:
- Fully homomorphic encryption (FHE) on Ethereum using Zama FHEVM
- A simple, auditable daily price schedule
- A self-claiming mechanism where users decide when to reveal their outcome (via client-side decryption)

## Problem Statement

Traditional prediction markets on-chain expose user guesses and directions, enabling:
- Front-running or copy-trading of popular predictions
- Social pressure and privacy loss for high-stakes users
- Strategic behavior based on visible order flow

FHEOracle solves this by encrypting sensitive user inputs (predicted price and direction) and encrypting the reward balance. Observers can see that a bet was placed, but not the prediction itself or the chosen direction.

## Key Advantages

- Privacy for predictors: predicted prices and directions are encrypted on-chain.
- No information leakage: user predictions cannot be copied or front-run.
- Verifiable settlement: actual prices are stored on-chain and used to compute results under FHE.
- Simple daily cadence: one price per token per UTC day.
- User-controlled claiming: users trigger claim when eligible.
- Minimal trust surface: the oracle only supplies prices; it cannot access encrypted predictions.

## How It Works (Daily Flow)

1. Day N (UTC 00:00 to 23:59)
   - Users place a bet for Day N+1.
   - They submit:
     - Encrypted predicted price (euint64, scaled by 1e8)
     - Encrypted direction flag (ebool): true = actual > predicted, false = actual < predicted
     - ETH stake (paid in ETH)
2. Day N+1 (UTC 00:00)
   - Oracle posts the actual price for Day N+1.
3. Day N+2 (UTC 00:00 or later)
   - Users can claim results for Day N+1.
   - If correct, encrypted points are added equal to the stake in wei.

Note: If actual price equals predicted price, the bet is treated as incorrect (neither greater nor less is true).

## Smart Contract Design

Contract: `contracts/FHEOracle.sol`

### Tokens

- Enum `Token` with two values:
  - 0 = ETH
  - 1 = BTC

### Time Model

- `dayIndex(timestamp) = uint32(timestamp / 1 days)`
- `currentDayIndex()` uses `block.timestamp`
- The contract treats each UTC day as a 1-day bucket

### Daily Prices

- Stored as `uint64` with `PRICE_DECIMALS = 8`
- Mapping: `token => day => DailyPrice(price, updatedAt, exists)`
- Oracle can update a day's price; the latest call overwrites the stored price for that day

### Bets

Each bet contains:
- `predictedPrice` (euint64, encrypted)
- `directionIsGreater` (ebool, encrypted)
- `stakeWei` (uint64)
- `targetDay` (uint32)
- `claimed` (bool)
- `exists` (bool)

Constraints:
- Bets are always for `currentDayIndex() + 1`
- One bet per user per token per day
- Stake must be > 0 and fit in uint64

### Claiming

Eligibility:
- Bet exists
- Price for the target day exists
- `currentDayIndex() >= targetDay + 1`
- Not already claimed

Outcome logic (under FHE):
- `win = (directionIsGreater && actual > predicted) || (!directionIsGreater && actual < predicted)`
- Equality is not a win

### Points

- Points are encrypted and stored per user
- Correct claims add `stakeWei` to encrypted points
- Points are not automatically redeemed or withdrawn (no payout function)

### Roles

- `owner`: can change oracle, transfer ownership, withdraw ETH from the contract
- `oracle`: can update daily prices
- Users: place bets and claim results

### Events

- `DailyPriceUpdated(token, day, price)`
- `BetPlaced(user, token, day, stakeWei)`
- `BetClaimed(user, token, day)`
- `OracleUpdated(previousOracle, newOracle)`
- `OwnershipTransferred(previousOwner, newOwner)`
- `Withdrawal(to, amount)`

## Privacy and Security Model

- Predictions and direction flags are encrypted before reaching the contract using Zama FHEVM tooling.
- The contract uses FHE operations (`gt`, `lt`, `select`, `add`) to determine outcomes without decrypting user inputs.
- The contract grants per-user ACL access so users can decrypt their own points client-side.
- The oracle cannot see user predictions and cannot modify bets.

Important assumptions:
- The oracle is trusted to publish correct daily prices.
- Users must manually claim the day after price posting.
- Encrypted points are only meaningful to the user who decrypts them.

## Tech Stack

Smart contracts:
- Solidity ^0.8.24
- Zama FHEVM Solidity library (`@fhevm/solidity`)
- Hardhat + hardhat-deploy + TypeChain

Frontend:
- React + Vite
- RainbowKit + wagmi
- viem for reads, ethers for writes
- Zama Relayer SDK (`@zama-fhe/relayer-sdk`) for encryption/decryption

Tooling:
- TypeScript
- Hardhat tasks for oracle actions and ABI sync

## Repository Structure

- `contracts/` - Solidity contract(s)
- `deploy/` - hardhat-deploy scripts
- `tasks/` - CLI tasks (oracle updates, betting, ABI sync)
- `test/` - Hardhat tests (FHEVM mock)
- `ui/` - React frontend (Vite)
- `docs/` - Zama references

## Setup and Installation

Prerequisites:
- Node.js (LTS recommended)
- npm
- Access to Sepolia and a funded deployer key

Install dependencies:

```bash
npm install --no-package-lock
```

## Environment Configuration

Create or edit `.env` at the repository root:

```bash
PRIVATE_KEY=...          # hex private key, no 0x prefix
INFURA_API_KEY=...
ETHERSCAN_API_KEY=...
```

Notes:
- Deployment uses a private key, not a mnemonic.
- The frontend does not read environment variables.

## Tests (Local FHEVM Mock)

```bash
npm run test
```

The test suite:
- Places encrypted bets
- Updates daily prices
- Claims the next day
- Verifies encrypted points via user decryption

## Local Development

Start a local chain and deploy:

```bash
npm run chain
npm run deploy:localhost
```

## Sepolia Deployment

```bash
npm run deploy:sepolia
npm run verify:sepolia -- <CONTRACT_ADDRESS>
```

The deploy script initializes the oracle to the deployer address. You can change it later with `setOracle`.

## Sync ABI and Address to Frontend

After deploying to Sepolia, copy the ABI and address into the UI:

```bash
npx hardhat task:sync-ui-abi --network sepolia
```

This reads `deployments/sepolia/FHEOracle.json` and overwrites:
- `ui/src/config/contracts.ts`

## Hardhat Tasks

Oracle and user actions are exposed as Hardhat tasks:

```bash
# Print deployed contract address (from hardhat-deploy)
npx hardhat task:oracle:address --network sepolia

# Update today's price (oracle only)
npx hardhat task:oracle:update-price --token ETH --price 4000_00000000 --network sepolia

# Place a bet (user)
npx hardhat task:oracle:place-bet --token ETH --price 4000_00000000 --direction true --stakeWei 1000000000000000000 --network sepolia

# Claim a settled bet
npx hardhat task:oracle:claim --token ETH --day 12345 --network sepolia

# Decrypt your points in CLI
npx hardhat task:oracle:decrypt-points --network sepolia
```

## Frontend (UI)

The UI lives in `ui/` and provides:
- Place Bet (encrypted inputs)
- View upcoming and settled bets
- Claim eligible bets
- Decrypt points client-side
- Oracle panel for price updates

Start the UI:

```bash
cd ui
npm install --no-package-lock
npm run dev
```

Ensure the UI ABI and address are synced before use.

## Known Limitations and Assumptions

- Only ETH and BTC are supported.
- Only one bet per user per token per day.
- Prices are updated by a single oracle address.
- If actual price equals predicted price, the bet is treated as incorrect.
- The contract stores daily prices in clear; only user predictions and points are encrypted.
- Points are internal to the game and are not redeemed for ETH by the contract.
- Users must manually claim; there is no auto-claim or auto-settlement.

## Future Roadmap

Planned improvements (not implemented yet):
- Multi-asset support beyond ETH/BTC
- Configurable prediction windows and cut-off times
- Oracle redundancy (multiple feeds or quorum)
- Off-chain scheduler for automatic daily updates
- On-chain or off-chain leaderboard with opt-in disclosure
- Expanded reward mechanics (multipliers, streaks, tiers)
- Optional payout or redemption flows tied to points
- Improved indexing for historical analytics and UX

## License

MIT
