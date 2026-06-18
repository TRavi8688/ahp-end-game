#!/usr/bin/env bash
# verify_migrations.sh
# Verifies the root Alembic migration chain is linear (no branches/orphans)
# and that all new migrations are syntactically valid Python.
# Usage: bash verify_migrations.sh [/path/to/alembic/versions]
# Exit codes: 0 = all good, 1 = problems found

set -euo pipefail

VERSIONS_DIR="${1:-alembic/versions}"
PASS=0
FAIL=1
status=$PASS

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()   { echo -e "  ${GREEN}✓${NC}  $*"; }
warn() { echo -e "  ${YELLOW}!${NC}  $*"; }
err()  { echo -e "  ${RED}✗${NC}  $*"; status=$FAIL; }

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Hospyn Migration Chain Verifier"
echo "  Scanning: $VERSIONS_DIR"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 1. Python syntax check on every migration file ──────────────────────────
echo ""
echo "▶ Step 1: Syntax check all migration files"
syntax_errors=0
for f in "$VERSIONS_DIR"/*.py; do
    [[ "$(basename "$f")" == "__"* ]] && continue
    if python3 -m py_compile "$f" 2>/dev/null; then
        ok "$(basename "$f")"
    else
        err "Syntax error in $(basename "$f")"
        python3 -m py_compile "$f"  # print error
        syntax_errors=$((syntax_errors + 1))
    fi
done
[[ $syntax_errors -eq 0 ]] && ok "All files pass syntax check" || err "$syntax_errors file(s) failed syntax check"

# ── 2. Parse revision graph ──────────────────────────────────────────────────
echo ""
echo "▶ Step 2: Parse revision graph"

python3 - "$VERSIONS_DIR" <<'PYEOF'
import sys, os, re

versions_dir = sys.argv[1]
revs = {}       # revision_id -> down_revision (str | tuple | None)
filemap = {}    # revision_id -> filename

for fname in os.listdir(versions_dir):
    if not fname.endswith('.py') or fname.startswith('_'):
        continue
    path = os.path.join(versions_dir, fname)
    text = open(path).read()

    rev_m = re.search(r'^revision\s*=\s*["\']([^"\']+)["\']', text, re.MULTILINE)
    if not rev_m:
        continue
    rev_id = rev_m.group(1)

    down_m = re.search(r'^down_revision\s*=\s*(.*)', text, re.MULTILINE)
    down_raw = down_m.group(1).strip() if down_m else 'None'

    if down_raw == 'None':
        down = None
    elif down_raw.startswith('('):
        # Merge migration: tuple of revision ids
        ids = re.findall(r'["\']([^"\']+)["\']', down_raw)
        down = tuple(ids)
    else:
        single = re.search(r'["\']([^"\']+)["\']', down_raw)
        down = single.group(1) if single else None

    revs[rev_id] = down
    filemap[rev_id] = fname

if not revs:
    print("  ✗  No migration files found — check the path.")
    sys.exit(1)

# Build sets
all_revs = set(revs.keys())

# Collect all referenced down_revisions (flatten tuples)
all_downs = set()
for v in revs.values():
    if v is None:
        continue
    if isinstance(v, tuple):
        all_downs.update(v)
    else:
        all_downs.add(v)

# Heads = revisions that are NOT referenced as a down_revision
heads = all_revs - all_downs

# Orphaned references = down_revisions that don't exist in our files
orphans = all_downs - all_revs

# Roots = revisions with down_revision = None
roots = {r for r, d in revs.items() if d is None}

# Branches = revisions referenced as down_revision by MORE than one file
from collections import Counter
down_counter = Counter()
for v in revs.values():
    if v is None: continue
    if isinstance(v, tuple):
        for x in v: down_counter[x] += 1
    else:
        down_counter[v] += 1

branch_points = {r for r, c in down_counter.items() if c > 1}

print(f"\n  Revisions found : {len(revs)}")
print(f"  Root(s)         : {roots}")
print(f"  Head(s)         : {heads}")

if len(roots) == 1:
    print("  ✓  Single root — OK")
else:
    print(f"  ✗  Multiple roots detected: {roots}")

if len(heads) == 1:
    print(f"  ✓  Single head — OK ({next(iter(heads))})")
else:
    print(f"  ✗  Multiple heads (BRANCH) detected: {heads}")
    print("     Fix: run  alembic merge -m 'merge heads' <rev_a> <rev_b>")

if orphans:
    print(f"  ✗  Orphaned down_revision references: {orphans}")
    print("     These revisions are referenced but files are missing.")
else:
    print("  ✓  No orphaned references — OK")

if branch_points:
    print(f"  ✗  Branch points detected (same down_revision in multiple files): {branch_points}")
    for bp in branch_points:
        culprits = [filemap.get(r, r) for r, d in revs.items()
                    if (d == bp or (isinstance(d, tuple) and bp in d))]
        print(f"     → '{bp}' is referenced by: {culprits}")
else:
    print("  ✓  No branch points — OK")

# Print chain
print("\n  Full chain (linear):")
# Walk from root to head
chain = []
current = next(iter(roots))
visited = set()
while current and current not in visited:
    visited.add(current)
    chain.append(current)
    # find what has this as down_revision
    nxt = None
    for r, d in revs.items():
        if d == current and r not in visited:
            nxt = r
            break
    current = nxt

for i, rev in enumerate(chain):
    prefix = "  " + ("└→ " if i > 0 else "   ")
    suffix = " ← HEAD" if rev in heads else (" ← ROOT" if rev in roots else "")
    print(f"{prefix}{rev}  ({filemap.get(rev,'?')}){suffix}")

problems = (len(heads) != 1) or bool(orphans) or bool(branch_points) or (len(roots) != 1)
sys.exit(1 if problems else 0)
PYEOF

py_exit=$?
if [[ $py_exit -ne 0 ]]; then
    status=$FAIL
fi

# ── 3. Alembic heads check (requires live DB / alembic.ini) ─────────────────
echo ""
echo "▶ Step 3: Alembic heads check (requires alembic.ini + DB)"
if command -v alembic &>/dev/null && [[ -f alembic.ini ]]; then
    head_count=$(alembic heads 2>/dev/null | grep -c '(head)' || true)
    if [[ "$head_count" -eq 1 ]]; then
        ok "alembic heads reports exactly 1 head"
    else
        err "alembic heads reports $head_count heads — branch exists!"
        alembic heads
    fi

    if alembic check 2>/dev/null; then
        ok "alembic check passed (schema matches migrations)"
    else
        warn "alembic check failed — schema drift or no DB connection"
    fi
else
    warn "alembic not available or alembic.ini missing — skipping live DB checks"
fi

# ── 4. Check for stray migration files outside versions/ ─────────────────────
echo ""
echo "▶ Step 4: Check for stray migration files in alembic/ root"
stray=0
for f in alembic/*.py; do
    [[ -f "$f" ]] || continue
    [[ "$(basename "$f")" == "env.py" ]] && continue
    warn "Stray migration file outside versions/: $f"
    stray=$((stray + 1))
done
if [[ $stray -eq 0 ]]; then
    ok "No stray migration files in alembic/ root"
else
    err "$stray stray file(s) found — move them into alembic/versions/ or delete"
fi

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [[ $status -eq 0 ]]; then
    echo -e "  ${GREEN}ALL CHECKS PASSED${NC} — migration chain is healthy"
else
    echo -e "  ${RED}PROBLEMS DETECTED${NC} — see errors above before deploying"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
exit $status
