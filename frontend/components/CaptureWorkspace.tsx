"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { 
  Camera, 
  Upload, 
  RefreshCw, 
  Disc, 
  Sparkles, 
  AlertTriangle,
  CheckCircle2,
  Minimize2,
  ZoomIn
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
  const [workflow, setWorkflow] = useState<"longitudinal" | "single">("single");
  const [inputTab, setInputTab] = useState<"upload" | "presets" | "camera">("upload");
  const [selectedCoinMm, setSelectedCoinMm] = useState<number>(25.0);

  // Calibration Data
  const [scan1Data, setScan1Data] = useState<CalibrationData | null>(null);
  const [scan2Data, setScan2Data] = useState<CalibrationData | null>(null);

  const [activeCalibrating, setActiveCalibrating] = useState<"scan1" | "scan2">("scan1");
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [currentFilename, setCurrentFilename] = useState<string | null>(null);
  const [imgDimensions, setImgDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  const [uploading, setUploading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Ring Calibration Geometry (Controlled Bounds: 30px to 320px)
  const [ringDiameterPx, setRingDiameterPx] = useState<number>(120);
  const [ringPos, setRingPos] = useState<{ x: number; y: number }>({ x: 30, y: 70 });
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

      // Capped auto-detection to prevent giant 800px rings
      if (data.detected_circle && data.detected_circle.diameter_px <= 300 && data.detected_circle.diameter_px >= 40) {
        setRingDiameterPx(data.detected_circle.diameter_px);
        setRingPos({
          x: (data.detected_circle.x / data.width) * 100,
          y: (data.detected_circle.y / data.height) * 100,
        });
      } else {
        // Safe default: 120px ring placed at bottom-left corner
        setRingDiameterPx(120);
        setRingPos({ x: 25, y: 75 });
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Upload error");
    } finally {
      setUploading(false);
    }
  };

  const loadSamplePreset = async (samplePath: string, filename: string) => {
    stopCamera();
    setUploading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(samplePath);
      if (!res.ok) throw new Error("Could not load sample image file");
      const blob = await res.blob();
      const file = new File([blob], filename, { type: "image/jpeg" });
      await handleFileUpload(file);
    } catch (err: unknown) {
      setErrorMessage("Failed to load sample: " + (err instanceof Error ? err.message : String(err)));
      setUploading(false);
    }
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
      {/* Top Switcher */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-6 border-b border-slate-800 gap-4">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-teal-400">
            Select Evaluation Workflow
          </span>
          <div className="flex items-center gap-3 mt-1.5">
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
          </div>
        </div>

        {/* Reference Coin Selector */}
        <div className="flex items-center gap-2.5 bg-slate-950 p-2 px-3 rounded-xl border border-slate-800">
          <span className="text-xs text-slate-400 font-medium">Reference Standard:</span>
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

      {/* Longitudinal Indicator */}
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

      {/* Ingestion Tabs */}
      <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800 w-fit">
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
          Test Samples (3 Included)
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
          {inputTab === "upload" && !currentImageUrl && (
            <label className="w-full h-full flex flex-col items-center justify-center p-8 cursor-pointer hover:bg-slate-900/50 transition-colors">
              <div className="w-16 h-16 rounded-2xl bg-teal-500/10 text-teal-400 flex items-center justify-center mb-4 border border-teal-500/20">
                <Upload className="w-8 h-8" />
              </div>
              <p className="text-sm font-semibold text-slate-200">
                Drop skin image here, or <span className="text-teal-400 underline">browse</span>
              </p>
              <p className="text-xs text-slate-500 mt-2 text-center max-w-sm">
                Supports clinical JPG/PNG dermoscopy or phone snapshots.
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

          {inputTab === "presets" && !currentImageUrl && (
            <div className="w-full h-full p-6 flex flex-col justify-center">
              <div className="text-center mb-5">
                <span className="text-[10px] uppercase font-mono tracking-widest text-teal-400">
                  Instant Clinical Benchmark Cases
                </span>
                <h3 className="text-base font-bold text-white mt-1">
                  Select a Pre-Loaded Clinical Testing Image
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                  Click any sample below to immediately ingest, calibrate, and compute quantitative ABCDE & temporal metrics.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Case 1 */}
                <div className="bg-slate-900/80 border border-slate-800 hover:border-teal-500/50 rounded-2xl p-3 flex flex-col items-center text-center transition-all group">
                  <div className="w-full aspect-square rounded-xl overflow-hidden mb-3 bg-black border border-slate-800 relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/samples/sample_case1.jpg"
                      alt="Clinical Case 1"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <span className="absolute top-2 left-2 bg-rose-500/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                      Case 1
                    </span>
                  </div>
                  <h4 className="text-xs font-semibold text-slate-200 mb-1">
                    Nodular / Amelanotic
                  </h4>
                  <p className="text-[10px] text-slate-400 mb-3 line-clamp-2">
                    Erythematous core with dark pigment clustering.
                  </p>
                  <button
                    disabled={uploading}
                    onClick={() => loadSamplePreset("/samples/sample_case1.jpg", "sample_case1.jpg")}
                    className="w-full py-1.5 px-3 rounded-lg bg-teal-500/10 hover:bg-teal-500 text-teal-400 hover:text-slate-950 font-bold text-xs border border-teal-500/30 transition-all disabled:opacity-50"
                  >
                    {uploading ? "Loading..." : "Load Case 1"}
                  </button>
                </div>

                {/* Case 2 */}
                <div className="bg-slate-900/80 border border-slate-800 hover:border-teal-500/50 rounded-2xl p-3 flex flex-col items-center text-center transition-all group">
                  <div className="w-full aspect-square rounded-xl overflow-hidden mb-3 bg-black border border-slate-800 relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/samples/sample_case2.jpg"
                      alt="Clinical Case 2"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <span className="absolute top-2 left-2 bg-amber-500/90 text-slate-950 text-[9px] font-bold px-1.5 py-0.5 rounded">
                      Case 2
                    </span>
                  </div>
                  <h4 className="text-xs font-semibold text-slate-200 mb-1">
                    Dysplastic Spreading Macule
                  </h4>
                  <p className="text-[10px] text-slate-400 mb-3 line-clamp-2">
                    Marked ragged notched border on sun-damaged skin.
                  </p>
                  <button
                    disabled={uploading}
                    onClick={() => loadSamplePreset("/samples/sample_case2.jpg", "sample_case2.jpg")}
                    className="w-full py-1.5 px-3 rounded-lg bg-teal-500/10 hover:bg-teal-500 text-teal-400 hover:text-slate-950 font-bold text-xs border border-teal-500/30 transition-all disabled:opacity-50"
                  >
                    {uploading ? "Loading..." : "Load Case 2"}
                  </button>
                </div>

                {/* Case 3 */}
                <div className="bg-slate-900/80 border border-slate-800 hover:border-teal-500/50 rounded-2xl p-3 flex flex-col items-center text-center transition-all group">
                  <div className="w-full aspect-square rounded-xl overflow-hidden mb-3 bg-black border border-slate-800 relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/samples/sample_case3.jpg"
                      alt="Clinical Case 3"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <span className="absolute top-2 left-2 bg-teal-500/90 text-slate-950 text-[9px] font-bold px-1.5 py-0.5 rounded">
                      Case 3
                    </span>
                  </div>
                  <h4 className="text-xs font-semibold text-slate-200 mb-1">
                    Reticular Atypical Nevus
                  </h4>
                  <p className="text-[10px] text-slate-400 mb-3 line-clamp-2">
                    Classic dermoscopy with prominent pigment network.
                  </p>
                  <button
                    disabled={uploading}
                    onClick={() => loadSamplePreset("/samples/sample_case3.jpg", "sample_case3.jpg")}
                    className="w-full py-1.5 px-3 rounded-lg bg-teal-500/10 hover:bg-teal-500 text-teal-400 hover:text-slate-950 font-bold text-xs border border-teal-500/30 transition-all disabled:opacity-50"
                  >
                    {uploading ? "Loading..." : "Load Case 3"}
                  </button>
                </div>
              </div>
            </div>
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

          {/* Active Calibration Overlay Viewport */}
          {currentImageUrl && (
            <div className="relative w-full h-full flex items-center justify-center p-2 select-none overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentImageUrl}
                alt="Calibrating skin scan"
                className="max-h-[480px] w-auto object-contain rounded-xl shadow-lg pointer-events-none"
              />

              {/* Draggable & Resizable Amber Calibration Ring */}
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
                  // Ignore if clicking the resize handle
                  if ((e.target as HTMLElement).dataset.handle) return;
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
                {/* Center Anchor Point */}
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div>

                {/* Direct Visual Resize Handle Dot on Ring Rim */}
                <div
                  data-handle="resize"
                  title="Drag to resize ring"
                  className="absolute -right-1.5 w-4 h-4 rounded-full bg-white border-2 border-amber-500 shadow-md cursor-ew-resize flex items-center justify-center"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    const startX = e.clientX;
                    const startDiam = ringDiameterPx;
                    const onMouseMove = (moveEvent: MouseEvent) => {
                      const delta = (moveEvent.clientX - startX) * 2;
                      setRingDiameterPx(Math.min(Math.max(startDiam + delta, 40), 300));
                    };
                    const onMouseUp = () => {
                      window.removeEventListener("mousemove", onMouseMove);
                      window.removeEventListener("mouseup", onMouseUp);
                    };
                    window.addEventListener("mousemove", onMouseMove);
                    window.addEventListener("mouseup", onMouseUp);
                  }}
                />

                <span className="absolute -top-6 text-[10px] font-mono font-bold text-amber-300 bg-slate-950/90 px-2 py-0.5 rounded border border-amber-500/30 whitespace-nowrap pointer-events-none">
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

        {/* Right Controls */}
        <div className="lg:col-span-4 flex flex-col justify-between space-y-6 bg-slate-950/60 border border-slate-800/80 p-6 rounded-2xl">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Disc className="w-4 h-4 text-teal-400" />
              <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-wide">
                Metric Calibration
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Drag the amber circle over the coin/marker. Adjust diameter using slider or the <strong className="text-amber-300">white edge handle</strong>.
            </p>

            {/* Quick Preset Zoom Helpers */}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setRingDiameterPx(80)}
                className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300 hover:text-white hover:border-slate-700 flex items-center gap-1"
              >
                <Minimize2 className="w-3 h-3" /> Small (80px)
              </button>
              <button
                onClick={() => setRingDiameterPx(130)}
                className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-teal-300 border-teal-500/40 flex items-center gap-1"
              >
                Standard (130px)
              </button>
              <button
                onClick={() => setRingDiameterPx(220)}
                className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300 hover:text-white hover:border-slate-700 flex items-center gap-1"
              >
                <ZoomIn className="w-3 h-3" /> Large (220px)
              </button>
            </div>

            {/* Diameter Slider */}
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

            {/* Scale Ratio Readout */}
            <div className="mt-6 p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Physical Standard:</span>
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