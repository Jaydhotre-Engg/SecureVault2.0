import sqlite3

def migrate():
    db_path = "securevault.db"
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    cur.execute("PRAGMA table_info(evidence)")
    columns = [col[1] for col in cur.fetchall()]
    
    if "ipfs_cid" not in columns:
        print("Adding 'ipfs_cid' column to 'evidence' table...")
        cur.execute("ALTER TABLE evidence ADD COLUMN ipfs_cid VARCHAR")
    else:
        print("'ipfs_cid' already exists.")
        
    conn.commit()
    conn.close()
    print("Migration 2A complete.")

if __name__ == "__main__":
    migrate()
