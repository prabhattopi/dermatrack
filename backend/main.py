import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(
    title="DermaTrack Core Vision Engine",
    description="Computer Vision & Longitudinal Melanoma Progression API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class HealthResponse(BaseModel):
    status: str
    version: str
    cv_engine: str
    python_version: str

@app.get("/")
def root():
    return {
        "project": "DermaTrack Core Vision Engine",
        "status": "online",
        "health_check": "/api/health",
        "interactive_docs": "/docs"
    }

@app.get("/api/health", response_model=HealthResponse)
def health_check():
    import cv2
    import numpy as np
    return {
        "status": "online",
        "version": "1.0.0",
        "cv_engine": f"OpenCV {cv2.__version__} | NumPy {np.__version__}",
        "python_version": sys.version.split()[0],
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)