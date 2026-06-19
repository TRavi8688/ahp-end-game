import os, re

d = r'c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\alembic\versions'

results = []
for f in sorted(os.listdir(d)):
    if not f.endswith('.py') or f == '__init__.py':
        continue
    path = os.path.join(d, f)
    content = open(path, encoding='utf-8', errors='replace').read()
    
    # Match both: revision = '...' and revision: str = '...'
    m_rev = re.search(r'''revision(?:\s*:\s*str)?\s*=\s*['"]([^'"]+)['"]''', content)
    m_down = re.search(r'''down_revision(?:\s*:\s*[^=]+)?\s*=\s*['"]([^'"]+)['"]''', content)
    m_none = re.search(r'''down_revision(?:\s*:\s*[^=]+)?\s*=\s*None''', content)
    
    rev = m_rev.group(1) if m_rev else '??'
    down = m_down.group(1) if m_down else ('None' if m_none else '??')
    
    results.append((f, rev, down))

# Print table
print(f"{'File':<60} {'revision':<35} {'down_revision':<35}")
print("-" * 130)
for f, rev, down in results:
    print(f"{f:<60} {rev:<35} {down:<35}")

# Build graph and find issues
rev_to_file = {rev: f for f, rev, _ in results}
print("\n\n=== CHAIN ISSUES ===")
for f, rev, down in results:
    if down != 'None' and down not in rev_to_file:
        print(f"BROKEN: {f} references down_revision='{down}' which does NOT exist!")

# Find forks (multiple children from the same parent)
from collections import Counter
down_counts = Counter(down for _, _, down in results if down != 'None')
for parent, count in down_counts.items():
    if count > 1:
        children = [f for f, _, d in results if d == parent]
        print(f"FORK: '{parent}' has {count} children: {children}")

# Find multiple roots
roots = [(f, rev) for f, rev, down in results if down == 'None']
print(f"\nROOT NODES ({len(roots)}):")
for f, rev in roots:
    print(f"  {f} (rev={rev})")

# Find heads (revisions not referenced by anyone else as down_revision)
all_downs = {down for _, _, down in results if down != 'None'}
heads = [(f, rev) for f, rev, _ in results if rev not in all_downs]
print(f"\nHEAD NODES ({len(heads)}):")
for f, rev in heads:
    print(f"  {f} (rev={rev})")

# Print the full chain starting from root
print("\n\n=== FULL CHAIN (from root) ===")
down_to_children = {}
for f, rev, down in results:
    down_to_children.setdefault(down, []).append((f, rev))

def walk(parent_rev, depth=0):
    children = down_to_children.get(parent_rev, [])
    for f, rev in children:
        print(f"{'  ' * depth}{rev} ({f})")
        walk(rev, depth + 1)

walk('None')
