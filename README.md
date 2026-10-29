# CarbonLedger

End-to-end carbon credit dApp for **MST Testnet** (chain ID `91562037`, currency `tMSTC`).
Landowners register tree-planting projects, verifiers check the tree data, and verified credits can be claimed,
transferred or retired. Sign in with **Google (email/social login)** or any **WalletConnect / injected wallet**
(BridgeKey, MetaMask, …) through Reown AppKit + wagmi.

```
carbon-ledger/
├─ contracts/   Solidity + Hardhat: CarbonCreditRegistry (ERC-1155), tests, deploy scripts
├─ backend/     Express API: validates tree datasets, builds Merkle proofs, verifies wallet signatures
└─ frontend/    React + Vite + wagmi + Reown AppKit
```

## MST Testnet details

| Setting | Value |
| --- | --- |
| Chain ID | 91562037 |
| RPC | https://testnetrpc.mstblockchain.com |
| Explorer | https://testnet.mstscan.com |
| Faucet | https://faucet.mstblockchain.com |
| Currency | tMSTC |

## Quick start

Requirements: Node.js 20+.

### 1. Contracts: test, then deploy
```bash
cd contracts
npm install
npx hardhat test                  # run the test suite first
cp .env.example .env              # set DEPLOYER_PRIVATE_KEY (a fresh, testnet-only wallet)
npm run check:network             # confirms RPC + chain ID, shows your balance
# fund the deployer from https://faucet.mstblockchain.com, then:
npm run deploy:mst
```
The deploy script checks the chain ID, refuses to run with an empty balance, writes
`contracts/deployments/mstTestnet.json` and updates `frontend/src/generated/deployment.json` so the front end
points at the new contract. Set `VERIFIER_ADDRESS` in `.env` to grant the verifier role during deployment.

### 2. Backend
```bash
cd backend
npm install
cp .env.example .env
npm test
npm start                         # http://localhost:8787
```

### 3. Front end
```bash
cd frontend
npm install
cp .env.example .env              # set VITE_REOWN_PROJECT_ID
npm run dev                       # http://localhost:5173
```
Get a free project ID at https://cloud.reown.com, add `http://localhost:5173` as an allowed domain, and under
**Features** enable **Email & Socials** so Google sign-in appears.

## How it works

1. **Sign in.** Until you sign in, the tabs are disabled and only the sign-in card is shown. After sign-in the header
   shows your full account address, balance, copy/explorer links and sign-out.
2. **Submit project.** You paste a CSV of trees (`treeId,species,lat,lon,plantedOn`). The backend validates it
   (unique IDs, unique positions, real dates, no future dates), builds a Merkle tree whose leaves include *your wallet
   address*, and returns the root plus a message to sign. You sign (free), the backend verifies the signature and stores
   the dataset, then the contract call `submitProject` records the Merkle root, evidence hash and tree count.
3. **Verify.** A verifier (role granted by the admin) runs the checks in the Verifier desk: stored dataset ↔ on-chain
   root, evidence hash, owner signature, tree count, and 5 random trees proven against the root **on-chain** with
   `verifyTreeRecord`. Approval unlocks only when every check passes. The contract blocks a verifier from reviewing their
   own project. The verifier approves N ≤ submitted trees; credits = N × credits-per-tree (rate snapshotted).
4. **Claim.** The owner mints the credits once.
5. **Validity.** A credit is *valid* only if its project is Verified and not expired. Transfers, retirement and
   claiming all check this on-chain, so credits from a rejected, revoked or expired project can never move or be retired.
   Verifiers or the admin can revoke a project later, which freezes all of its credits.
6. **Retire.** Burning credits records who retired how much and why.

## Security design

**Contract**
- OpenZeppelin 5.0.2: `AccessControlDefaultAdminRules` (two-step admin transfer with delay, admin can't be renounced by
  accident), `Pausable`, `ReentrancyGuard`, `MerkleProof`.
- Checks-effects-interactions: `claimed = true` is set before the ERC-1155 mint callback; claim and retire are `nonReentrant`.
- Validity enforced in `_update`, so *every* transfer path is covered, not just one function.
- Conflict-of-interest check, duplicate Merkle-root/evidence-hash rejection, bounded string lengths, bounded tree counts,
  bounded credit rate, custom errors, no payable functions, no external calls except the ERC-1155 receiver hook.
- Compiled with `evmVersion: paris` to avoid the PUSH0 opcode on chains that don't support it.

**Backend**
- Strict zod schemas (unknown fields rejected), 1 MB body limit, 5,000 trees per dataset, rate limits, Helmet, CORS allowlist.
- Uploads require a signature from the submitter over `root + dataHash + timestamp` (5-minute window).
- Dataset files are keyed by validated hex roots only (no path traversal), written atomically and never overwritten.
- Errors never expose internals.

**Front end**
- No `dangerouslySetInnerHTML`, all inputs validated before any request or transaction, wrong-network detection with a
  switch prompt, every write pinned to `chainId`, readable decoded revert reasons.
- The app only fetches tree data from its own configured API, never from URIs read from the chain.
- Production hosting should add security headers (CSP, `frame-ancestors`, `X-Content-Type-Options`). A strict CSP must
  allow the Reown/WalletConnect domains, so configure it at your host rather than guessing it here.

## Things to know

- **Google login on a custom chain.** Reown's embedded (email/social) wallet may not support every custom chain.
  If Google sign-in works but transactions on MST Testnet don't, use a WalletConnect/injected wallet such as BridgeKey
  or MetaMask for transactions. That is a limit of the wallet provider, not of this code.
- **Roles.** The deployer (or `ADMIN_ADDRESS`) is admin. Grant verifier from the Admin tab. Use a *second* wallet to
  submit test projects, because a verifier cannot approve their own.
- **Off-chain data.** Tree datasets live in the backend's `data/` folder. Back it up or swap `DatasetStore` for a database
  or IPFS pinning before production. The on-chain Merkle root + evidence hash let anyone detect tampering.
- **Verification is only as good as the verifier.** The contract proves *which* data was submitted and *who* approved it;
  it cannot prove the trees physically exist. Production use needs satellite/field audits and a trusted verifier set.
- **Before real money:** get an independent smart-contract audit, move admin to a multisig, and reconsider the
  `ADMIN_TRANSFER_DELAY`. This project is intended for testnet.
- The ABI in `frontend/src/lib/abi.ts` is hand-mirrored from the contract. If you change a function, update both.
