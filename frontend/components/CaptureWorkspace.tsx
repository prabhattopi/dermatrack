"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { 
  Camera, 
  Upload, 
  RefreshCw, 
  Disc, 
  Sparkles, 
  ArrowRight, 
  AlertTriangle,
  History,
  CheckCircle2
} from "lucide-react";

interface CalibrationData {
  imageUrl: string;
  imageFilename: string;
  width: number;
  height: number;
  ppm: number;
  coinDiameterMm: number;
}

interface Props {
  onCalibrationComplete: (data: CalibrationData, followup?: CalibrationData | null) => void;
}

const PRESET_COINS = [
  { name: "₹10 Indian Coin (27 mm)", mm: 27.0 },
  { name: "₹5 Indian Coin (25 mm)", mm: 25.0 },
  { name: "US Quarter (24.26 mm)", mm: 24.26 },
  { name: "1 Euro Coin (23.25 mm)", mm: 23.25 },
  { name: "Standard 20mm Sticker", mm: 20.0 }
];

export default function CaptureWorkspace({ onCalibrationComplete }: Props) {
  const [workflow, setWorkflow] = useState<"longitudinal" | "single">("longitudinal");
  const [inputTab, setInputTab] = useState<"presets" | "upload" | "camera">("presets");
  const [selectedCoinMm, setSelectedCoinMm] = useState<number>(25.0);

  // Active Scan 1 State
  const [scan1Data, setScan1Data] = useState<CalibrationData | null>(null);
  const [scan2Data, setScan2Data] = useState<CalibrationData | null>(null);
  
  // Active calibrator image
  const [activeCalibrating, setActiveCalibrating] = useState<"scan1" | "scan2">("scan1");
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [currentFilename, setCurrentFilename] = useState<string | null>(null);
  const [imgDimensions, setImgDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  const [uploading, setUploading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Calibration Ring
  const [ringDiameterPx, setRingDiameterPx] = useState<number>(120);
  const [ringPos, setRingPos] = useState<{ x: number; y: number }>({ x: 30, y: 75 });
  const calculatedPPM = parseFloat((ringDiameterPx / selectedCoinMm).toFixed(2));

  // Camera Management
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = async () => {
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      setErrorMessage("Camera access denied or unavailable: " + String(err));
    }
  };

  useEffect(() => {
    if (inputTab === "camera" && !currentImageUrl) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [inputTab, currentImageUrl, stopCamera]);

  const captureCameraFrame = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth || 1280;
    canvas.height = videoRef.current.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    stopCamera();
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], "camera-frame.png", { type: "image/png" });
        handleFileUpload(file);
      }
    }, "image/png");
  };

  const handleFileUpload = async (file: File) => {
    stopCamera();
    setUploading(true);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("reference_diameter_mm", selectedCoinMm.toString());

    try {
      const res = await fetch("http://127.0.0.1:8000/api/detect-marker", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.detail || `Server error: ${res.status}`);
      }

      const data = await res.json();
      setCurrentImageUrl(data.image_url);
      setCurrentFilename(data.image_filename);
      setImgDimensions({ width: data.width, height: data.height });

      if (data.detected_circle) {
        setRingDiameterPx(data.detected_circle.diameter_px);
        setRingPos({
          x: (data.detected_circle.x / data.width) * 100,
          y: (data.detected_circle.y / data.height) * 100,
        });
      } else {
        setRingDiameterPx(120);
        setRingPos({ x: 30, y: 75 });
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Upload error");
    } finally {
      setUploading(false);
    }
  };

  // Generate Photorealistic Dermoscopic Skin Lesion Benchmark
  const generateRealisticSkinCanvas = (type: "baseline_regular" | "evolved_melanoma_suspect") => {
    stopCamera();
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 600;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Organic skin tone gradient
    const skinGrad = ctx.createRadialGradient(300, 300, 50, 300, 300, 420);
    skinGrad.addColorStop(0, "#e8beab");
    skinGrad.addColorStop(1, "#d1a28a");
    ctx.fillStyle = skinGrad;
    ctx.fillRect(0, 0, 600, 600);

    // Realistic skin pores and micro-texture
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255,0.08)" : "rgba(100,60,40,0.04)";
      ctx.fillRect(Math.random() * 600, Math.random() * 600, 1.5, 1.5);
    }

    // 25mm Reference Coin
    const coinX = 180;
    const coinY = 450;
    const coinR = 60;
    ctx.beginPath();
    ctx.arc(coinX, coinY, coinR, 0, Math.PI * 2);
    ctx.fillStyle = "#b5871f";
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#7c5506";
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(coinX, coinY, coinR - 8, 0, Math.PI * 2);
    ctx.fillStyle = "#d4af37";
    ctx.fill();

    ctx.fillStyle = "#4a3202";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("25 mm", coinX, coinY);

    const moleX = 400;
    const moleY = 220;

    if (type === "baseline_regular") {
      // Regular Benign Nevus: Uniform, circular, soft reticular border
      ctx.beginPath();
      ctx.arc(moleX, moleY, 20, 0, Math.PI * 2);
      ctx.fillStyle = "#4a2412";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(moleX - 2, moleY - 1, 12, 0, Math.PI * 2);
      ctx.fillStyle = "#331608";
      ctx.fill();
    } else {
      // Evolved Dysplastic Nevus / Melanoma Suspect: Multi-lobular, notched, dark core
      ctx.beginPath();
      ctx.ellipse(moleX + 10, moleY - 6, 38, 28, Math.PI / 4, 0, Math.PI * 2);
      ctx.fillStyle = "#542410";
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(moleX - 12, moleY + 12, 28, 22, -Math.PI / 6, 0, Math.PI * 2);
      ctx.fillStyle = "#260e05";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(moleX, moleY, 15, 0, Math.PI * 2);
      ctx.fillStyle = "#0c0401";
      ctx.fill();
    }

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `${type}.png`, { type: "image/png" });
        handleFileUpload(file);
      }
    }, "image/png");
  };

  const confirmActiveCalibration = () => {
    if (!currentImageUrl || !currentFilename) return;

    const data: CalibrationData = {
      imageUrl: currentImageUrl,
      imageFilename: currentFilename,
      width: imgDimensions.width,
      height: imgDimensions.height,
      ppm: calculatedPPM,
      coinDiameterMm: selectedCoinMm,
    };

    if (workflow === "single") {
      onCalibrationComplete(data, null);
    } else {
      if (activeCalibrating === "scan1") {
        setScan1Data(data);
        // Reset view for scan 2
        setCurrentImageUrl(null);
        setCurrentFilename(null);
        setActiveCalibrating("scan2");
      } else {
        setScan2Data(data);
        if (scan1Data) {
          onCalibrationComplete(scan1Data, data);
        }
      }
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
      {/* Workflow Switcher: Single vs Longitudinal */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-6 border-b border-slate-800 gap-4">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-teal-400">
            Select Evaluation Workflow
          </span>
          <div className="flex items-center gap-3 mt-1.5">
            <button
              onClick={() => {
                setWorkflow("longitudinal");
                setActiveCalibrating("scan1");
                setScan1Data(null);
                setScan2Data(null);
                setCurrentImageUrl(null);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                workflow === "longitudinal"
                  ? "bg-teal-500 text-slate-950 border-teal-500 shadow-md shadow-teal-500/20"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              Longitudinal Comparison (2 Photos: T1 + T2)
            </button>
            <button
              onClick={() => {
                setWorkflow("single");
                setActiveCalibrating("scan1");
                setScan1Data(null);
                setScan2Data(null);
                setCurrentImageUrl(null);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                workflow === "single"
                  ? "bg-teal-500 text-slate-950 border-teal-500 shadow-md shadow-teal-500/20"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              Single Baseline Scan (1 Photo)
            </button>
          </div>
        </div>

        {/* Reference Coin Selector */}
        <div className="flex items-center gap-2.5 bg-slate-950 p-2 px-3 rounded-xl border border-slate-800">
          <span className="text-xs text-slate-400 font-medium">Reference Coin:</span>
          <select
            value={selectedCoinMm}
            onChange={(e) => setSelectedCoinMm(parseFloat(e.target.value))}
            className="bg-transparent border-none text-slate-200 text-xs font-semibold outline-none cursor-pointer"
          >
            {PRESET_COINS.map((c) => (
              <option key={c.name} value={c.mm} className="bg-slate-950 text-white">
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Longitudinal Staging Indicator (Only in Longitudinal Workflow) */}
      {workflow === "longitudinal" && (
        <div className="grid grid-cols-2 gap-4">
          <div className={`p-4 rounded-2xl border transition-all ${
            activeCalibrating === "scan1"
              ? "bg-teal-950/30 border-teal-500 text-teal-300"
              : scan1Data
              ? "bg-slate-950 border-emerald-800 text-emerald-400"
              : "bg-slate-950/60 border-slate-800 text-slate-500"
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold flex items-center gap-1.5">
                Scan 1: Month 0 Baseline (T1)
                {scan1Data && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              </span>
              <span className="text-[10px] font-mono">
                {scan1Data ? `${scan1Data.ppm} px/mm` : "Awaiting calibration"}
              </span>
            </div>
          </div>

          <div className={`p-4 rounded-2xl border transition-all ${
            activeCalibrating === "scan2"
              ? "bg-teal-950/30 border-teal-500 text-teal-300"
              : scan2Data
              ? "bg-slate-950 border-emerald-800 text-emerald-400"
              : "bg-slate-950/60 border-slate-800 text-slate-500"
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold flex items-center gap-1.5">
                Scan 2: Month 6 Follow-up (T2)
                {scan2Data && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              </span>
              <span className="text-[10px] font-mono">
                {scan2Data ? `${scan2Data.ppm} px/mm` : "Step 2"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Ingestion Methods */}
      <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800 w-fit">
        <button
          onClick={() => {
            stopCamera();
            setInputTab("presets");
          }}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-all ${
            inputTab === "presets" ? "bg-teal-500 text-slate-950 font-semibold" : "text-slate-400 hover:text-white"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          1-Click Benchmark Datasets
        </button>
        <button
          onClick={() => {
            stopCamera();
            setInputTab("upload");
          }}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-all ${
            inputTab === "upload" ? "bg-teal-500 text-slate-950 font-semibold" : "text-slate-400 hover:text-white"
          }`}
        >
          <Upload className="w-4 h-4" />
          Upload Image
        </button>
        <button
          onClick={() => setInputTab("camera")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-all ${
            inputTab === "camera" ? "bg-teal-500 text-slate-950 font-semibold" : "text-slate-400 hover:text-white"
          }`}
        >
          <Camera className="w-4 h-4" />
          Live Camera
        </button>
      </div>

      {errorMessage && (
        <div className="p-3 bg-rose-950/50 border border-rose-800 rounded-xl text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Viewport Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Viewport */}
        <div className="lg:col-span-8 flex flex-col items-center justify-center min-h-[460px] bg-slate-950 rounded-2xl border border-slate-800 relative overflow-hidden">
          {inputTab === "presets" && !currentImageUrl && (
            <div className="p-8 w-full max-w-lg space-y-4 text-center">
              <h3 className="text-base font-bold text-white">
                Load Realistic Clinical Dermoscopic Presets
              </h3>
              <p className="text-xs text-slate-400 mb-6">
                Standard ₹5 (25mm) scale calibrated benchmark cases for hackathon demonstration.
              </p>

              <div className="grid grid-cols-1 gap-4">
                <button
                  onClick={() => generateRealisticSkinCanvas("baseline_regular")}
                  className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-teal-500/60 text-left transition-all hover:translate-y-[-2px]"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-teal-300">
                      Preset 1: Regular Benign Nevus (Baseline)
                    </span>
                    <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400">Regular Nevus</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    Uniform circular border, homogeneous pigment distribution (~5.2mm diameter).
                  </p>
                </button>

                <button
                  onClick={() => generateRealisticSkinCanvas("evolved_melanoma_suspect")}
                  className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-rose-500/60 text-left transition-all hover:translate-y-[-2px]"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-rose-300">
                      Preset 2: Evolved Dysplastic Lesion (Melanoma Suspect)
                    </span>
                    <span className="text-[10px] bg-rose-950/80 border border-rose-800 text-rose-300 px-2 py-0.5 rounded">High Risk</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    Multi-tone pigmentation, irregular lobulated border, rapid radial growth (&gt;9.5mm diameter).
                  </p>
                </button>
              </div>
            </div>
          )}

          {inputTab === "upload" && !currentImageUrl && (
            <label className="w-full h-full flex flex-col items-center justify-center p-8 cursor-pointer hover:bg-slate-900/50 transition-colors">
              <div className="w-16 h-16 rounded-2xl bg-teal-500/10 text-teal-400 flex items-center justify-center mb-4 border border-teal-500/20">
                <Upload className="w-8 h-8" />
              </div>
              <p className="text-sm font-semibold text-slate-200">
                Drop skin image here, or <span className="text-teal-400 underline">browse</span>
              </p>
              <p className="text-xs text-slate-500 mt-2 text-center max-w-sm">
                Ensure mole and reference coin are clearly visible without glare.
              </p>
              <input
                type="file"
                accept="image/png, image/jpeg, image/jpg"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
                }}
              />
            </label>
          )}

          {inputTab === "camera" && !currentImageUrl && (
            <div className="relative w-full h-full flex flex-col items-center justify-center p-4">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full max-h-[460px] object-cover rounded-xl"
              />
              <button
                onClick={captureCameraFrame}
                className="mt-4 px-6 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold rounded-xl text-xs flex items-center gap-2 shadow-lg"
              >
                <Camera className="w-4 h-4" />
                Capture Snapshot
              </button>
            </div>
          )}

          {/* Active Calibration Overlay */}
          {currentImageUrl && (
            <div className="relative w-full h-full flex items-center justify-center p-2 select-none">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentImageUrl}
                alt="Calibrating skin scan"
                className="max-h-[480px] w-auto object-contain rounded-xl shadow-lg"
              />

              {/* Draggable Calibration Ring */}
              <div
                style={{
                  width: `${ringDiameterPx}px`,
                  height: `${ringDiameterPx}px`,
                  left: `${ringPos.x}%`,
                  top: `${ringPos.y}%`,
                  transform: "translate(-50%, -50%)"
                }}
                className="absolute rounded-full border-2 border-amber-400 bg-amber-400/20 flex items-center justify-center shadow-lg shadow-amber-500/20 cursor-move pointer-events-auto"
                onMouseDown={(e) => {
                  const parent = e.currentTarget.parentElement?.getBoundingClientRect();
                  if (!parent) return;
                  const onMouseMove = (moveEvent: MouseEvent) => {
                    const x = ((moveEvent.clientX - parent.left) / parent.width) * 100;
                    const y = ((moveEvent.clientY - parent.top) / parent.height) * 100;
                    setRingPos({ x: Math.min(Math.max(x, 5), 95), y: Math.min(Math.max(y, 5), 95) });
                  };
                  const onMouseUp = () => {
                    window.removeEventListener("mousemove", onMouseMove);
                    window.removeEventListener("mouseup", onMouseUp);
                  };
                  window.addEventListener("mousemove", onMouseMove);
                  window.addEventListener("mouseup", onMouseUp);
                }}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
                <span className="absolute -top-6 text-[10px] font-mono font-bold text-amber-300 bg-slate-950/90 px-2 py-0.5 rounded border border-amber-500/30 whitespace-nowrap">
                  {selectedCoinMm}mm Reference Target
                </span>
              </div>
            </div>
          )}

          {uploading && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center">
              <RefreshCw className="w-8 h-8 text-teal-400 animate-spin mb-3" />
              <p className="text-xs font-mono text-slate-300">FastAPI OpenCV Engine analyzing raster image...</p>
            </div>
          )}
        </div>

        {/* Right Column: Controls */}
        <div className="lg:col-span-4 flex flex-col justify-between space-y-6 bg-slate-950/60 border border-slate-800/80 p-6 rounded-2xl">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Disc className="w-4 h-4 text-teal-400" />
              <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-wide">
                Metric Calibration
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Drag the amber ring over the reference coin. Adjust the diameter slider until it matches the outer coin edge to lock true millimeter scale.
            </p>

            <div className="mt-6 space-y-3">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-400">Marker Ring Diameter:</span>
                <span className="text-teal-300 font-semibold">{ringDiameterPx} px</span>
              </div>
              <input
                type="range"
                min="40"
                max="300"
                value={ringDiameterPx}
                onChange={(e) => setRingDiameterPx(parseInt(e.target.value))}
                className="w-full accent-teal-400 cursor-pointer"
              />
            </div>

            <div className="mt-6 p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Physical Size:</span>
                <span className="text-white font-semibold">{selectedCoinMm} mm</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Pixel Equivalent:</span>
                <span className="text-white font-semibold">{ringDiameterPx} px</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-800 text-teal-300">
                <span>Scale Ratio (PPM):</span>
                <span className="font-bold text-sm">{calculatedPPM} px/mm</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {currentImageUrl && (
              <button
                onClick={() => {
                  stopCamera();
                  setCurrentImageUrl(null);
                  setCurrentFilename(null);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium border border-slate-800 transition-colors"
              >
                Change Photo
              </button>
            )}

            <button
              disabled={!currentImageUrl}
              onClick={confirmActiveCalibration}
              className="w-full py-3.5 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 transition-all active:scale-[0.98]"
            >
              {workflow === "single"
                ? "Lock Scale & Run ABCDE Extraction →"
                : activeCalibrating === "scan1"
                ? "Lock Scan 1 Scale & Proceed to Scan 2 →"
                : "Lock Both Scales & Run Longitudinal Analysis →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}