import sys
import os
from pathlib import Path
from dotenv import load_dotenv
from web3 import Web3

# Add backend to sys.path
sys.path.append("D:/Pro_Projects/SecureVault2.0/SecureVault/backend")
load_dotenv("D:/Pro_Projects/SecureVault2.0/SecureVault/.env")

from app.services.blockchain_service import get_blockchain_diagnostics, get_web3_provider, get_contract_instance

def run_diagnostic():
    print("--- Running Full Blockchain Diagnostic ---")
    diag = get_blockchain_diagnostics()
    for k, v in diag.items():
        print(f"{k}: {v}")

    # Check contract code
    if diag.get("contract_address"):
        try:
            w3 = get_web3_provider()
            code = w3.eth.get_code(Web3.to_checksum_address(diag["contract_address"]))
            print(f"Contract bytecode: {code.hex()[:50]}...")
            if code.hex() == "0x":
                print("CRITICAL: Contract is NOT deployed at this address.")
            else:
                print("Contract deployed at address.")
        except Exception as e:
            print(f"Error checking contract: {e}")

if __name__ == "__main__":
    run_diagnostic()
