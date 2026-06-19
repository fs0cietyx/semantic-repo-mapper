import os
from openai import OpenAI
from backend.api.database import SessionLocal
from backend.api import models

db = SessionLocal()
user_settings = db.query(models.UserSettings).first()
api_key = user_settings.gemini_api_key

client = OpenAI(
    api_key=api_key,
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
)

try:
    response = client.chat.completions.create(
        model="gemini-1.5-flash",
        messages=[{"role": "user", "content": "Hello"}]
    )
    print("gemini-1.5-flash:", response.choices[0].message.content)
except Exception as e:
    print("Error 1.5-flash:", e)

try:
    response = client.chat.completions.create(
        model="gemini-2.0-flash",
        messages=[{"role": "user", "content": "Hello"}]
    )
    print("gemini-2.0-flash:", response.choices[0].message.content)
except Exception as e:
    print("Error 2.0-flash:", e)

try:
    response = client.chat.completions.create(
        model="gemini-1.5-pro",
        messages=[{"role": "user", "content": "Hello"}]
    )
    print("gemini-1.5-pro:", response.choices[0].message.content)
except Exception as e:
    print("Error 1.5-pro:", e)
