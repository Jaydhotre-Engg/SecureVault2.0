import os
import sys
import shutil
import sqlite3

# Add the current directory to sys.path so we can import app modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services.encryption_service import encrypt_data, decrypt_data

DB_PATH = "securevault.db"
EVIDENCE_ID = 7

def get_storage_path():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT storage_path FROM evidence WHERE id = ?", (EVIDENCE_ID,))
    row = cur.fetchone()
    conn.close()
    if not row:
        print(f"[-] Evidence ID {EVIDENCE_ID} not found in database.")
        sys.exit(1)
    return row[0]

def tamper():
    print("=== STARTING TAMPER PHASE ===")
    storage_path = get_storage_path()
    backup_path = storage_path + ".tamper_backup"
    
    print(f"[*] Found storage path: {storage_path}")
    
    # 1. Backup
    if not os.path.exists(backup_path):
        shutil.copy2(storage_path, backup_path)
        print(f"[+] Backup created safely at: {backup_path}")
    else:
        print("[*] Backup already exists.")

    # 2. Read and Decrypt
    with open(storage_path, "rb") as f:
        encrypted_data = f.read()
    
    plaintext = decrypt_data(encrypted_data)
    print(f"[+] Successfully decrypted using existing Fernet service. Size: {len(plaintext)} bytes.")
    
    # 3. Deterministic Tamper
    tampered_plaintext = plaintext + b"\n--- SIGNATURE_TAMPER_TEST ---"
    
    # 4. Re-Encrypt
    tampered_encrypted_data = encrypt_data(tampered_plaintext)
    
    # 5. Overwrite
    with open(storage_path, "wb") as f:
        f.write(tampered_encrypted_data)
    print(f"[+] Tampered data encrypted and written back to {storage_path}.")
    print("=== TAMPER PHASE COMPLETE ===\n")
    print("-> GO TO YOUR FRONTEND NOW AND CLICK 'VERIFY' ON EVIDENCE #7 <-")
    print("-> YOU SHOULD SEE 'TAMPERED' AND TWO DIFFERENT HASHES <-")

def restore():
    print("=== STARTING RESTORATION PHASE ===")
    storage_path = get_storage_path()
    backup_path = storage_path + ".tamper_backup"
    
    if not os.path.exists(backup_path):
        print("[-] No backup file found. Nothing to restore.")
        sys.exit(1)
        
    # 1. Restore the file
    shutil.copy2(backup_path, storage_path)
    print(f"[+] Ciphertext perfectly restored from {backup_path}")
    
    # 2. Clean up backup
    os.remove(backup_path)
    print("[+] Temporary backup file deleted.")
    print("=== RESTORATION PHASE COMPLETE ===\n")
    print("-> GO TO YOUR FRONTEND NOW AND CLICK 'VERIFY'. IT WILL BE VALID AGAIN <-")

if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in ["tamper", "restore"]:
        print("Usage: python controlled_tamper_test.py [tamper|restore]")
        sys.exit(1)
        
    if sys.argv[1] == "tamper":
        tamper()
    elif sys.argv[1] == "restore":
        restore()
