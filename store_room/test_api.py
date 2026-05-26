import requests

url = "https://hospyn-495906-api-625745217419.us-central1.run.app/api/v1/hospital-settings/"

# Let's try to trigger a 500 error to see what happens
try:
    response = requests.get(url)
    print("Status:", response.status_code)
    print("Body:", response.text)
except Exception as e:
    print(e)
