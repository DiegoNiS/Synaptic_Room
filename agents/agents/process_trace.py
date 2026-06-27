from google_adk.agent import Agent
from google_adk.memory import ConversationBuffer
from models.schemas import WindowMetrics, HistoricalContext, AnalysisResult, AnalyzeResponse

# Definimos el Agente Process Trace usando Google ADK
process_trace_agent = Agent(
    name="Process Trace AI",
    model="gemini-1.5-pro",
    system_instruction=(
        "Eres un agente especializado en el análisis del proceso cognitivo de estudiantes "
        "a través de sus métricas de escritura y el texto que redactan. \n\n"
        "Reglas de evaluación:\n"
        "- flow: WPM estable (> 10), pausas cortas (< 3000ms), borrados bajos. El estudiante avanza sin problemas.\n"
        "- idle: WPM variable, pausas medias (3000-8000ms), borrados moderados. Puede estar pensando o buscando información.\n"
        "- blocked: WPM muy bajo (< 5) o pausas largas (> 8000ms) y borrados altos. El estudiante no escribe o borra constantemente.\n\n"
        "Debes analizar las métricas y retornar un objeto JSON con:\n"
        "- state: El estado del estudiante, debe ser estrictamente uno de los siguientes: 'flow', 'blocked', 'idle'.\n"
        "- confidence: Un puntaje de confianza de 0.0 a 1.0.\n"
        "- blockagePoint: Una breve descripción en español del tema o punto específico en el que está atascado "
        "(máx 15 palabras) si está bloqueado ('blocked'). Si el estado es 'flow' o 'idle', este campo DEBE ser null."
    ),
    memory=ConversationBuffer(), # ADK maneja el historial si es necesario
    response_schema=AnalysisResult # Forzamos la salida estructurada usando el modelo Pydantic
)

async def run_process_trace(student_id: str, metrics: WindowMetrics, context: HistoricalContext) -> AnalyzeResponse:
    """
    Toma las métricas de teclado y solicita al agente ADK que determine el estado cognitivo.
    """
    prompt = (
        f"Analiza las siguientes métricas del estudiante {student_id}:\n"
        f"- WPM promedio: {metrics.wpm}\n"
        f"- Pausa más larga detectada: {metrics.pauseDurationMs} ms\n"
        f"- Cantidad de borrados (backspaces/deletes): {metrics.deletionCount}\n"
        f"- Cantidad de tecleos en esta ventana: {metrics.keystrokeCount}\n"
        f"- Último texto escrito: '{metrics.textSnapshot}'\n"
        f"- Duración de la ventana de análisis: {metrics.windowSizeMs} ms\n"
        f"- Estado cognitivo previo: {context.lastState}\n"
        f"- Tiempo acumulado en estado bloqueado: {context.blockedForMs} ms\n\n"
        "Evalúa si el estudiante está atascado en base a su ritmo y al texto que ha intentado escribir. "
        "Si está bloqueado, deduce a partir de su texto cuál es la dificultad o punto de bloqueo específico."
    )
    
    # Invocamos al agente (simulando sintaxis ADK)
    response = await process_trace_agent.arun(prompt)
    
    if isinstance(response, dict):
        analysis = AnalysisResult(**response)
    else:
        analysis = response
        
    return AnalyzeResponse(studentId=student_id, analysis=analysis)
