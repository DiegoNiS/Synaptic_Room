import os
import google.generativeai as genai
from dotenv import load_dotenv
import json

load_dotenv()

# Configurar el API key
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# Podemos usar flash para rapidez, pero el README dice Gemini 1.5 Pro
# Para producción en el hackathon, usa "gemini-1.5-pro", pero "gemini-1.5-flash" es más rápido
MODEL_NAME = "gemini-3.1-flash-lite"

def analyze_with_gemini(prompt: str, system_instruction: str = None) -> dict:
    """
    Función auxiliar para hacer consultas a Gemini esperando siempre un JSON.
    Aunque usaremos google-adk, esto puede ser útil para tareas de bajo nivel.
    """
    model = genai.GenerativeModel(
        model_name=MODEL_NAME,
        system_instruction=system_instruction,
        generation_config={
            "response_mime_type": "application/json",
        }
    )
    
    response = model.generate_content(prompt)
    try:
        return json.loads(response.text)
    except json.JSONDecodeError:
        print("Error decodificando el JSON de Gemini:", response.text)
        return {}
