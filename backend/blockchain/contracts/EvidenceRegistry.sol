// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title EvidenceRegistry
 * @dev SecureVault 2.0 immutable blockchain anchoring registry for digital evidence.
 * Anchors cryptographic proofs (SHA-256 hash, IPFS CID, and Chain-of-Custody state)
 * on Ethereum Sepolia without storing any raw or sensitive evidence data.
 */
contract EvidenceRegistry {
    // Contract owner (SecureVault backend anchoring account)
    address public owner;

    // Proof structure representing on-chain evidence anchor
    struct EvidenceProof {
        uint256 evidenceId;
        string evidenceHash;
        string ipfsCid;
        string custodyHash;
        uint256 timestamp;
        address anchoredBy;
        bool exists;
    }

    // Mapping from Evidence ID to its EvidenceProof
    mapping(uint256 => EvidenceProof) public evidenceProofs;

    // Events
    event EvidenceAnchored(
        uint256 indexed evidenceId,
        string evidenceHash,
        string ipfsCid,
        string custodyHash,
        uint256 timestamp,
        address indexed anchoredBy
    );

    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );

    // Access control modifier
    modifier onlyOwner() {
        require(msg.sender == owner, "EvidenceRegistry: caller is not the owner");
        _;
    }

    /**
     * @dev Sets the deployer as the initial owner.
     */
    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    /**
     * @notice Anchors digital evidence metadata on-chain.
     * @param _evidenceId The SecureVault primary key ID of the evidence.
     * @param _evidenceHash The original raw file SHA-256 hash.
     * @param _ipfsCid The IPFS content identifier for the encrypted artifact.
     * @param _custodyHash The latest Chain-of-Custody cryptographic event hash.
     */
    function anchorEvidence(
        uint256 _evidenceId,
        string memory _evidenceHash,
        string memory _ipfsCid,
        string memory _custodyHash
    ) external onlyOwner {
        require(_evidenceId > 0, "EvidenceRegistry: invalid evidence ID");
        require(!evidenceProofs[_evidenceId].exists, "EvidenceRegistry: evidence already anchored");
        require(bytes(_evidenceHash).length > 0, "EvidenceRegistry: empty evidence hash");
        require(bytes(_ipfsCid).length > 0, "EvidenceRegistry: empty IPFS CID");
        require(bytes(_custodyHash).length > 0, "EvidenceRegistry: empty custody hash");

        evidenceProofs[_evidenceId] = EvidenceProof({
            evidenceId: _evidenceId,
            evidenceHash: _evidenceHash,
            ipfsCid: _ipfsCid,
            custodyHash: _custodyHash,
            timestamp: block.timestamp,
            anchoredBy: msg.sender,
            exists: true
        });

        emit EvidenceAnchored(
            _evidenceId,
            _evidenceHash,
            _ipfsCid,
            _custodyHash,
            block.timestamp,
            msg.sender
        );
    }

    /**
     * @notice Checks if an evidence ID has been anchored.
     * @param _evidenceId The evidence ID to check.
     * @return bool True if anchored, false otherwise.
     */
    function evidenceExists(uint256 _evidenceId) external view returns (bool) {
        return evidenceProofs[_evidenceId].exists;
    }

    /**
     * @notice Retrieves the anchored proof for an evidence ID.
     * @param _evidenceId The evidence ID to query.
     * @return EvidenceProof The on-chain proof metadata.
     */
    function getEvidenceProof(uint256 _evidenceId) external view returns (EvidenceProof memory) {
        require(evidenceProofs[_evidenceId].exists, "EvidenceRegistry: evidence not found");
        return evidenceProofs[_evidenceId];
    }

    /**
     * @notice Transfers ownership of the registry to a new address.
     * @param _newOwner The address of the new owner.
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "EvidenceRegistry: new owner is the zero address");
        emit OwnershipTransferred(owner, _newOwner);
        owner = _newOwner;
    }
}
