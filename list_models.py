import os
import json
import urllib.request
from backend.api.database import SessionLocal
from backend.api import models

db = SessionLocal()
user_settings = db.query(models.UserSettings).first()
api_key = user_settings.gemini_api_key

url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
try:
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        for model in data.get('models', []):
            if 'generateContent' in model.get('supportedGenerationMethods', []):
                print(model['name'])
except Exception as e:
    print("Error:", e)
