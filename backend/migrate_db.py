import sqlite3

def migrate():
    db_path = "securevault.db"
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    # Check if cases table exists
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='cases'")
    if not cur.fetchone():
        print("Creating 'cases' table...")
        cur.execute("""
        CREATE TABLE cases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            case_number VARCHAR(50) UNIQUE NOT NULL,
            case_name VARCHAR(200) NOT NULL,
            description TEXT,
            status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
            created_by INTEGER NOT NULL REFERENCES users(id),
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """)
        
    # Check if case_id exists in evidence table
    cur.execute("PRAGMA table_info(evidence)")
    columns = [col[1] for col in cur.fetchall()]
    
    if "case_id" not in columns:
        print("Adding 'case_id' column to 'evidence' table...")
        cur.execute("ALTER TABLE evidence ADD COLUMN case_id INTEGER REFERENCES cases(id)")
    else:
        print("'case_id' already exists in 'evidence' table.")
        
    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    migrate()
