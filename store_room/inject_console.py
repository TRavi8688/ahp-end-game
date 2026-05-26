import os

file_path = "hospyn-v2-web/src/App.jsx"

with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

new_content = []
i = 0
in_approved_block = False
while i < len(lines):
    line = lines[i]
    
    # Also inject the import at the top
    if line.startswith("import") and "SovereignConsole" not in "".join(new_content) and i > 5 and lines[i-1].startswith("import"):
        new_content.append("import SovereignConsole from './components/SovereignConsole';\n")
        new_content.append(line)
        i += 1
        continue
        
    if "{appStatus === 'approved' && (" in line and not in_approved_block and i > 1000 and i < 1100:
        in_approved_block = True
        new_content.append(line)
        new_content.append("""        <SovereignConsole onLogout={() => { 
          setAppStatus('unregistered'); 
          localStorage.removeItem('hospyn_owner_token'); 
        }} />\n""")
        
        # Skip until the end of the block
        j = i + 1
        while j < len(lines):
            # We know from earlier that the old mock dashboard ends at 1932. The line is "      )}\n"
            if "      )}\n" == lines[j] and j > 1900:
                i = j
                break
            j += 1
            
    elif in_approved_block and "SovereignConsole" in line:
        # We might have injected something accidentally at line 1644 earlier, ignore it if we are skipping
        pass
    else:
        new_content.append(line)
        
    i += 1

with open(file_path, "w", encoding="utf-8") as f:
    f.writelines(new_content)

print("Injected SovereignConsole cleanly.")
