"""
SecureVault — Initial ADMIN Bootstrap

Run from the backend directory:
    python -m app.utils.create_admin

This script creates the initial ADMIN user via interactive CLI prompts.
It requires direct shell access to the server and is never exposed via HTTP.

Safety:
    - Checks if an ADMIN already exists before creating one.
    - Refuses to overwrite or modify an existing ADMIN.
    - Passwords are never printed or logged.
"""

import sys
import getpass

from sqlalchemy.orm import Session

from app.database import engine, Base
from app.models.user import User


def main():
    # Ensure all tables exist
    Base.metadata.create_all(bind=engine)

    session = Session(bind=engine)

    try:
        # Check if an ADMIN already exists
        existing_admin = session.query(User).filter(
            User.role == "ADMIN"
        ).first()

        if existing_admin:
            print(f"\nAn ADMIN user already exists: {existing_admin.username}")
            print("Only one ADMIN can be created via this bootstrap script.")
            print("Use the application API to manage additional users.")
            sys.exit(0)

        print("\n=== SecureVault — Create Initial ADMIN ===\n")

        # Collect username
        username = input("Username: ").strip()
        if not username or len(username) < 3:
            print("Error: Username must be at least 3 characters.")
            sys.exit(1)

        # Check if username is taken
        if session.query(User).filter(User.username == username).first():
            print(f"Error: Username '{username}' is already taken.")
            sys.exit(1)

        # Collect email
        email = input("Email: ").strip()
        if not email or "@" not in email:
            print("Error: A valid email address is required.")
            sys.exit(1)

        # Check if email is taken
        if session.query(User).filter(User.email == email).first():
            print("Error: This email is already registered.")
            sys.exit(1)

        # Collect password (hidden input)
        password = getpass.getpass("Password: ")
        if len(password) < 8:
            print("Error: Password must be at least 8 characters.")
            sys.exit(1)

        password_confirm = getpass.getpass("Confirm password: ")
        if password != password_confirm:
            print("Error: Passwords do not match.")
            sys.exit(1)

        # Hash password with bcrypt
        try:
            import bcrypt
        except ImportError:
            print("Error: bcrypt is not installed.")
            print("Install it with: pip install bcrypt")
            sys.exit(1)

        password_hash = bcrypt.hashpw(
            password.encode("utf-8"),
            bcrypt.gensalt(rounds=12)
        ).decode("utf-8")

        # Clear password from memory
        password = None
        password_confirm = None

        # Create ADMIN user
        admin = User(
            username=username,
            email=email,
            password_hash=password_hash,
            role="ADMIN",
            is_active=True
        )

        session.add(admin)
        session.commit()

        print(f"\nADMIN user '{username}' created successfully.")
        print("You can now log in via the API.")

    except KeyboardInterrupt:
        print("\n\nAborted.")
        sys.exit(1)

    finally:
        session.close()


if __name__ == "__main__":
    main()
