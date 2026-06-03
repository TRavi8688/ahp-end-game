import os
import glob

# Path to src directory
src_dir = r"c:\Users\DELL\OneDrive\Desktop\ahp\ahp.2.o\hospital-erp\src"

# Files to skip (apiClient.js obviously needs axios)
skip_files = ["apiClient.js"]

for filepath in glob.glob(os.path.join(src_dir, "**", "*.jsx"), recursive=True):
    filename = os.path.basename(filepath)
    if filename in skip_files:
        continue
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    if "import axios" in content:
        import_str = "import apiClient from './apiClient'" if filename == "App.jsx" else "import apiClient from '../apiClient'"
        import_str_semi = "import apiClient from './apiClient';" if filename == "App.jsx" else "import apiClient from '../apiClient';"
        
        content = content.replace("import axios from 'axios'", import_str)
        content = content.replace("import axios from 'axios';", import_str_semi)
        content = content.replace("axios.post(`${API_BASE_URL}", "apiClient.post(`")
        content = content.replace("axios.get(`${API_BASE_URL}", "apiClient.get(`")
        content = content.replace("axios.put(`${API_BASE_URL}", "apiClient.put(`")
        content = content.replace("axios.delete(`${API_BASE_URL}", "apiClient.delete(`")
        content = content.replace("axios.post(API_BASE_URL", "apiClient.post(")
        content = content.replace("axios.get(API_BASE_URL", "apiClient.get(")
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
            
print("Refactored axios imports to apiClient.")
