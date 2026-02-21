import urllib.request
import json
import ssl

context = ssl._create_unverified_context()

token = "ofapi_03SJHIffT7oMztcLSET7yTA7x0g53ijf9TARi20L0eff63a5"
creator_id = "513271711" 

headers = {
    'Authorization': f'Bearer {token}', 
    'Content-Type': 'application/json'
}

data = {
    "account_ids": [creator_id],
    "start_date": "2026-02-19T00:00:00.000Z",
    "end_date": "2026-02-28T00:00:00.000Z" # Full 10 day window of the dashboard
}
req = urllib.request.Request(
    'https://app.onlyfansapi.com/api/analytics/financial/transactions/summary', 
    data=json.dumps(data).encode('utf-8'), 
    headers=headers, 
    method='POST'
)

try:
    with urllib.request.urlopen(req, context=context) as response:
        res = response.read().decode('utf-8')
        print(res)
except Exception as e:
    print("Error:", e)
