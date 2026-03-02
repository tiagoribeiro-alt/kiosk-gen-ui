import logging
from typing import Annotated
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from uuid import uuid4

from app.core.config import settings
from app.core.session import KioskSession

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Kiosk Gen-UI Backend")

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "ok", "message": "Backend is running"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    session_id = str(uuid4())
    logger.info(f"Accepted websocket connection: Session {session_id}")
    
    kiosk_session = KioskSession(websocket=websocket, session_id=session_id)
    try:
        await kiosk_session.connect_to_gemini()
    except WebSocketDisconnect:
        logger.info(f"Session {session_id} disconnected")
    except Exception as e:
        logger.error(f"Error in websocket loop for {session_id}: {e}")
        try:
            await websocket.close()
        except:
            pass
