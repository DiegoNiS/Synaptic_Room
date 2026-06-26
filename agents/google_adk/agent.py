import json
from tools.gemini_client import analyze_with_gemini

class Agent:
    def __init__(self, name, model, system_instruction, response_schema=None, memory=None):
        self.name = name
        self.model = model
        self.system_instruction = system_instruction
        self.response_schema = response_schema
        self.memory = memory

    async def arun(self, prompt: str):
        # Usamos nuestra utilidad para llamar a Gemini con la instrucción de sistema
        response_dict = analyze_with_gemini(prompt, system_instruction=self.system_instruction)
        
        if self.response_schema:
            try:
                # Validamos y retornamos el objeto Pydantic
                return self.response_schema(**response_dict)
            except Exception as e:
                print(f"Error mapeando la respuesta al esquema: {e}")
                return response_dict
        return response_dict
