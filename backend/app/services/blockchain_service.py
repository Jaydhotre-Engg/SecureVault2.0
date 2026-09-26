import os
import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional, Tuple
from dotenv import load_dotenv
from web3 import Web3
from eth_account import Account

load_dotenv()

logger = logging.getLogger("securevault.blockchain")

# Configuration constants
SEPOLIA_CHAIN_ID = 11155111

# ABI Artifact Path
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
ABI_PATH = BACKEND_DIR / "blockchain" / "build" / "EvidenceRegistry.json"


def get_blockchain_config() -> Dict[str, Any]:
    """
    Safely load blockchain configuration from environment variables.
    Never exposes raw private keys or full RPC URLs in unstructured logs.
    """
    rpc_url = os.getenv("BLOCKCHAIN_RPC_URL", "").strip()
    chain_id_env = os.getenv("BLOCKCHAIN_CHAIN_ID", str(SEPOLIA_CHAIN_ID)).strip()
    private_key = os.getenv("BLOCKCHAIN_PRIVATE_KEY", "").strip()
    contract_address = os.getenv("BLOCKCHAIN_CONTRACT_ADDRESS", "").strip()

    try:
        chain_id = int(chain_id_env)
    except ValueError:
        chain_id = SEPOLIA_CHAIN_ID

    return {
        "rpc_url": rpc_url,
        "chain_id": chain_id,
        "private_key": private_key,
        "contract_address": contract_address
    }


def get_web3_provider(rpc_url: Optional[str] = None) -> Web3:
    """
    Create and return a configured Web3 instance.
    """
    if not rpc_url:
        config = get_blockchain_config()
        rpc_url = config["rpc_url"]

    if not rpc_url:
        raise ValueError("BLOCKCHAIN_RPC_URL environment variable is not configured.")

    w3 = Web3(Web3.HTTPProvider(rpc_url, request_kwargs={"timeout": 30}))
    return w3


def get_contract_abi() -> list:
    """
    Load the compiled EvidenceRegistry ABI from the build artifact.
    """
    if not ABI_PATH.exists():
        raise FileNotFoundError(f"Contract ABI artifact not found at {ABI_PATH}. Ensure contract has been compiled.")

    with open(ABI_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
        return data.get("abi", data)


def get_contract_instance(w3: Optional[Web3] = None, contract_address: Optional[str] = None):
    """
    Instantiate and return the Web3 contract object for EvidenceRegistry.
    """
    if not w3:
        w3 = get_web3_provider()

    if not contract_address:
        config = get_blockchain_config()
        contract_address = config["contract_address"]

    if not contract_address:
        raise ValueError("BLOCKCHAIN_CONTRACT_ADDRESS is not configured in .env.")

    checksum_address = Web3.to_checksum_address(contract_address)
    abi = get_contract_abi()
    return w3.eth.contract(address=checksum_address, abi=abi)


def get_wallet_address(private_key: Optional[str] = None) -> Optional[str]:
    """
    Derive the public Ethereum wallet address from the configured private key.
    Returns checksummed address or None if not configured/invalid.
    """
    if not private_key:
        config = get_blockchain_config()
        private_key = config["private_key"]

    if not private_key:
        return None

    try:
        if not private_key.startswith("0x"):
            formatted_key = f"0x{private_key}"
        else:
            formatted_key = private_key

        account = Account.from_key(formatted_key)
        return account.address
    except Exception as e:
        logger.warning(f"Failed to derive wallet address from private key: {str(e)}")
        return None


def get_wallet_balance_wei(w3: Web3, address: str) -> int:
    """
    Get the balance of a wallet address in Wei.
    """
    return w3.eth.get_balance(Web3.to_checksum_address(address))


def get_wallet_balance_eth(w3: Web3, address: str) -> float:
    """
    Get the balance of a wallet address in Ether (Sepolia ETH).
    """
    balance_wei = get_wallet_balance_wei(w3, address)
    return float(Web3.from_wei(balance_wei, "ether"))


def get_blockchain_diagnostics() -> Dict[str, Any]:
    """
    Run a safe diagnostic check on the blockchain connection, chain ID,
    wallet address, and testnet balance.
    """
    config = get_blockchain_config()
    rpc_url = config["rpc_url"]
    expected_chain_id = config["chain_id"]
    private_key = config["private_key"]
    contract_address = config["contract_address"]

    diagnostics: Dict[str, Any] = {
        "configured": bool(rpc_url),
        "connected": False,
        "expected_chain_id": expected_chain_id,
        "detected_chain_id": None,
        "chain_id_matches": False,
        "contract_address": contract_address or None,
        "contract_accessible": False,
        "wallet_configured": bool(private_key),
        "wallet_address": None,
        "balance_eth": None,
        "error": None
    }

    if not rpc_url:
        diagnostics["error"] = "BLOCKCHAIN_RPC_URL is not set in environment."
        return diagnostics

    try:
        w3 = get_web3_provider(rpc_url)
        is_connected = w3.is_connected()
        diagnostics["connected"] = is_connected

        if not is_connected:
            diagnostics["error"] = "Failed to establish connection to RPC provider."
            return diagnostics

        detected_chain_id = w3.eth.chain_id
        diagnostics["detected_chain_id"] = detected_chain_id
        diagnostics["chain_id_matches"] = (detected_chain_id == expected_chain_id)

        address = get_wallet_address(private_key)
        diagnostics["wallet_address"] = address

        if address:
            balance_eth = get_wallet_balance_eth(w3, address)
            diagnostics["balance_eth"] = balance_eth

        if contract_address:
            try:
                contract = get_contract_instance(w3, contract_address)
                owner = contract.functions.owner().call()
                diagnostics["contract_accessible"] = True
                diagnostics["contract_owner"] = owner
            except Exception as contract_err:
                diagnostics["contract_accessible"] = False
                logger.warning(f"Contract access check failed: {contract_err}")

    except Exception as err:
        diagnostics["error"] = f"Diagnostic failed: {str(err)}"

    return diagnostics


def anchor_evidence(
    evidence_id: int,
    file_hash: str,
    ipfs_cid: str,
    custody_hash: str
) -> Dict[str, Any]:
    """
    Anchor digital evidence metadata to Ethereum Sepolia via EvidenceRegistry smart contract.

    Args:
        evidence_id: Database ID of the evidence.
        file_hash: Original file SHA-256 hash.
        ipfs_cid: Pinata/IPFS Content ID of the encrypted artifact.
        custody_hash: Cryptographic event hash of the REGISTERED custody event.

    Returns:
        Dict containing tx_hash, block_number, gas_used, contract_address, status.

    Raises:
        ValueError, ConnectionError, RuntimeError on validation or on-chain execution failure.
    """
    # 1. Parameter validation
    if evidence_id <= 0:
        raise ValueError(f"Invalid evidence ID: {evidence_id}")
    if not file_hash or not isinstance(file_hash, str):
        raise ValueError("Evidence file_hash must be a non-empty string.")
    if not ipfs_cid or not isinstance(ipfs_cid, str):
        raise ValueError("Evidence ipfs_cid must be a non-empty string.")
    if not custody_hash or not isinstance(custody_hash, str):
        raise ValueError("Evidence custody_hash must be a non-empty string.")

    # 2. Configuration & Web3 Provider
    config = get_blockchain_config()
    rpc_url = config["rpc_url"]
    expected_chain_id = config["chain_id"]
    private_key = config["private_key"]
    contract_address = config["contract_address"]

    if not rpc_url:
        raise ValueError("BLOCKCHAIN_RPC_URL is not configured.")
    if not private_key:
        raise ValueError("BLOCKCHAIN_PRIVATE_KEY is not configured.")
    if not contract_address:
        raise ValueError("BLOCKCHAIN_CONTRACT_ADDRESS is not configured.")

    w3 = get_web3_provider(rpc_url)
    if not w3.is_connected():
        raise ConnectionError("Failed to connect to Ethereum Sepolia RPC.")

    detected_chain_id = w3.eth.chain_id
    if detected_chain_id != expected_chain_id:
        raise ValueError(f"Chain ID mismatch: connected to {detected_chain_id}, expected {expected_chain_id} (Sepolia).")

    # 3. Account derivation & balance check
    if not private_key.startswith("0x"):
        formatted_key = f"0x{private_key}"
    else:
        formatted_key = private_key

    account = Account.from_key(formatted_key)
    sender_address = account.address

    balance_wei = w3.eth.get_balance(sender_address)
    if balance_wei < w3.to_wei(0.0005, "ether"):
        balance_eth = float(Web3.from_wei(balance_wei, "ether"))
        raise RuntimeError(f"Insufficient Sepolia ETH balance ({balance_eth:.6f} ETH) for gas fees.")

    # 4. Instantiate contract
    contract = get_contract_instance(w3, contract_address)

    # Check if already anchored on-chain
    already_exists = contract.functions.evidenceExists(evidence_id).call()
    if already_exists:
        raise ValueError(f"Evidence #{evidence_id} is already anchored on-chain.")

    # 5. Build transaction with EIP-1559 dynamic fee calculation
    nonce = w3.eth.get_transaction_count(sender_address, "pending")

    try:
        latest_block = w3.eth.get_block("latest")
        base_fee = latest_block.get("baseFeePerGas", w3.eth.gas_price)
    except Exception:
        base_fee = w3.eth.gas_price

    # Ensure competitive priority fee (at least 2.5 Gwei) so Sepolia validators prioritize the transaction
    min_priority_fee = w3.to_wei(2.5, "gwei")
    try:
        network_priority_fee = w3.eth.max_priority_fee
        max_priority_fee = max(network_priority_fee, min_priority_fee)
    except Exception:
        max_priority_fee = min_priority_fee

    # Robust EIP-1559 max fee calculation: 3 * base_fee + tip
    max_fee = int(base_fee * 3 + max_priority_fee)

    tx_data = contract.functions.anchorEvidence(
        evidence_id,
        file_hash,
        ipfs_cid,
        custody_hash
    ).build_transaction({
        "from": sender_address,
        "nonce": nonce,
        "maxFeePerGas": max_fee,
        "maxPriorityFeePerGas": max_priority_fee,
        "chainId": detected_chain_id,
        "type": 2
    })

    # Estimate gas with 20% safety margin
    try:
        estimated_gas = w3.eth.estimate_gas(tx_data)
        tx_data["gas"] = int(estimated_gas * 1.2)
    except Exception as gas_err:
        logger.warning(f"Gas estimation failed ({gas_err}), using fallback 300,000 gas limit.")
        tx_data["gas"] = 300000

    # 6. Sign and broadcast
    logger.info(f"Signing and broadcasting anchor transaction for Evidence #{evidence_id} on Sepolia...")
    signed_tx = account.sign_transaction(tx_data)
    tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
    tx_hash_hex = tx_hash.to_0x_hex()

    logger.info(f"Transaction submitted: {tx_hash_hex}. Waiting for block confirmation...")

    # 7. Wait for receipt
    try:
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=180)
    except Exception as wait_err:
        raise TimeoutError(f"Transaction confirmation timed out for {tx_hash_hex}: {str(wait_err)}")

    if receipt.status != 1:
        raise RuntimeError(f"Blockchain transaction failed or reverted on Sepolia. Tx: {tx_hash_hex}")

    logger.info(f"Evidence #{evidence_id} successfully anchored in Block {receipt.blockNumber} (Gas Used: {receipt.gasUsed}).")

    return {
        "tx_hash": tx_hash_hex,
        "block_number": receipt.blockNumber,
        "gas_used": receipt.gasUsed,
        "contract_address": contract_address,
        "status": "CONFIRMED"
    }


def get_onchain_proof(evidence_id: int) -> Dict[str, Any]:
    """
    Retrieve on-chain evidence proof from EvidenceRegistry smart contract.

    Args:
        evidence_id: Evidence ID to query.

    Returns:
        Dict with evidence_id, evidence_hash, ipfs_cid, custody_hash, timestamp, anchored_by, exists.
    """
    if evidence_id <= 0:
        raise ValueError(f"Invalid evidence ID: {evidence_id}")

    w3 = get_web3_provider()
    contract = get_contract_instance(w3)

    exists = contract.functions.evidenceExists(evidence_id).call()
    if not exists:
        return {
            "evidence_id": evidence_id,
            "exists": False
        }

    proof = contract.functions.getEvidenceProof(evidence_id).call()

    return {
        "evidence_id": proof[0],
        "evidence_hash": proof[1],
        "ipfs_cid": proof[2],
        "custody_hash": proof[3],
        "timestamp": proof[4],
        "anchored_by": proof[5],
        "exists": proof[6]
    }


def evidence_exists_onchain(evidence_id: int) -> bool:
    """
    Quick check if an evidence ID is already anchored on-chain.
    """
    if evidence_id <= 0:
        return False

    try:
        w3 = get_web3_provider()
        contract = get_contract_instance(w3)
        return bool(contract.functions.evidenceExists(evidence_id).call())
    except Exception as e:
        logger.warning(f"Failed to check on-chain existence for #{evidence_id}: {str(e)}")
        return False


def verify_evidence_onchain(
    evidence_id: int,
    file_hash: str,
    ipfs_cid: Optional[str],
    current_custody_hash: Optional[str],
    blockchain_tx: Optional[str] = None,
    w3: Optional[Web3] = None,
    contract: Optional[Any] = None
) -> Dict[str, Any]:
    """
    Perform read-only cryptographic verification of evidence against the Ethereum Sepolia smart contract.

    Compares:
      - Database Evidence ID == On-Chain Evidence ID
      - Database File SHA-256 == On-Chain Evidence Hash
      - Database IPFS CID == On-Chain IPFS CID
      - Current Latest Custody Hash == On-Chain Anchored Custody Hash

    Returns structured verification results detailing component matches and identified mismatches.
    """
    if evidence_id <= 0:
        raise ValueError(f"Invalid evidence ID: {evidence_id}")

    mismatches = []
    database_proof = {
        "evidence_id": evidence_id,
        "file_hash": file_hash,
        "ipfs_cid": ipfs_cid,
        "current_custody_hash": current_custody_hash,
        "blockchain_tx": blockchain_tx
    }

    if not blockchain_tx:
        mismatches.append("no_blockchain_tx")

    if not w3:
        w3 = get_web3_provider()

    # Query on-chain proof from smart contract
    onchain_proof = get_onchain_proof(evidence_id)

    if not onchain_proof or not onchain_proof.get("exists"):
        if "not_anchored_onchain" not in mismatches:
            mismatches.append("not_anchored_onchain")

        return {
            "evidence_id": evidence_id,
            "blockchain_verified": False,
            "evidence_hash_match": False,
            "ipfs_cid_match": False,
            "custody_hash_match": False,
            "onchain_exists": False,
            "transaction_hash": blockchain_tx,
            "block_number": None,
            "anchored_at": None,
            "anchored_by": None,
            "database_proof": database_proof,
            "onchain_proof": None,
            "mismatches": mismatches
        }

    # Extract on-chain fields
    onchain_evidence_id = onchain_proof.get("evidence_id")
    onchain_evidence_hash = onchain_proof.get("evidence_hash")
    onchain_ipfs_cid = onchain_proof.get("ipfs_cid")
    onchain_custody_hash = onchain_proof.get("custody_hash")
    onchain_timestamp = onchain_proof.get("timestamp")
    onchain_anchored_by = onchain_proof.get("anchored_by")

    # Evaluate matches
    evidence_id_match = (evidence_id == onchain_evidence_id)
    evidence_hash_match = (file_hash == onchain_evidence_hash)
    ipfs_cid_match = (ipfs_cid == onchain_ipfs_cid)
    custody_hash_match = bool(current_custody_hash and current_custody_hash == onchain_custody_hash)

    if not evidence_id_match:
        mismatches.append("evidence_id")
    if not evidence_hash_match:
        mismatches.append("evidence_hash")
    if not ipfs_cid_match:
        mismatches.append("ipfs_cid")
    if not custody_hash_match:
        mismatches.append("custody_hash")

    # Retrieve block number from transaction receipt if blockchain_tx is known
    block_number = None
    if blockchain_tx:
        try:
            receipt = w3.eth.get_transaction_receipt(blockchain_tx)
            if receipt:
                block_number = receipt.blockNumber
        except Exception as err:
            logger.debug(f"Could not retrieve block number for tx {blockchain_tx}: {err}")

    # Format timestamp to ISO string
    anchored_at_iso = None
    if onchain_timestamp:
        try:
            from datetime import datetime, timezone
            anchored_at_iso = datetime.fromtimestamp(onchain_timestamp, tz=timezone.utc).isoformat()
        except Exception:
            anchored_at_iso = str(onchain_timestamp)

    is_verified = (
        len(mismatches) == 0 and
        onchain_proof.get("exists", False) and
        evidence_hash_match and
        ipfs_cid_match and
        custody_hash_match
    )

    return {
        "evidence_id": evidence_id,
        "blockchain_verified": is_verified,
        "evidence_hash_match": evidence_hash_match,
        "ipfs_cid_match": ipfs_cid_match,
        "custody_hash_match": custody_hash_match,
        "onchain_exists": True,
        "transaction_hash": blockchain_tx,
        "block_number": block_number,
        "anchored_at": anchored_at_iso,
        "anchored_by": onchain_anchored_by,
        "database_proof": database_proof,
        "onchain_proof": {
            "evidence_id": onchain_evidence_id,
            "evidence_hash": onchain_evidence_hash,
            "ipfs_cid": onchain_ipfs_cid,
            "anchored_custody_hash": onchain_custody_hash,
            "timestamp": onchain_timestamp,
            "anchored_by": onchain_anchored_by,
            "exists": True
        },
        "mismatches": mismatches
    }

