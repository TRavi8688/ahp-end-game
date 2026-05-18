import base64

# 1x1 transparent PNG
b64_png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
img_data = base64.b64decode(b64_png)

with open("./assets/favicon.png", "wb") as f:
    f.write(img_data)
with open("./assets/icon.png", "wb") as f:
    f.write(img_data)
with open("./assets/adaptive-icon.png", "wb") as f:
    f.write(img_data)
with open("./assets/splash.png", "wb") as f:
    f.write(img_data)

print("Created 1x1 PNGs.")
