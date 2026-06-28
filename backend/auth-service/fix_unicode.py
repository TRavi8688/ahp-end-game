"""Replace all non-ASCII characters in auth.py with safe ASCII equivalents."""
import pathlib

target = pathlib.Path("app/api/v1/auth.py")
content = target.read_text(encoding="utf-8")

replacements = {
    "\u2192": "->",     # -> arrow
    "\u2014": "--",     # -- em-dash
    "\u2500": "-",      # - box drawing horizontal
    "\u2013": "-",      # - en-dash  
}

for bad, good in replacements.items():
    content = content.replace(bad, good)

target.write_text(content, encoding="utf-8")
print("Done! All non-ASCII characters replaced.")
