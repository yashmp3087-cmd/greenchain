// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {AccessControlDefaultAdminRules} from "@openzeppelin/contracts/access/extensions/AccessControlDefaultAdminRules.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title CarbonCreditRegistry
 * @notice Registry of tree-planting projects plus the carbon credits (ERC-1155) minted from them.
 *
 * Lifecycle of a project (one ERC-1155 token id per project):
 *   1. Landowner submits tree data: a Merkle root over every tree record, a hash of the
 *      full evidence file and a URI. Status = Pending.
 *   2. A verifier (never the owner) checks the data off-chain and either
 *        - verifies it, approving N <= submitted trees  -> Verified, credits = N * creditsPerTree
 *        - rejects it                                    -> Rejected
 *   3. The owner claims the credits once (minted to the owner).
 *   4. Credits may be transferred or retired (burned) only while the project is VALID:
 *      status Verified and not past its expiry. A verifier/admin can revoke a fraudulent
 *      project, which freezes all of its credits.
 *
 * Unit: 1 credit = 1 kg CO2e (no decimals). The per-tree rate is snapshotted at verification.
 */
contract CarbonCreditRegistry is ERC1155, AccessControlDefaultAdminRules, Pausable, ReentrancyGuard {
    // ───────────────────────────── Types ─────────────────────────────
    enum Status {
        None,
        Pending,
        Verified,
        Rejected,
        Revoked
    }

    struct Project {
        address owner;
        Status status;
        bool claimed;
        uint32 submittedTreeCount;
        uint32 verifiedTreeCount;
        uint64 submittedAt;
        uint64 verifiedAt;
        uint64 validUntil;
        uint256 creditsIssued;
        bytes32 treeDataRoot;
        bytes32 evidenceHash;
        string name;
        string location;
        string evidenceURI;
    }

    // ─────────────────────────── Constants ───────────────────────────
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    uint32 public constant MAX_TREES_PER_PROJECT = 5_000;
    uint256 public constant MAX_CREDITS_PER_TREE = 1_000;
    uint64 public constant MAX_VALIDITY_PERIOD = 36_500 days;
    uint256 public constant MAX_NAME_LENGTH = 100;
    uint256 public constant MAX_URI_LENGTH = 256;
    uint256 public constant MAX_REASON_LENGTH = 256;

    // ───────────────────────────── State ─────────────────────────────
    uint256 public projectCount;
    uint256 public creditsPerTree;
    uint64 public immutable validityPeriod;

    mapping(uint256 => Project) private _projects;
    mapping(bytes32 => bool) public treeRootUsed;
    mapping(bytes32 => bool) public evidenceHashUsed;
    mapping(uint256 => mapping(address => uint256)) public retired;
    mapping(uint256 => uint256) public totalRetired;

    // ───────────────────────────── Events ────────────────────────────
    event ProjectSubmitted(uint256 indexed id, address indexed owner, uint32 treeCount, bytes32 treeDataRoot);
    event ProjectVerified(
        uint256 indexed id,
        address indexed verifier,
        uint32 approvedTreeCount,
        uint256 credits,
        uint64 validUntil
    );
    event ProjectRejected(uint256 indexed id, address indexed verifier, string reason);
    event ProjectRevoked(uint256 indexed id, address indexed by, string reason);
    event CreditsClaimed(uint256 indexed id, address indexed owner, uint256 amount);
    event CreditsRetired(uint256 indexed id, address indexed account, uint256 amount, string reason);
    event CreditsPerTreeUpdated(uint256 previousValue, uint256 newValue);

    // ───────────────────────────── Errors ────────────────────────────
    error ProjectNotFound(uint256 id);
    error InvalidText();
    error InvalidTreeCount();
    error EmptyHash();
    error DuplicateEvidence();
    error InvalidStatus(Status current);
    error ConflictOfInterest();
    error NotProjectOwner();
    error NotAuthorizedToRevoke();
    error AlreadyClaimed();
    error CreditExpired();
    error InvalidCredit(uint256 id);
    error ZeroAmount();
    error InvalidCreditsPerTree();
    error InvalidValidityPeriod();

    // ────────────────────────── Constructor ──────────────────────────
    constructor(
        address admin,
        uint48 adminDelay,
        string memory uri_,
        uint256 creditsPerTree_,
        uint64 validityPeriod_
    ) ERC1155(uri_) AccessControlDefaultAdminRules(adminDelay, admin) {
        if (creditsPerTree_ == 0 || creditsPerTree_ > MAX_CREDITS_PER_TREE) revert InvalidCreditsPerTree();
        if (validityPeriod_ == 0 || validityPeriod_ > MAX_VALIDITY_PERIOD) revert InvalidValidityPeriod();
        creditsPerTree = creditsPerTree_;
        validityPeriod = validityPeriod_;
    }

    // ──────────────────────── Project lifecycle ──────────────────────

    /// @notice Submit a tree-planting project for verification.
    /// @param treeDataRoot Merkle root of all tree records (OpenZeppelin StandardMerkleTree).
    /// @param evidenceHash keccak256 of the full evidence file stored off-chain.
    function submitProject(
        string calldata name,
        string calldata location,
        uint32 treeCount,
        bytes32 treeDataRoot,
        bytes32 evidenceHash,
        string calldata evidenceURI
    ) external whenNotPaused returns (uint256 id) {
        _checkText(name, MAX_NAME_LENGTH);
        _checkText(location, MAX_NAME_LENGTH);
        _checkText(evidenceURI, MAX_URI_LENGTH);
        if (treeCount == 0 || treeCount > MAX_TREES_PER_PROJECT) revert InvalidTreeCount();
        if (treeDataRoot == bytes32(0) || evidenceHash == bytes32(0)) revert EmptyHash();
        if (treeRootUsed[treeDataRoot] || evidenceHashUsed[evidenceHash]) revert DuplicateEvidence();

        treeRootUsed[treeDataRoot] = true;
        evidenceHashUsed[evidenceHash] = true;

        id = ++projectCount;
        Project storage p = _projects[id];
        p.owner = msg.sender;
        p.status = Status.Pending;
        p.submittedTreeCount = treeCount;
        p.submittedAt = uint64(block.timestamp);
        p.treeDataRoot = treeDataRoot;
        p.evidenceHash = evidenceHash;
        p.name = name;
        p.location = location;
        p.evidenceURI = evidenceURI;

        emit ProjectSubmitted(id, msg.sender, treeCount, treeDataRoot);
    }

    /// @notice Verify a pending project, approving up to the number of submitted trees.
    function verifyProject(uint256 id, uint32 approvedTreeCount) external onlyRole(VERIFIER_ROLE) whenNotPaused {
        Project storage p = _getProject(id);
        if (p.status != Status.Pending) revert InvalidStatus(p.status);
        if (p.owner == msg.sender) revert ConflictOfInterest();
        if (approvedTreeCount == 0 || approvedTreeCount > p.submittedTreeCount) revert InvalidTreeCount();

        uint256 credits = uint256(approvedTreeCount) * creditsPerTree;
        uint64 until = uint64(block.timestamp) + validityPeriod;

        p.status = Status.Verified;
        p.verifiedTreeCount = approvedTreeCount;
        p.verifiedAt = uint64(block.timestamp);
        p.validUntil = until;
        p.creditsIssued = credits;

        emit ProjectVerified(id, msg.sender, approvedTreeCount, credits, until);
    }

    /// @notice Reject a pending project.
    function rejectProject(uint256 id, string calldata reason) external onlyRole(VERIFIER_ROLE) whenNotPaused {
        Project storage p = _getProject(id);
        if (p.status != Status.Pending) revert InvalidStatus(p.status);
        if (p.owner == msg.sender) revert ConflictOfInterest();
        _checkText(reason, MAX_REASON_LENGTH);

        p.status = Status.Rejected;
        emit ProjectRejected(id, msg.sender, reason);
    }

    /// @notice Revoke a verified project (e.g. fraud found later). Freezes all its credits.
    function revokeProject(uint256 id, string calldata reason) external {
        if (!hasRole(VERIFIER_ROLE, msg.sender) && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert NotAuthorizedToRevoke();
        }
        Project storage p = _getProject(id);
        if (p.status != Status.Verified) revert InvalidStatus(p.status);
        _checkText(reason, MAX_REASON_LENGTH);

        p.status = Status.Revoked;
        emit ProjectRevoked(id, msg.sender, reason);
    }

    /// @notice Mint the verified credits to the project owner. Callable once per project.
    function claimCredits(uint256 id) external nonReentrant whenNotPaused {
        Project storage p = _getProject(id);
        if (p.owner != msg.sender) revert NotProjectOwner();
        if (p.status != Status.Verified) revert InvalidStatus(p.status);
        if (block.timestamp > p.validUntil) revert CreditExpired();
        if (p.claimed) revert AlreadyClaimed();

        p.claimed = true; // effects before the external ERC-1155 receiver callback
        uint256 amount = p.creditsIssued;
        _mint(msg.sender, id, amount, "");

        emit CreditsClaimed(id, msg.sender, amount);
    }

    /// @notice Permanently retire (burn) credits to offset emissions.
    function retireCredits(uint256 id, uint256 amount, string calldata reason) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        _checkText(reason, MAX_REASON_LENGTH);
        if (!isCreditValid(id)) revert InvalidCredit(id);

        retired[id][msg.sender] += amount;
        totalRetired[id] += amount;
        _burn(msg.sender, id, amount);

        emit CreditsRetired(id, msg.sender, amount, reason);
    }

    // ───────────────────────────── Views ─────────────────────────────

    /// @notice True when the credits of `id` are currently usable: verified and not expired.
    function isCreditValid(uint256 id) public view returns (bool) {
        Project storage p = _projects[id];
        return p.status == Status.Verified && block.timestamp <= p.validUntil;
    }

    function getProject(uint256 id) external view returns (Project memory) {
        return _getProject(id);
    }

    /// @notice Check that a tree record (already hashed as an OZ StandardMerkleTree leaf)
    ///         belongs to the dataset committed by project `id`.
    function verifyTreeRecord(uint256 id, bytes32 leaf, bytes32[] calldata proof) external view returns (bool) {
        return MerkleProof.verifyCalldata(proof, _getProject(id).treeDataRoot, leaf);
    }

    // ───────────────────────────── Admin ─────────────────────────────

    function setCreditsPerTree(uint256 newValue) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newValue == 0 || newValue > MAX_CREDITS_PER_TREE) revert InvalidCreditsPerTree();
        emit CreditsPerTreeUpdated(creditsPerTree, newValue);
        creditsPerTree = newValue;
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // ──────────────────────────── Internals ──────────────────────────

    function _getProject(uint256 id) private view returns (Project storage p) {
        if (id == 0 || id > projectCount) revert ProjectNotFound(id);
        p = _projects[id];
    }

    function _checkText(string calldata s, uint256 maxLength) private pure {
        uint256 len = bytes(s).length;
        if (len == 0 || len > maxLength) revert InvalidText();
    }

    /// @dev Transfers (not mint/burn) are only allowed for valid credits; everything stops when paused.
    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal override whenNotPaused {
        if (from != address(0) && to != address(0)) {
            for (uint256 i = 0; i < ids.length; ++i) {
                if (!isCreditValid(ids[i])) revert InvalidCredit(ids[i]);
            }
        }
        super._update(from, to, ids, values);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC1155, AccessControlDefaultAdminRules) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
