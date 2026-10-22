import sys
import os
import uuid
import math
import traceback
import numpy as np
import cv2
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, List

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
    image_filename: str
    width: int
    height: int
    detected_circle: Optional[dict] = None
    calculated_ppm: Optional[float] = None
    message: str

class ABCDEResult(BaseModel):
    success: bool
    overlay_image_url: str
    mask_image_url: str
    asymmetry_score: float
    asymmetry_class: str
    border_compactness: float
    border_class: str
    color_variegation_score: float
    color_shades: List[str]
    diameter_mm: float
    diameter_risk: str
    total_abcde_risk: str
    clinical_summary: str

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
            raise HTTPException(
                status_code=400, 
                detail="OpenCV could not decode image. Please upload a standard PNG or JPEG image."
            )

        height, width = img.shape[:2]
        unique_name = f"{uuid.uuid4().hex[:12]}.png"
        saved_path = os.path.join(UPLOAD_DIR, unique_name)
        cv2.imwrite(saved_path, img)

        # Hough Circle Reference Detection
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
            "image_filename": unique_name,
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


@app.post("/api/analyze-abcde", response_model=ABCDEResult)
async def analyze_abcde(
    image_filename: str = Form(...),
    ppm: float = Form(...)
):
    try:
        image_path = os.path.join(UPLOAD_DIR, image_filename)
        if not os.path.exists(image_path):
            raise HTTPException(status_code=404, detail="Calibrated image not found on server")

        img = cv2.imread(image_path)
        if img is None:
            raise HTTPException(status_code=400, detail="Cannot read target image file")

        h, w = img.shape[:2]

        # 1. Grayscale & Thresholding
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        filtered = cv2.bilateralFilter(gray, 9, 75, 75)
        _, thresh = cv2.threshold(filtered, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

        # Morphological noise removal
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        thresh = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel, iterations=2)
        thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=2)

        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            raise HTTPException(status_code=400, detail="No lesion contour could be segmented.")

        valid_candidates = []
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < 80:
                continue
            if area > (w * h * 0.45):
                continue
            
            perimeter = cv2.arcLength(cnt, True)
            if perimeter == 0:
                continue
            circularity = 4 * math.pi * (area / (perimeter * perimeter))
            bx, by, bw, bh = cv2.boundingRect(cnt)
            
            valid_candidates.append({
                "contour": cnt,
                "area": area,
                "perimeter": perimeter,
                "circularity": circularity,
                "bbox": (bx, by, bw, bh)
            })

        if not valid_candidates:
            largest = max(contours, key=cv2.contourArea)
            valid_candidates = [{
                "contour": largest,
                "area": cv2.contourArea(largest),
                "perimeter": cv2.arcLength(largest, True),
                "circularity": 0.5,
                "bbox": cv2.boundingRect(largest)
            }]

        if len(valid_candidates) > 1:
            valid_candidates = sorted(valid_candidates, key=lambda x: x["area"], reverse=True)
            # Coin is usually the more circular object, lesion has lower circularity
            lesion_data = valid_candidates[1] if valid_candidates[0].get("circularity", 0) > 0.8 else valid_candidates[0]
        else:
            lesion_data = valid_candidates[0]

        lesion_contour = lesion_data["contour"]
        area_px = lesion_data["area"]
        perimeter_px = lesion_data["perimeter"]
        bx, by, bw, bh = lesion_data["bbox"]

        # ==========================================
        # ABCDE Metrics
        # ==========================================

        # D: Diameter (mm)
        _, (rw, rh), _ = cv2.minAreaRect(lesion_contour)
        max_dimension_px = max(rw, rh)
        diameter_mm = round(float(max_dimension_px / max(0.1, ppm)), 2)
        diameter_risk = "Elevated (>6.0mm)" if diameter_mm >= 6.0 else "Normal (<6.0mm)"

        # B: Border Compactness
        if area_px > 0:
            compactness = round(float((perimeter_px ** 2) / (4 * math.pi * area_px)), 2)
        else:
            compactness = 1.0

        if compactness < 1.3:
            border_class = "Regular & Smooth"
        elif compactness < 1.7:
            border_class = "Mildly Irregular / Notched"
        else:
            border_class = "Highly Irregular / Ragged"

        # A: Asymmetry Index
        M = cv2.moments(lesion_contour)
        if M["m00"] != 0:
            cx = int(M["m10"] / M["m00"])
            cy = int(M["m01"] / M["m00"])
        else:
            cx, cy = bx + bw // 2, by + bh // 2

        single_mask = np.zeros((h, w), dtype=np.uint8)
        cv2.drawContours(single_mask, [lesion_contour], -1, 255, -1)

        lesion_crop_mask = single_mask[by:by+bh, bx:bx+bw]

        flip_h = cv2.flip(lesion_crop_mask, 1)
        diff_h = cv2.bitwise_xor(lesion_crop_mask, flip_h)
        asym_ratio_h = np.count_nonzero(diff_h) / max(1, np.count_nonzero(lesion_crop_mask))

        flip_v = cv2.flip(lesion_crop_mask, 0)
        diff_v = cv2.bitwise_xor(lesion_crop_mask, flip_v)
        asym_ratio_v = np.count_nonzero(diff_v) / max(1, np.count_nonzero(lesion_crop_mask))

        avg_asym = (asym_ratio_h + asym_ratio_v) / 2.0
        asymmetry_score = round(float(avg_asym * 100), 1)

        if asymmetry_score < 25.0:
            asymmetry_class = "Symmetric (Low Risk)"
        elif asymmetry_score < 45.0:
            asymmetry_class = "Moderate Asymmetry"
        else:
            asymmetry_class = "High Asymmetry (Suspicious)"

        # C: Color Variegation
        lesion_pixels = img[single_mask == 255]
        if len(lesion_pixels) > 0:
            color_std = float(np.std(lesion_pixels))
            color_variegation_score = round(color_std, 1)
            mean_b, mean_g, mean_r = np.mean(lesion_pixels, axis=0)
            shades = []
            if mean_r < 65 and mean_g < 65 and mean_b < 65:
                shades.append("Dark Brown / Black Core")
            elif mean_r > 100 and mean_g < 75:
                shades.append("Erythematous / Reddish Tint")
            else:
                shades.append("Uniform Tan / Light Brown")

            if color_std > 22.0:
                shades.append("Heterogeneous Pigment Spread")
        else:
            color_variegation_score = 0.0
            shades = ["Uniform"]

        # Risk Classification
        risk_flags = 0
        if diameter_mm >= 6.0: risk_flags += 1
        if compactness >= 1.4: risk_flags += 1
        if asymmetry_score >= 35.0: risk_flags += 1
        if color_variegation_score >= 20.0: risk_flags += 1

        if risk_flags >= 3:
            total_abcde_risk = "High Suspicion (Clinical Evaluation Recommended)"
            clinical_summary = f"Lesion exhibits {diameter_mm}mm diameter (above 6mm threshold) with {border_class.lower()} and noticeable asymmetry. Dermoscopy suggested."
        elif risk_flags >= 1:
            total_abcde_risk = "Moderate (Monitor Longitudinal Changes)"
            clinical_summary = f"Lesion has mild atypical criteria ({diameter_mm}mm, {asymmetry_class}). Short-interval follow-up recommended."
        else:
            total_abcde_risk = "Low Risk / Likely Benign"
            clinical_summary = f"Lesion demonstrates regular borders, symmetrical morphology, and compact dimensions ({diameter_mm}mm)."

        # ==========================================
        # Visual Overlays
        # ==========================================
        overlay = img.copy()

        # Green contour boundary
        cv2.drawContours(overlay, [lesion_contour], -1, (46, 213, 115), 3)

        # Yellow symmetry crosshairs
        axis_len = int(max(bw, bh) * 0.7)
        cv2.line(overlay, (cx - axis_len, cy), (cx + axis_len, cy), (0, 230, 255), 2)
        cv2.line(overlay, (cx, cy - axis_len), (cx, cy + axis_len), (0, 230, 255), 2)
        cv2.circle(overlay, (cx, cy), 4, (0, 0, 255), -1)

        # Text label
        badge_text = f"D: {diameter_mm}mm | Asym: {asymmetry_score}%"
        cv2.putText(overlay, badge_text, (max(10, bx - 10), max(25, by - 12)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2, cv2.LINE_AA)
        cv2.putText(overlay, badge_text, (max(10, bx - 10), max(25, by - 12)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (20, 20, 20), 1, cv2.LINE_AA)

        # Save Visual Overlays (Correct file naming)
        overlay_name = f"overlay_{image_filename}"
        mask_name = f"mask_{image_filename}"
        cv2.imwrite(os.path.join(UPLOAD_DIR, overlay_name), overlay)
        cv2.imwrite(os.path.join(UPLOAD_DIR, mask_name), single_mask)

        return {
            "success": True,
            "overlay_image_url": f"http://127.0.0.1:8000/uploads/{overlay_name}",
            "mask_image_url": f"http://127.0.0.1:8000/uploads/{mask_name}",
            "asymmetry_score": asymmetry_score,
            "asymmetry_class": asymmetry_class,
            "border_compactness": compactness,
            "border_class": border_class,
            "color_variegation_score": color_variegation_score,
            "color_shades": shades,
            "diameter_mm": diameter_mm,
            "diameter_risk": diameter_risk,
            "total_abcde_risk": total_abcde_risk,
            "clinical_summary": clinical_summary
        }

    except HTTPException:
        raise
    except Exception as e:
        print("ERROR IN /api/analyze-abcde:", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

# Entrypoint to run server
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)