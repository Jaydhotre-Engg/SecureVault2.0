# SecureVault 2.0

A secure digital evidence management system utilizing multi-layer cryptographic verification, decentralized storage, and Ethereum blockchain anchoring to ensure forensic data integrity.

## Overview

In digital forensics, preserving the integrity and provenance of evidence from collection to courtroom is critical. SecureVault 2.0 solves this by providing a unified platform for secure storage, strictly controlled access, comprehensive auditability, and tamper-evident Chain of Custody tracking. By integrating IPFS for decentralized encrypted storage and the Ethereum Sepolia Testnet for immutable anchoring, the system guarantees that evidence metadata cannot be covertly altered.

## Key Features

* **User Authentication and RBAC:** Secure login with strictly enforced `ADMIN` and `INVESTIGATOR` roles.
* **Case Management:** Organize and restrict access to forensic evidence on a per-case basis.
* **Evidence Management:** Upload, encrypt, and manage sensitive forensic artifacts.
* **Integrity Validation:** SHA-256 hashing applied to original evidence to instantly detect tampering.
* **Encryption at Rest:** Symmetric Fernet encryption applied before the file leaves memory. 
* **Decentralized Storage:** Encrypted evidence is securely distributed via IPFS/Pinata.
* **Chain of Custody:** Hash-linked, tamper-evident logs for registration, access, and verification events.
* **Comprehensive Audit Logging:** System-wide recording of all user actions and authentications.
* **Blockchain Anchoring:** Cryptographic metadata proofs committed to a Solidity Smart Contract on Ethereum Sepolia.
* **Unified Verification Workflow:** One-click validation analyzing file integrity, IPFS hashes, custody chains, and blockchain proofs simultaneously.

## System Architecture

SecureVault 2.0 separates the storage of the physical encrypted artifact from the immutable proof of its existence. Raw evidence is heavily encrypted and moved to IPFS, while only non-sensitive cryptographic hashes are sent to the blockchain.

```text
                     SECUREVAULT 2.0
                           │
             ┌─────────────┼─────────────┐
             │             │             │
      Authentication   Case Mgmt       Users
             │             │             │
             └─────────────┤             │
                           ▼             │
                       EVIDENCE ◄────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
           SHA-256      Encryption    Metadata
              │         (Fernet)        │
              │            │            │
              └──────┬─────┘            │
                     ▼                  │
             Encrypted Artifact         │
                     │                  │
                     ▼                  │
               PINATA / IPFS            │
                     │                  │
                     ▼                  │
                    CID ────────────────┘
                     │
                     ▼
             CHAIN OF CUSTODY
                     │
                     ▼
               Event Hashes
                     │
                     ▼
                BLOCKCHAIN
                     │
                     ▼
             IMMUTABLE ANCHOR
                     │
                     ▼
               VERIFICATION
```

*Note: IPFS is used as the primary remote storage layer for the encrypted artifacts. Local database storage retains metadata and relational structures.*

## Technology Stack

| Layer                  | Technology                                     |
| ---------------------- | ---------------------------------------------- |
| **Frontend**           | React, TypeScript, Vite, Tailwind CSS          |
| **Backend**            | FastAPI, Python, SQLAlchemy, Web3.py           |
| **Database**           | SQLite                                         |
| **Authentication**     | JWT (JSON Web Tokens), bcrypt                  |
| **Encryption**         | Cryptography (Fernet symmetric encryption)     |
| **Integrity Checks**   | SHA-256                                        |
| **Storage**            | IPFS, Pinata                                   |
| **Blockchain**         | Ethereum (Sepolia Testnet)                     |
| **Smart Contracts**    | Solidity, EvidenceRegistry Contract            |

## Security Model

Security is baked into the application life-cycle. Please note this is an academic/project implementation and requires further compliance certification for production forensic deployment.

* **Authentication:** Credentials verified via constant-time bcrypt hashing.
* **Authorization:** JWT-based stateless sessions enforcing restrictive investigator scopes. 
* **Encryption at Rest:** AES-based continuous encryption (Fernet) ensures artifacts on IPFS are completely unintelligible without the backend's master key.
* **Tamper Detection:** Post-decryption hashes are strictly compared against the initial upload SHA-256 digest.
* **Audit Trails:** Immutable database logging of all system interactions (logins, evidence access, authorization failures).

## Evidence Verification

The system features a **Unified Verification Workflow** that executes four simultaneous integrity checks:
1. **File Integrity:** Retrieves the encrypted IPFS artifact, decrypts it, and recalculates its SHA-256 hash.
2. **Storage Integrity:** Confirms the active IPFS CID matches the database record.
3. **Chain of Custody:** Evaluates the continuous cryptographic links in the case's event timeline.
4. **Blockchain Proof:** Queries the Ethereum Sepolia smart contract to verify the `Evidence ID`, `SHA-256 Hash`, `IPFS CID`, and initial `Custody Hash` exactly match the anchored transaction.

```text
               VERIFY EVIDENCE
                      │
      ┌───────────────┼────────────────┐
      ↓               ↓                ↓
   IPFS           SHA-256         Custody Chain
      │               │                │
      └───────────────┼────────────────┘
                      ↓
                Blockchain
               verification
                      │
                      ↓
            ┌──────────────────┐
            │ FULLY VERIFIED   │
            └──────────────────┘
```

## Chain of Custody

Every interaction with an evidence file generates a distinct custody event. Events include `REGISTERED`, `ACCESSED`, `VERIFIED`, `INTEGRITY_FAILED`, and `TRANSFERRED`. Each event is cryptographically linked to the preceding event, establishing an unbroken and unforgeable timeline of possession and interaction.

## Blockchain Integration

The backend connects to the **Ethereum Sepolia Testnet** via an external RPC node. 
Upon evidence registration, the system anchors a mathematical proof calling the `EvidenceRegistry` smart contract.

**Anchored Metadata Includes:**
* Internal Evidence ID
* SHA-256 Evidence Hash
* IPFS CID
* Chain of Custody Starting Hash
* Blockchain Timestamp

```text
Current SecureVault Evidence
             │
       ┌─────┼─────┐
       │     │     │
       ▼     ▼     ▼
      SHA    CID   Custody
       │     │     │
       └─────┼─────┘
             │
             ▼
       Ethereum Sepolia
             │
             ▼
      On-Chain Evidence
             │
             ▼
        Field Comparison
             │
             ▼
       Verification Result
```

**Excluded from Blockchain:** Private keys, encryption keys, JWT secrets, passwords, and raw evidence content.

---

## Project Structure

```text
SecureVault/
├── backend/
│   ├── app/
│   │   ├── dependencies/
│   │   ├── models/
│   │   ├── routers/
│   │   ├── schemas/
│   │   ├── services/
│   │   └── main.py
│   ├── blockchain/
│   │   ├── build/
│   │   └── contracts/
│   ├── requirements.txt
│   └── test_*.py
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── context/
│   │   └── pages/
│   ├── package.json
│   └── vite.config.ts
├── LICENSE
└── .gitignore
```

---

## Installation

### 1. Clone Repository
```bash
git clone https://github.com/<your-username>/SecureVault.git
cd SecureVault
```

### 2. Backend Setup (Python/FastAPI)
```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate  # On Windows PowerShell: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 3. Environment Configuration
Create a `.env` file in the `backend/` directory based on the following placeholders. **Never commit this file.**

```env
# backend/.env

# Security
SECRET_KEY=your_secure_jwt_key_here
ACCESS_TOKEN_EXPIRE_MINUTES=60
MASTER_ENCRYPTION_KEY=your_fernet_encryption_key_here

# IPFS Storage
PINATA_JWT=your_pinata_jwt_here

# Blockchain Configurations (Ethereum Sepolia)
BLOCKCHAIN_RPC_URL=your_rpc_node_url_here
BLOCKCHAIN_CHAIN_ID=11155111
BLOCKCHAIN_PRIVATE_KEY=your_wallet_private_key_here
BLOCKCHAIN_CONTRACT_ADDRESS=your_deployed_contract_address_here
```
*(Development Note: Default administrator credentials must be configured manually via the database or backend setup scripts during initial deployment.)*

### 4. Frontend Setup (React/Vite)
Open a new terminal window:
```bash
cd frontend
npm install
```

---

## Running the Project

**Start the Backend Validation API:**
```bash
cd backend
# Ensure virtual environment is active
python -m uvicorn app.main:app --reload
```

**Start the Frontend UI:**
```bash
cd frontend
npm run dev
```
The application will be accessible at `http://localhost:5173`.

---

## Testing

A suite of verification and integration tests are positioned within the `backend/` directory. Run them using pytest or standard Python execution to validate multi-layer integrations:

```bash
cd backend
python test_full_auth_module.py
python test_phase_4c_integration.py
python test_phase_5_unified_verification.py
```

---

## Security Notes

**WARNING FOR CONTRIBUTORS AND USERS:**
* **Never commit `.env` files.** 
* **Never publish API keys**, Pinata JWTs, RPC node credentials, or database files to public repositories.
* **Never expose your Ethereum Wallet Private Key.** 
* **Never commit the local SQLite database.** Forensic metadata must remain confidential.
* The `.gitignore` is strictly configured to prevent the accidental upload of `securevault.db`, `.env`, and local `storage/` repositories. Maintain these ignores.

---

## License

This project is released under the **Apache License 2.0**. See the `LICENSE` file for full terms and conditions.
