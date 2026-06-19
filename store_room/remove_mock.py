import os

file_path = "hospyn-v2-web/src/App.jsx"

with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

new_content = []
i = 0
while i < len(lines):
    line = lines[i]
    
    if "{appStatus === 'approved' && (" in line and i > 1000 and i < 1100:
        new_content.append(line)
        
        replacement = """
        <div className="flex flex-col items-center justify-center min-h-screen text-slate-700 bg-[#F8FAFC] p-10">
          <div className="bg-white p-12 rounded-[32px] border border-slate-200 shadow-2xl shadow-blue-900/5 max-w-2xl text-center flex flex-col items-center">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h2 className="text-4xl font-extrabold text-slate-950 font-outfit tracking-tight mb-4">Activation Successful</h2>
            <p className="text-slate-500 mb-8 max-w-md leading-relaxed text-sm">
              Your hospital network has been securely activated. For HIPAA compliance and enterprise security, all clinical and staff management operations must be performed via the dedicated ERP Portal.
            </p>
            <a 
              href="https://hospyn-erp-portal.web.app/login" 
              className="px-8 py-4 bg-primary text-white rounded-xl font-bold text-sm uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
            >
              Secure Login to ERP Portal
            </a>
          </div>
        </div>
      )}
"""
        new_content.append(replacement)
        
        # skip lines until the end of the block
        # we know it ends at line 1932, so we look for "      )}", or just skip until 1932
        
        j = i + 1
        open_brackets = 1
        while j < len(lines):
            # count brackets roughly or just skip to exactly 1932
            # looking at the file, the block ends with "      )}\n"
            if "      )}\n" == lines[j] and j > 1900:
                i = j  # move i to the end of block
                break
            j += 1
            
    else:
        new_content.append(line)
        
    i += 1

with open(file_path, "w", encoding="utf-8") as f:
    f.writelines(new_content)
    
print("Successfully removed mock dashboard from hospyn-v2-web/src/App.jsx")
