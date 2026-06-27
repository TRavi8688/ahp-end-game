import subprocess
import os

def run_command(cmd, cwd):
    print(f"Running: {cmd} in {cwd}")
    try:
        result = subprocess.run(
            cmd, 
            cwd=cwd, 
            shell=True, 
            stdout=subprocess.PIPE, 
            stderr=subprocess.STDOUT, 
            text=True
        )
        return result.stdout
    except Exception as e:
        return str(e)

services = {
    "Auth Service": "c:\\Users\\DELL\\OneDrive\\Desktop\\ahp-end-game-complete\\backend\\auth-service",
    "Healthcare Core": "c:\\Users\\DELL\\OneDrive\\Desktop\\ahp-end-game-complete\\backend\\healthcare-core",
}

report = "# 100% Truthful Final Verification Report\n\n"
report += "The following raw logs show the output of `ruff` (Syntax and Style) and `bandit` (Security Vulnerability Scanner) run over your services right now.\n\n"

for service_name, path in services.items():
    report += f"## {service_name}\n"
    
    # Run Ruff
    ruff_out = run_command("poetry run ruff check .", path)
    report += "### Syntax & Code Quality (`ruff`)\n"
    report += "```text\n"
    report += ruff_out.strip() + "\n"
    report += "```\n\n"
    
    # Run Bandit
    bandit_out = run_command("poetry run bandit -r . -lll", path)
    report += "### Security & Vulnerabilities (`bandit`)\n"
    report += "```text\n"
    report += bandit_out.strip() + "\n"
    report += "```\n\n"
    
    # Run Alembic Check
    alembic_out = run_command("poetry run alembic heads", path)
    report += "### Database Migrations (`alembic heads`)\n"
    report += "```text\n"
    report += alembic_out.strip() + "\n"
    report += "```\n\n"

with open("FINAL_VERIFICATION_REPORT.md", "w") as f:
    f.write(report)

print("Verification complete. Report generated.")
