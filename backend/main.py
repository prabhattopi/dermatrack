import sys
import os
import uuid
import traceback
import numpy as np
import cv2
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional

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
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

class HealthResponse(BaseModel):
    status: str
    version: str
    cv_engine: str
    python_version: str

class MarkerDetectionResponse(BaseModel):
    success: bool
    image_url: str
    width: int
    height: int
    detected_circle: Optional[dict] = None
    calculated_ppm: Optional[float] = None
    message: str

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
    return {
        "status": "online",
        "version": "1.0.0",
        "cv_engine": f"OpenCV {cv2.__version__} | NumPy {np.__version__}",
        "python_version": sys.version.split()[0],
    }

@app.post("/api/detect-marker", response_model=MarkerDetectionResponse)
async def detect_marker(
    file: UploadFile = File(...),
    reference_diameter_mm: float = Form(25.0)
):
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            # Agar image decode fail ho (jaise non-raster ya corrupted file)
            raise HTTPException(
                status_code=400, 
                detail="OpenCV could not decode image. Please upload a standard PNG or JPEG image."
            )

        height, width = img.shape[:2]

        # Standard PNG format mein save karein
        unique_name = f"{uuid.uuid4().hex[:12]}.png"
        saved_path = os.path.join(UPLOAD_DIR, unique_name)
        cv2.imwrite(saved_path, img)

        # Reference coin detection algorithm (Hough Circles)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (9, 9), 2)

        min_radius = max(10, int(min(width, height) * 0.03))
        max_radius = int(min(width, height) * 0.35)

        circles = cv2.HoughCircles(
            blurred,
            cv2.HOUGH_GRADIENT,
            dp=1.2,
            minDist=min_radius * 2,
            param1=100,
            param2=35,
            minRadius=min_radius,
            maxRadius=max_radius
        )

        detected_circle = None
        calculated_ppm = None
        message = "Image processed. You can manually adjust the calibration ring."

        if circles is not None:
            circles = np.round(circles[0, :]).astype("int")
            # Pick largest circular candidate
            circles = sorted(circles, key=lambda c: c[2], reverse=True)
            c = circles[0]
            cx, cy, r = int(c[0]), int(c[1]), int(c[2])
            diameter_px = r * 2
            calculated_ppm = round(float(diameter_px / reference_diameter_mm), 2)
            detected_circle = {
                "x": cx,
                "y": cy,
                "radius": r,
                "diameter_px": diameter_px
            }
            message = f"Found marker: {diameter_px}px diameter ({calculated_ppm} px/mm)."

        return {
            "success": True,
            "image_url": f"http://127.0.0.1:8000/uploads/{unique_name}",
            "width": width,
            "height": height,
            "detected_circle": detected_circle,
            "calculated_ppm": calculated_ppm,
            "message": message
        }

    except HTTPException:
        raise
    except Exception as e:
        print("ERROR IN /api/detect-marker:", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))