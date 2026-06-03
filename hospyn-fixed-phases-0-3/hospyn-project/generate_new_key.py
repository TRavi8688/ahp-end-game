#!/usr/bin/env python3
"""
generate_new_key.py — Hospyn Fernet key rotation helper.

USAGE:
    python generate_new_key.py

WHAT IT DOES:
    1. Generates a new Fernet key.
    2. Prints the key to stdout so you can copy it into your secrets manager.
    3. Does NOT write the key to disk. Never store keys in files.

AFTER RUNNING:
    1. Set FERNET_KEY=<new key> in your secrets manager (AWS Secrets Manager,
       GCP Secret Manager, or GitHub Actions secrets).
    2. Update the running .env on the server: FERNET_KEY=<new key>
    3. Re-encrypt any data encrypted with the old key before removing the old key.
    4. Remove enc.key from git history (see POST-FIX GIT COMMANDS in the audit report).

DO NOT:
    - Commit this script's output to version control.
    - Store the key in any file in this repository.
    - Use the old key CUV3WDeZXcp_7F74LyTqqIDmgDqn5-xbqKvDzEikdUs= — it is COMPROMISED.
"""

import sys

try:
    from cryptography.fernet import Fernet
except ImportError:
    print("ERROR: cryptography package not installed.", file=sys.stderr)
    print("Run: pip install cryptography", file=sys.stderr)
    sys.exit(1)


def main() -> None:
    new_key = Fernet.generate_key().decode()

    print()
    print("=" * 64)
    print("NEW FERNET KEY (copy this to your secrets manager NOW):")
    print("=" * 64)
    print(new_key)
    print("=" * 64)
    print()
    print("NEXT STEPS:")
    print("  1. Set FERNET_KEY in your secrets manager / production .env")
    print("  2. Re-encrypt existing PHI data with the new key")
    print("  3. Remove enc.key from git history:")
    print("     git filter-repo --path enc.key --invert-paths")
    print("     git push --force --all")
    print("  4. Rotate GitHub repository secrets if FERNET_KEY was stored there")
    print()
    print("WARNING: The old key CUV3WDeZXcp_7F74LyTqqIDmgDqn5-xbqKvDzEikdUs=")
    print("         is COMPROMISED. Any data encrypted with it must be")
    print("         considered exposed.")
    print()


if __name__ == "__main__":
    main()
