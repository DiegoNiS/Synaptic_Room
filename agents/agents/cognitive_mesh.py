from typing import List
from google_adk.agent import Agent
from models.schemas import MatchMentorResponse

# Definimos el Agente Cognitive Mesh usando Google ADK
cognitive_mesh_agent = Agent(
    name="Cognitive Mesh AI",
    model="gemini-1.5-flash",
    system_instruction=(
        "Eres un orquestador inteligente dentro de un aula virtual. "
        "Tu tarea es conectar a un estudiante que se ha 'bloqueado' con el mejor "
        "compañero disponible que pueda actuar como mentor (alguien que esté en 'flow'). \n\n"
        "Reglas de emparejamiento:\n"
        "1. Evalúa las opciones y devuelve el 'mentorId' seleccionado de la lista de disponibles, "
        "el 'blockedId' que ingresó, y un 'matchScore' (0.0 a 1.0) que indique qué tan ideal es el emparejamiento.\n\n"
        "Debes responder estrictamente con el formato JSON definido."
    ),
    response_schema=MatchMentorResponse
)

async def run_cognitive_mesh(blocked_id: str, available_mentors: List[str]) -> MatchMentorResponse:
    """
    Toma al estudiante bloqueado y la lista de mentores disponibles,
    solicitando al agente que elija la mejor opción.
    """
    # Si no hay mentores, devolvemos un match nulo
    if not available_mentors:
        return MatchMentorResponse(
            mentorId="none",
            blockedId=blocked_id,
            matchScore=0.0
        )
        
    prompt = (
        f"El estudiante con ID '{blocked_id}' está bloqueado en su ejercicio.\n"
        f"Aquí tienes la lista de IDs de estudiantes disponibles que están en estado de flujo:\n"
        f"{available_mentors}\n\n"
        "Analiza la situación y selecciona al mejor mentor disponible de la lista."
    )
    
    response = await cognitive_mesh_agent.arun(prompt)
    
    if isinstance(response, dict):
        return MatchMentorResponse(**response)
    return response
