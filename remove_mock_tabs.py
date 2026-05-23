import re

file_path = 'hospyn-v2-web/src/App.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

tabs_to_remove = ['branch-manager', 'ehr', 'lab', 'pharmacy', 'opd', 'ai-governance', 'settings']
for tab in tabs_to_remove:
    pattern = f"{{consoleTab === '{tab}' && ("
    start_idx = content.find(pattern)
    if start_idx != -1:
        paren_count = 0
        brace_count = 0
        i = start_idx
        while i < len(content):
            if content[i] == '{': brace_count += 1
            elif content[i] == '}': brace_count -= 1
            elif content[i] == '(': paren_count += 1
            elif content[i] == ')': paren_count -= 1
            
            i += 1
            if paren_count == 0 and brace_count == 0 and i > start_idx + len(pattern):
                end_idx = i
                content = content[:start_idx] + content[end_idx:]
                break

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Successfully removed mock tabs from Gateway')
