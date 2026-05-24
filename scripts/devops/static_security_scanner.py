import os
import sys
import re

# Enterprise DevSecOps Static Security Scanner (Windows-compatible ASCII)
# Designed to run in pre-commit hooks or GitHub Actions / CI pipelines.
# Blocks insecure bypass code patterns, hardcoded credentials/numbers, and non-compliant CORS.

BLOCKED_PATTERNS = {
    # Pattern Description: (compiled regex, list of files/folders to ignore)
    "Hardcoded OTP/Phone bypass pattern": (
        re.compile(r"8688533605"),
        ["scripts/devops/static_security_scanner.py", "scripts/check_historical_abuse.py", "task.md", "implementation_plan.md"]
    ),
    "Insecure sandbox mock auth check": (
        re.compile(r"sandbox_mock_"),
        ["scripts/devops/static_security_scanner.py", "scripts/check_historical_abuse.py", "app/api/auth.py", "task.md", "implementation_plan.md"]
    ),
    "Permissive wildcard origin regex pattern in production CORS": (
        re.compile(r"allow_origin_regex\s*=\s*['\"].*\*['\"]"),
        ["scripts/devops/static_security_scanner.py"]
    ),
    "Leak-prone websocket JWT token path": (
        re.compile(r"@app\.websocket\(['\"]/ws/\{token\}['\"]\)|@app\.websocket\(['\"]/api/v1/ws/\{token\}['\"]\)|WS_BASE_URL.*ws/\$\{latestToken\}"),
        ["scripts/devops/static_security_scanner.py"]
    )
}

IGNORE_DIRS = [
    ".git",
    "__pycache__",
    "node_modules",
    "venv",
    ".expo",
    "build",
    "dist",
    "maintenance_archive",
    ".github"
]

def scan_file(filepath):
    """Scans a single file against blocked security patterns."""
    violations = []
    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()
            for line_idx, line in enumerate(lines, 1):
                for pattern_name, (regex, ignore_list) in BLOCKED_PATTERNS.items():
                    # Check if the file itself is in the ignore list for this pattern
                    normalized_path = filepath.replace("\\", "/")
                    if any(ignored in normalized_path for ignored in ignore_list):
                        continue
                        
                    if regex.search(line):
                        violations.append({
                            "pattern": pattern_name,
                            "line": line_idx,
                            "content": line.strip()
                        })
    except Exception as e:
        # Silently skip unreadable files (e.g. binaries)
        pass
    return violations

def run_scanner():
    print("[Hospyn DevSecOps Static Security Scanner]")
    print("Scanning codebase for production-blocking vulnerabilities & credentials...")
    
    total_violations = 0
    scanned_files = 0
    
    for root, dirs, files in os.walk("."):
        # Prune ignored directories in-place
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        
        for file in files:
            filepath = os.path.join(root, file)
            # Scan only python, javascript, json, or configuration files
            if file.endswith((".py", ".js", ".ts", ".tsx", ".env", ".example", ".yml", ".yaml")):
                scanned_files += 1
                violations = scan_file(filepath)
                if violations:
                    print(f"\nSECURITY VIOLATION in: {filepath}")
                    for v in violations:
                        print(f"   Line {v['line']}: [{v['pattern']}] -> '{v['content']}'")
                        total_violations += len(violations)

    print("\n" + "="*60)
    print(f"Scan complete. Scanned {scanned_files} files.")
    if total_violations > 0:
        print(f"FAILED: Found {total_violations} production-blocking security violations!")
        print("Please resolve these vulnerabilities before committing or deploying.")
        sys.exit(1)
    else:
        print("PASSED: No production-blocking bypasses or credentials found in the scanned files.")
        sys.exit(0)

if __name__ == "__main__":
    run_scanner()
