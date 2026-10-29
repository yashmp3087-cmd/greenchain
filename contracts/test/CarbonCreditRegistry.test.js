const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");

const LEAF_TYPES = ["address", "string", "string", "int256", "int256", "uint256"];
const DAY = 24 * 60 * 60;
const CREDITS_PER_TREE = 22n;
const VALIDITY = 365 * DAY;

const Status = { None: 0, Pending: 1, Verified: 2, Rejected: 3, Revoked: 4 };

function buildDataset(ownerAddress, seed = "A", count = 3) {
  const values = [];
  for (let i = 0; i < count; i++) {
    values.push([ownerAddress, `${seed}-${i}`, "Teak", BigInt(18500000 + i), BigInt(73800000 + i), 1700000000n]);
  }
  const tree = StandardMerkleTree.of(values, LEAF_TYPES);
  return { values, tree, root: tree.root, hash: ethers.keccak256(ethers.toUtf8Bytes(`${seed}:${ownerAddress}`)) };
}

async function deployFixture() {
  const [admin, verifier, owner, other, buyer] = await ethers.getSigners();
  const Registry = await ethers.getContractFactory("CarbonCreditRegistry");
  const reg = await Registry.deploy(admin.address, 0, "https://example.org/{id}.json", CREDITS_PER_TREE, VALIDITY);
  await reg.waitForDeployment();
  const VERIFIER_ROLE = await reg.VERIFIER_ROLE();
  await reg.connect(admin).grantRole(VERIFIER_ROLE, verifier.address);
  return { reg, admin, verifier, owner, other, buyer, VERIFIER_ROLE };
}

async function submittedFixture() {
  const base = await deployFixture();
  const data = buildDataset(base.owner.address, "A", 3);
  await base.reg.connect(base.owner).submitProject("Western Ghats Teak", "Pune, IN", 3, data.root, data.hash, "https://api.example/datasets/x");
  return { ...base, data };
}

async function verifiedFixture() {
  const base = await submittedFixture();
  await base.reg.connect(base.verifier).verifyProject(1, 3);
  return base;
}

async function claimedFixture() {
  const base = await verifiedFixture();
  await base.reg.connect(base.owner).claimCredits(1);
  return base;
}

describe("CarbonCreditRegistry", () => {
  describe("deployment", () => {
    it("sets admin, rate and validity", async () => {
      const { reg, admin } = await loadFixture(deployFixture);
      expect(await reg.hasRole(await reg.DEFAULT_ADMIN_ROLE(), admin.address)).to.equal(true);
      expect(await reg.creditsPerTree()).to.equal(CREDITS_PER_TREE);
      expect(await reg.validityPeriod()).to.equal(VALIDITY);
    });

    it("rejects invalid constructor parameters", async () => {
      const [admin] = await ethers.getSigners();
      const F = await ethers.getContractFactory("CarbonCreditRegistry");
      await expect(F.deploy(admin.address, 0, "u", 0, VALIDITY)).to.be.revertedWithCustomError(F, "InvalidCreditsPerTree");
      await expect(F.deploy(admin.address, 0, "u", 1001, VALIDITY)).to.be.revertedWithCustomError(F, "InvalidCreditsPerTree");
      await expect(F.deploy(admin.address, 0, "u", 1, 0)).to.be.revertedWithCustomError(F, "InvalidValidityPeriod");
    });
  });

  describe("submitProject", () => {
    it("stores a pending project", async () => {
      const { reg, owner, data } = await loadFixture(submittedFixture);
      const p = await reg.getProject(1);
      expect(p.owner).to.equal(owner.address);
      expect(p.status).to.equal(Status.Pending);
      expect(p.submittedTreeCount).to.equal(3);
      expect(p.treeDataRoot).to.equal(data.root);
      expect(await reg.projectCount()).to.equal(1);
    });

    it("emits ProjectSubmitted", async () => {
      const { reg, owner } = await loadFixture(deployFixture);
      const d = buildDataset(owner.address, "E");
      await expect(reg.connect(owner).submitProject("n", "l", 3, d.root, d.hash, "u"))
        .to.emit(reg, "ProjectSubmitted")
        .withArgs(1, owner.address, 3, d.root);
    });

    it("rejects duplicate tree data root or evidence hash", async () => {
      const { reg, other, data } = await loadFixture(submittedFixture);
      const fresh = buildDataset(other.address, "B");
      await expect(reg.connect(other).submitProject("n", "l", 3, data.root, fresh.hash, "u")).to.be.revertedWithCustomError(reg, "DuplicateEvidence");
      await expect(reg.connect(other).submitProject("n", "l", 3, fresh.root, data.hash, "u")).to.be.revertedWithCustomError(reg, "DuplicateEvidence");
    });

    it("validates inputs", async () => {
      const { reg, owner } = await loadFixture(deployFixture);
      const d = buildDataset(owner.address, "V");
      const c = reg.connect(owner);
      await expect(c.submitProject("", "l", 3, d.root, d.hash, "u")).to.be.revertedWithCustomError(reg, "InvalidText");
      await expect(c.submitProject("n", "", 3, d.root, d.hash, "u")).to.be.revertedWithCustomError(reg, "InvalidText");
      await expect(c.submitProject("n", "l", 3, d.root, d.hash, "")).to.be.revertedWithCustomError(reg, "InvalidText");
      await expect(c.submitProject("x".repeat(101), "l", 3, d.root, d.hash, "u")).to.be.revertedWithCustomError(reg, "InvalidText");
      await expect(c.submitProject("n", "l", 0, d.root, d.hash, "u")).to.be.revertedWithCustomError(reg, "InvalidTreeCount");
      await expect(c.submitProject("n", "l", 5001, d.root, d.hash, "u")).to.be.revertedWithCustomError(reg, "InvalidTreeCount");
      await expect(c.submitProject("n", "l", 3, ethers.ZeroHash, d.hash, "u")).to.be.revertedWithCustomError(reg, "EmptyHash");
      await expect(c.submitProject("n", "l", 3, d.root, ethers.ZeroHash, "u")).to.be.revertedWithCustomError(reg, "EmptyHash");
    });
  });

  describe("verification", () => {
    it("lets a verifier approve and snapshots credits and expiry", async () => {
      const { reg, verifier } = await loadFixture(submittedFixture);
      await expect(reg.connect(verifier).verifyProject(1, 2)).to.emit(reg, "ProjectVerified");
      const p = await reg.getProject(1);
      expect(p.status).to.equal(Status.Verified);
      expect(p.verifiedTreeCount).to.equal(2);
      expect(p.creditsIssued).to.equal(2n * CREDITS_PER_TREE);
      expect(p.validUntil).to.equal(p.verifiedAt + BigInt(VALIDITY));
      expect(await reg.isCreditValid(1)).to.equal(true);
    });

    it("blocks non-verifiers", async () => {
      const { reg, other } = await loadFixture(submittedFixture);
      await expect(reg.connect(other).verifyProject(1, 3)).to.be.revertedWithCustomError(reg, "AccessControlUnauthorizedAccount");
      await expect(reg.connect(other).rejectProject(1, "no")).to.be.revertedWithCustomError(reg, "AccessControlUnauthorizedAccount");
    });

    it("blocks a verifier from verifying their own project", async () => {
      const { reg, verifier } = await loadFixture(deployFixture);
      const d = buildDataset(verifier.address, "S");
      await reg.connect(verifier).submitProject("n", "l", 3, d.root, d.hash, "u");
      await expect(reg.connect(verifier).verifyProject(1, 3)).to.be.revertedWithCustomError(reg, "ConflictOfInterest");
      await expect(reg.connect(verifier).rejectProject(1, "x")).to.be.revertedWithCustomError(reg, "ConflictOfInterest");
    });

    it("rejects approving more trees than submitted, or zero", async () => {
      const { reg, verifier } = await loadFixture(submittedFixture);
      await expect(reg.connect(verifier).verifyProject(1, 4)).to.be.revertedWithCustomError(reg, "InvalidTreeCount");
      await expect(reg.connect(verifier).verifyProject(1, 0)).to.be.revertedWithCustomError(reg, "InvalidTreeCount");
    });

    it("cannot verify twice or an unknown project", async () => {
      const { reg, verifier } = await loadFixture(verifiedFixture);
      await expect(reg.connect(verifier).verifyProject(1, 3)).to.be.revertedWithCustomError(reg, "InvalidStatus");
      await expect(reg.connect(verifier).verifyProject(99, 1)).to.be.revertedWithCustomError(reg, "ProjectNotFound");
      await expect(reg.connect(verifier).verifyProject(0, 1)).to.be.revertedWithCustomError(reg, "ProjectNotFound");
    });

    it("rejects a project with a reason and prevents later verification", async () => {
      const { reg, verifier } = await loadFixture(submittedFixture);
      await expect(reg.connect(verifier).rejectProject(1, "Coordinates overlap an existing project"))
        .to.emit(reg, "ProjectRejected")
        .withArgs(1, verifier.address, "Coordinates overlap an existing project");
      expect((await reg.getProject(1)).status).to.equal(Status.Rejected);
      await expect(reg.connect(verifier).verifyProject(1, 3)).to.be.revertedWithCustomError(reg, "InvalidStatus");
      expect(await reg.isCreditValid(1)).to.equal(false);
    });

    it("requires a non-empty rejection reason", async () => {
      const { reg, verifier } = await loadFixture(submittedFixture);
      await expect(reg.connect(verifier).rejectProject(1, "")).to.be.revertedWithCustomError(reg, "InvalidText");
    });

    it("keeps the verified credit amount when the admin changes the rate later", async () => {
      const { reg, admin, owner } = await loadFixture(verifiedFixture);
      await reg.connect(admin).setCreditsPerTree(100);
      await reg.connect(owner).claimCredits(1);
      expect(await reg.balanceOf(owner.address, 1)).to.equal(3n * CREDITS_PER_TREE);
    });
  });

  describe("tree record proofs", () => {
    it("accepts a genuine record and rejects tampered ones", async () => {
      const { reg, data } = await loadFixture(submittedFixture);
      for (const [i, v] of data.tree.entries()) {
        const proof = data.tree.getProof(i);
        expect(await reg.verifyTreeRecord(1, data.tree.leafHash(v), proof)).to.equal(true);
      }
      const [, v0] = [...data.tree.entries()][0];
      const proof0 = data.tree.getProof(0);
      const forged = [...v0];
      forged[3] = 1n; // move the tree somewhere else
      expect(await reg.verifyTreeRecord(1, data.tree.leafHash(forged), proof0)).to.equal(false);
    });

    it("rejects a record belonging to another project", async () => {
      const { reg, other, data } = await loadFixture(submittedFixture);
      const foreign = buildDataset(other.address, "F");
      expect(await reg.verifyTreeRecord(1, foreign.tree.leafHash(foreign.values[0]), foreign.tree.getProof(0))).to.equal(false);
      expect(data.root).to.not.equal(foreign.root);
    });
  });

  describe("claiming", () => {
    it("mints the verified amount to the owner exactly once", async () => {
      const { reg, owner } = await loadFixture(verifiedFixture);
      await expect(reg.connect(owner).claimCredits(1)).to.emit(reg, "CreditsClaimed").withArgs(1, owner.address, 3n * CREDITS_PER_TREE);
      expect(await reg.balanceOf(owner.address, 1)).to.equal(66n);
      await expect(reg.connect(owner).claimCredits(1)).to.be.revertedWithCustomError(reg, "AlreadyClaimed");
    });

    it("only the owner can claim, and only when verified", async () => {
      const f = await loadFixture(submittedFixture);
      await expect(f.reg.connect(f.owner).claimCredits(1)).to.be.revertedWithCustomError(f.reg, "InvalidStatus");
      await f.reg.connect(f.verifier).verifyProject(1, 3);
      await expect(f.reg.connect(f.other).claimCredits(1)).to.be.revertedWithCustomError(f.reg, "NotProjectOwner");
    });

    it("cannot claim after expiry", async () => {
      const f = await loadFixture(verifiedFixture);
      await time.increase(VALIDITY + 10);
      await expect(f.reg.connect(f.owner).claimCredits(1)).to.be.revertedWithCustomError(f.reg, "CreditExpired");
    });

    it("cannot claim after revocation", async () => {
      const f = await loadFixture(verifiedFixture);
      await f.reg.connect(f.verifier).revokeProject(1, "fraud");
      await expect(f.reg.connect(f.owner).claimCredits(1)).to.be.revertedWithCustomError(f.reg, "InvalidStatus");
    });
  });

  describe("validity enforcement on transfer and retirement", () => {
    it("allows transfers of valid credits", async () => {
      const { reg, owner, buyer } = await loadFixture(claimedFixture);
      await reg.connect(owner).safeTransferFrom(owner.address, buyer.address, 1, 10, "0x");
      expect(await reg.balanceOf(buyer.address, 1)).to.equal(10n);
    });

    it("freezes transfers and retirement after revocation", async () => {
      const { reg, owner, buyer, verifier } = await loadFixture(claimedFixture);
      await expect(reg.connect(verifier).revokeProject(1, "Satellite imagery shows no trees"))
        .to.emit(reg, "ProjectRevoked");
      expect(await reg.isCreditValid(1)).to.equal(false);
      await expect(reg.connect(owner).safeTransferFrom(owner.address, buyer.address, 1, 1, "0x")).to.be.revertedWithCustomError(reg, "InvalidCredit");
      await expect(reg.connect(owner).retireCredits(1, 1, "offset")).to.be.revertedWithCustomError(reg, "InvalidCredit");
    });

    it("freezes credits after expiry", async () => {
      const { reg, owner, buyer } = await loadFixture(claimedFixture);
      await time.increase(VALIDITY + 10);
      expect(await reg.isCreditValid(1)).to.equal(false);
      await expect(reg.connect(owner).safeTransferFrom(owner.address, buyer.address, 1, 1, "0x")).to.be.revertedWithCustomError(reg, "InvalidCredit");
      await expect(reg.connect(owner).retireCredits(1, 1, "offset")).to.be.revertedWithCustomError(reg, "InvalidCredit");
    });

    it("only verifiers or the admin can revoke, and only verified projects", async () => {
      const { reg, other, admin } = await loadFixture(claimedFixture);
      await expect(reg.connect(other).revokeProject(1, "x")).to.be.revertedWithCustomError(reg, "NotAuthorizedToRevoke");
      await reg.connect(admin).revokeProject(1, "admin review");
      await expect(reg.connect(admin).revokeProject(1, "again")).to.be.revertedWithCustomError(reg, "InvalidStatus");
    });
  });

  describe("retirement", () => {
    it("burns credits and records who retired how much", async () => {
      const { reg, owner } = await loadFixture(claimedFixture);
      await expect(reg.connect(owner).retireCredits(1, 20, "Flight offset"))
        .to.emit(reg, "CreditsRetired")
        .withArgs(1, owner.address, 20, "Flight offset");
      expect(await reg.balanceOf(owner.address, 1)).to.equal(46n);
      expect(await reg.retired(1, owner.address)).to.equal(20n);
      expect(await reg.totalRetired(1)).to.equal(20n);
    });

    it("rejects zero amounts, empty reasons and over-balance retirement", async () => {
      const { reg, owner, other } = await loadFixture(claimedFixture);
      await expect(reg.connect(owner).retireCredits(1, 0, "x")).to.be.revertedWithCustomError(reg, "ZeroAmount");
      await expect(reg.connect(owner).retireCredits(1, 1, "")).to.be.revertedWithCustomError(reg, "InvalidText");
      await expect(reg.connect(other).retireCredits(1, 1, "x")).to.be.revertedWithCustomError(reg, "ERC1155InsufficientBalance");
      await expect(reg.connect(owner).retireCredits(1, 67, "x")).to.be.revertedWithCustomError(reg, "ERC1155InsufficientBalance");
    });
  });

  describe("admin and pausing", () => {
    it("only the admin can pause, and pausing halts the whole lifecycle", async () => {
      const { reg, admin, owner, other, verifier, buyer } = await loadFixture(claimedFixture);
      await expect(reg.connect(other).pause()).to.be.revertedWithCustomError(reg, "AccessControlUnauthorizedAccount");
      await reg.connect(admin).pause();

      const d = buildDataset(other.address, "P");
      await expect(reg.connect(other).submitProject("n", "l", 3, d.root, d.hash, "u")).to.be.revertedWithCustomError(reg, "EnforcedPause");
      await expect(reg.connect(owner).safeTransferFrom(owner.address, buyer.address, 1, 1, "0x")).to.be.revertedWithCustomError(reg, "EnforcedPause");
      await expect(reg.connect(owner).retireCredits(1, 1, "x")).to.be.revertedWithCustomError(reg, "EnforcedPause");
      await expect(reg.connect(verifier).verifyProject(1, 1)).to.be.revertedWithCustomError(reg, "EnforcedPause");

      await reg.connect(admin).unpause();
      await reg.connect(owner).safeTransferFrom(owner.address, buyer.address, 1, 1, "0x");
      expect(await reg.balanceOf(buyer.address, 1)).to.equal(1n);
    });

    it("bounds and gates setCreditsPerTree", async () => {
      const { reg, admin, other } = await loadFixture(deployFixture);
      await expect(reg.connect(other).setCreditsPerTree(5)).to.be.revertedWithCustomError(reg, "AccessControlUnauthorizedAccount");
      await expect(reg.connect(admin).setCreditsPerTree(0)).to.be.revertedWithCustomError(reg, "InvalidCreditsPerTree");
      await expect(reg.connect(admin).setCreditsPerTree(1001)).to.be.revertedWithCustomError(reg, "InvalidCreditsPerTree");
      await expect(reg.connect(admin).setCreditsPerTree(30)).to.emit(reg, "CreditsPerTreeUpdated").withArgs(22, 30);
    });

    it("only the admin can grant the verifier role", async () => {
      const { reg, other, VERIFIER_ROLE } = await loadFixture(deployFixture);
      await expect(reg.connect(other).grantRole(VERIFIER_ROLE, other.address)).to.be.revertedWithCustomError(reg, "AccessControlUnauthorizedAccount");
    });

    it("does not accept plain ETH", async () => {
      const { reg, other } = await loadFixture(deployFixture);
      await expect(other.sendTransaction({ to: await reg.getAddress(), value: 1n })).to.be.reverted;
    });
  });
});
