"""
Standalone Blockchain Environment Diagnostic for SecureVault 2.0 (Phase 4A)
Verifies Ethereum Sepolia Testnet Web3 connection, Chain ID, and Wallet Balance.
"""

import sys
import os

# Add backend directory to python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services.blockchain_service import (
    get_blockchain_diagnostics,
    get_blockchain_config
)


def run_test():
    print("=" * 60)
    print(" SecureVault 2.0 - Blockchain Environment Diagnostic (Phase 4A)")
    print("=" * 60)

    config = get_blockchain_config()
    print(f"Target Network         : Ethereum Sepolia Testnet")
    print(f"Target Chain ID        : {config['chain_id']}")

    if not config["rpc_url"]:
        print("\n[WARNING] BLOCKCHAIN_RPC_URL is not configured in .env.")
        print("Please configure BLOCKCHAIN_RPC_URL (e.g., Alchemy Sepolia RPC URL).")
        print("=" * 60)
        return

    diag = get_blockchain_diagnostics()

    print(f"Web3 connected         : {'YES' if diag['connected'] else 'NO'}")
    print(f"Detected Chain ID      : {diag['detected_chain_id']} (Matches expected: {diag['chain_id_matches']})")
    print(f"Wallet configured      : {'YES' if diag['wallet_configured'] else 'NO'}")
    print(f"Wallet address         : {diag['wallet_address'] or 'N/A'}")

    if diag['balance_eth'] is not None:
        print(f"Wallet balance         : {diag['balance_eth']:.6f} Sepolia ETH")
    else:
        print(f"Wallet balance         : N/A")

    if diag["error"]:
        print(f"\n[ERROR] {diag['error']}")
    else:
        print("\n[SUCCESS] Blockchain environment is properly configured and reachable.")

    print("=" * 60)


if __name__ == "__main__":
    run_test()
