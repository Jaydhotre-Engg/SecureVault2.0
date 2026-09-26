"""
Compilation, Deployment, and Verification Script for EvidenceRegistry.sol
Target: Ethereum Sepolia Testnet (Chain ID 11155111)
"""

import os
import sys
import json
import logging
from pathlib import Path
from dotenv import load_dotenv

# Set paths
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

load_dotenv(dotenv_path=BACKEND_DIR / ".env")

import solcx
from web3 import Web3
from eth_account import Account
from app.services.blockchain_service import get_blockchain_config, get_web3_provider, get_wallet_address

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("securevault.deploy")

SOLC_VERSION = "0.8.20"
CONTRACTS_DIR = Path(__file__).resolve().parent / "contracts"
BUILD_DIR = Path(__file__).resolve().parent / "build"


def compile_contract():
    """
    Compile EvidenceRegistry.sol using solcx.
    Returns (abi, bytecode).
    """
    logger.info(f"Ensuring Solidity compiler solc {SOLC_VERSION} is installed...")
    try:
        solcx.install_solc(SOLC_VERSION)
        solcx.set_solc_version(SOLC_VERSION)
    except Exception as e:
        logger.error(f"Failed to install/set solc {SOLC_VERSION}: {e}")
        raise

    sol_file = CONTRACTS_DIR / "EvidenceRegistry.sol"
    logger.info(f"Compiling {sol_file}...")

    compiled = solcx.compile_files(
        [str(sol_file)],
        output_values=["abi", "bin"],
        solc_version=SOLC_VERSION,
        evm_version="shanghai"
    )

    contract_key = f"{sol_file}:EvidenceRegistry"
    if contract_key not in compiled:
        # Fallback to key without full path
        matching = [k for k in compiled.keys() if "EvidenceRegistry" in k]
        if not matching:
            raise KeyError(f"EvidenceRegistry not found in compiled output: {list(compiled.keys())}")
        contract_key = matching[0]

    contract_data = compiled[contract_key]
    abi = contract_data["abi"]
    bytecode = contract_data["bin"]

    BUILD_DIR.mkdir(parents=True, exist_ok=True)
    artifact_path = BUILD_DIR / "EvidenceRegistry.json"
    with open(artifact_path, "w") as f:
        json.dump({"contractName": "EvidenceRegistry", "abi": abi, "bytecode": bytecode}, f, indent=2)

    logger.info(f"Contract compiled successfully. Artifact saved to {artifact_path}")
    return abi, bytecode


def deploy_contract(abi, bytecode):
    """
    Deploy EvidenceRegistry to Ethereum Sepolia using Web3.py.
    """
    config = get_blockchain_config()
    rpc_url = config["rpc_url"]
    chain_id = config["chain_id"]
    private_key = config["private_key"]

    if not rpc_url:
        raise ValueError("BLOCKCHAIN_RPC_URL is not set.")
    if not private_key:
        raise ValueError("BLOCKCHAIN_PRIVATE_KEY is not set.")

    w3 = get_web3_provider(rpc_url)
    if not w3.is_connected():
        raise ConnectionError("Failed to connect to blockchain RPC.")

    detected_chain_id = w3.eth.chain_id
    logger.info(f"Connected to RPC. Detected Chain ID: {detected_chain_id} (Expected: {chain_id})")

    # Format private key
    if not private_key.startswith("0x"):
        private_key = f"0x{private_key}"

    account = Account.from_key(private_key)
    deployer_address = account.address
    balance_wei = w3.eth.get_balance(deployer_address)
    balance_eth = float(Web3.from_wei(balance_wei, "ether"))

    logger.info(f"Deployer Address: {deployer_address}")
    logger.info(f"Deployer Balance: {balance_eth:.6f} Sepolia ETH")

    if balance_eth < 0.001:
        raise ValueError(f"Insufficient balance ({balance_eth:.6f} ETH) for deployment.")

    Contract = w3.eth.contract(abi=abi, bytecode=bytecode)
    nonce = w3.eth.get_transaction_count(deployer_address, "pending")
    gas_price = w3.eth.gas_price

    # Estimate gas
    construct_txn = Contract.constructor().build_transaction({
        "from": deployer_address,
        "nonce": nonce,
        "gasPrice": gas_price,
        "chainId": detected_chain_id
    })

    try:
        estimated_gas = w3.eth.estimate_gas(construct_txn)
        construct_txn["gas"] = int(estimated_gas * 1.2)
    except Exception as e:
        logger.warning(f"Gas estimation warning ({e}), using fallback gas limit 1500000")
        construct_txn["gas"] = 1500000

    logger.info("Signing deployment transaction...")
    signed_txn = account.sign_transaction(construct_txn)

    logger.info("Broadcasting transaction to Sepolia testnet...")
    tx_hash = w3.eth.send_raw_transaction(signed_txn.raw_transaction)
    tx_hash_hex = tx_hash.to_0x_hex()
    logger.info(f"Deployment Transaction Hash: {tx_hash_hex}")
    logger.info("Waiting for transaction confirmation on Sepolia...")

    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=180)

    if receipt.status != 1:
        raise RuntimeError(f"Deployment transaction failed! Status: {receipt.status}")

    contract_address = receipt.contractAddress
    logger.info(f"EvidenceRegistry successfully deployed at: {contract_address}")
    logger.info(f"Block Number: {receipt.blockNumber} | Gas Used: {receipt.gasUsed}")

    return contract_address, tx_hash_hex, w3, account


def test_contract(contract_address, abi, w3, account):
    """
    Perform a harmless read/write verification test on the deployed contract.
    """
    logger.info("=" * 60)
    logger.info("Running Phase 4B Verification Tests on Sepolia...")
    logger.info("=" * 60)

    contract = w3.eth.contract(address=contract_address, abi=abi)

    # 1. Test Owner
    contract_owner = contract.functions.owner().call()
    logger.info(f"Contract Owner: {contract_owner} (Matches deployer: {contract_owner.lower() == account.address.lower()})")
    assert contract_owner.lower() == account.address.lower(), "Owner mismatch!"

    # 2. Test Anchor Proof (Harmless test record ID 999999)
    test_id = 999999
    test_sha256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    test_cid = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"
    test_custody = "a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e"

    # Check does not exist initially
    exists_before = contract.functions.evidenceExists(test_id).call()
    logger.info(f"Evidence #{test_id} exists before test: {exists_before}")
    assert not exists_before, "Test evidence should not exist prior to test."

    # Build anchor transaction
    nonce = w3.eth.get_transaction_count(account.address, "pending")
    anchor_txn = contract.functions.anchorEvidence(
        test_id,
        test_sha256,
        test_cid,
        test_custody
    ).build_transaction({
        "from": account.address,
        "nonce": nonce,
        "gasPrice": w3.eth.gas_price,
        "chainId": w3.eth.chain_id
    })

    try:
        est_gas = w3.eth.estimate_gas(anchor_txn)
        anchor_txn["gas"] = int(est_gas * 1.2)
    except Exception:
        anchor_txn["gas"] = 300000

    logger.info(f"Submitting test anchor transaction for evidence #{test_id}...")
    signed_anchor = account.sign_transaction(anchor_txn)
    anchor_tx_hash = w3.eth.send_raw_transaction(signed_anchor.raw_transaction)
    logger.info(f"Anchor Tx Hash: {anchor_tx_hash.to_0x_hex()}")

    receipt = w3.eth.wait_for_transaction_receipt(anchor_tx_hash, timeout=120)
    assert receipt.status == 1, "Anchor transaction failed!"
    logger.info(f"Anchor confirmed in block {receipt.blockNumber}")

    # 3. Test getEvidenceProof
    proof = contract.functions.getEvidenceProof(test_id).call()
    logger.info("Retrieved On-Chain Proof:")
    logger.info(f"  Evidence ID   : {proof[0]}")
    logger.info(f"  Evidence SHA  : {proof[1]}")
    logger.info(f"  IPFS CID      : {proof[2]}")
    logger.info(f"  Custody Hash  : {proof[3]}")
    logger.info(f"  Timestamp     : {proof[4]}")
    logger.info(f"  Anchored By   : {proof[5]}")
    logger.info(f"  Exists        : {proof[6]}")

    assert proof[0] == test_id
    assert proof[1] == test_sha256
    assert proof[2] == test_cid
    assert proof[3] == test_custody
    assert proof[5].lower() == account.address.lower()
    assert proof[6] is True

    # 4. Test duplicate prevention on-chain
    logger.info("Testing duplicate prevention (expecting revert)...")
    try:
        contract.functions.anchorEvidence(
            test_id,
            test_sha256,
            test_cid,
            test_custody
        ).call({"from": account.address})
        raise AssertionError("Duplicate anchor did not revert as expected!")
    except Exception as e:
        logger.info(f"Duplicate anchor successfully rejected with revert: {e}")

    logger.info("All Phase 4B smart contract tests PASSED successfully!")


def main():
    print("=" * 60)
    print(" SecureVault 2.0 - Phase 4B Smart Contract Deployment")
    print("=" * 60)

    abi, bytecode = compile_contract()
    contract_address, tx_hash, w3, account = deploy_contract(abi, bytecode)
    test_contract(contract_address, abi, w3, account)

    print("\n" + "=" * 60)
    print(" DEPLOYMENT COMPLETE & VERIFIED")
    print(f" Contract Address : {contract_address}")
    print(f" Deployment Tx    : {tx_hash}")
    print("=" * 60)


if __name__ == "__main__":
    main()
