import os
from google_adk.agent import Agent
from google_adk.memory import ConversationBuffer
from models.schemas import TraceMetrics, AnalyzeResponse

# Definimos el Agente Process Trace usando Google ADK
process_trace_agent = Agent(
    name="Process Trace AI",
    model="gemini-1.5-pro",
    system_instruction=(
        "Eres un agente especializado en el análisis del proceso cognitivo de estudiantes "
        "a través de sus métricas de escritura. \n\n"
        "Reglas de evaluación:\n"
        "- Flujo: WPM estable (> 10), pausas cortas (< 3000ms), backspace ratio bajo (< 0.15).\n"
        "- Procesando: WPM variable, pausas medias (3000-8000ms), backspace ratio (0.15-0.30).\n"
        "- Bloqueado: WPM muy bajo (< 5) o pausas largas (> 8000ms) y backspace ratio alto (> 0.30).\n\n"
        "Debes analizar las métricas proporcionadas y retornar el estado, un puntaje de confianza (0.0 a 1.0) "
        "y una breve razón analítica (máx 15 palabras)."
    ),
    memory=ConversationBuffer(), # ADK maneja el historial si es necesario
    response_schema=AnalyzeResponse # Forzamos la salida estructurada usando el modelo Pydantic
)

async def run_process_trace(student_id: str, trace: TraceMetrics) -> AnalyzeResponse:
    """
    Toma las métricas de teclado y solicita al agente ADK que determine el estado cognitivo.
    """
    prompt = (
        f"Analiza las siguientes métricas del estudiante {student_id}:\n"
        f"- WPM: {trace.wpm}\n"
        f"- Duración de última pausa (ms): {trace.pause_duration_ms}\n"
        f"- Ratio de borrado: {trace.backspace_ratio}\n"
        f"- Tiempo total (s): {trace.elapsed_seconds}\n"
        f"- Caracteres escritos: {trace.chars_written}"
    )
    
    # Invocamos al agente (simulando sintaxis ADK)
    response = await process_trace_agent.arun(prompt)
    
    # Como definimos response_schema, la respuesta ya es una instancia de AnalyzeResponse
    # Si la librería devuelve un dict, lo parseamos, pero asumamos que devuelve el modelo.
    # En caso de necesitar parsear:
    if isinstance(response, dict):
        return AnalyzeResponse(**response)
    return response
