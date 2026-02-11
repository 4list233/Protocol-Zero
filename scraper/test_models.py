#!/usr/bin/env python3
import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_AI_API_KEY'))

# Test models that should have quota
test_models = [
    'gemini-2.0-flash',
    'gemini-2.0-flash-001',
    'gemini-2.0-flash-lite',
    'gemini-2.0-flash-lite-001',
    'gemini-exp-1206',
    'gemini-flash-latest',
]

print('🧪 Testing which models have available quota:\n')

for model_name in test_models:
    try:
        model = genai.GenerativeModel(model_name)
        response = model.generate_content('Translate to English: 测试')
        result = response.text.strip()
        print(f'✅ {model_name}: Works! "{result}"')
    except Exception as e:
        error = str(e)
        if '429' in error:
            print(f'❌ {model_name}: Quota exceeded')
        elif '404' in error:
            print(f'❌ {model_name}: Model not found')
        else:
            print(f'❌ {model_name}: {error[:60]}')
