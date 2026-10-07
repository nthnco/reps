"""Print an argon2 hash to paste into APP_PASSWORD_HASH.

Usage (from backend/): uv run python -m app.hash_password
"""

from getpass import getpass

from app.auth import password_hash

if __name__ == "__main__":
    password = getpass("Password: ")
    if password != getpass("Again: "):
        raise SystemExit("Passwords don't match.")
    print(password_hash.hash(password))
