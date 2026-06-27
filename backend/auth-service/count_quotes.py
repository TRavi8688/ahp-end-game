"""Count and locate all triple-quote occurrences."""
import re

content = open("app/api/v1/auth.py", encoding="utf-8").read()
count = content.count('"""')
print(f"Triple-quote count: {count} (should be even: {'YES' if count % 2 == 0 else 'NO -- PROBLEM!'})")

for m in re.finditer('"""', content):
    lineno = content[:m.start()].count('\n') + 1
    print(f"  Line {lineno}")
