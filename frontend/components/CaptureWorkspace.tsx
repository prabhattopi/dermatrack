"use client";

import React, { useState, useRef, useEffect } from "react";
import { 
  Camera, 
  Upload, 
  RefreshCw, 
  Disc, 
  Sparkles,
  ArrowRight,
  AlertTriangle
} from "lucide-react";

interface CalibrationData {
  imageUrl: string;
  width: number;
  height: number;
  ppm: number;
  coinDiameterMm: number;
}

interface Props {
  onCalibrationComplete: (data: CalibrationData) => void;
}

const PRESET_COINS = [
  { name: "₹10 Indian Coin (27 mm)", mm: 27.0 },
  { name: "₹5 Indian Coin (25 mm)", mm: 25.0 },
  { name: "US Quarter (24.26 mm)", mm: 24.26 },
  { name: "1 Euro Coin (23.25 mm)", mm: 23.25 },
  { name: "Standard 20mm Sticker", mm: 20.0 }
];

export default function CaptureWorkspace({ onCalibrationComplete }: Props) {
  const [mode, setMode] = useState<"presets" | "upload" | "camera">("presets");
  const [selectedCoinMm, setSelectedCoinMm] = useState<number>(25.0);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [imgDimensions, setImgDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // Camera State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [streamActive, setStreamActive] = useState<boolean>(false);

  // Calibration Ring State
  const [ringDiameterPx, setRingDiameterPx] = useState<number>(120);
  const [ringPos, setRingPos] = useState<{ x: number; y: number }>({ x: 30, y: 75 }); // percentage

  const calculatedPPM = parseFloat((ringDiameterPx / selectedCoinMm).toFixed(2));

  // Camera Management
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setStreamActive(true);
      }
    } catch (err) {
      setErrorMessage("Camera access denied or unavailable: " + String(err));
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      setStreamActive(false);
    }
  };

  useEffect(() => {
    if (mode === "camera") {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [mode]);

  const captureCameraFrame = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth || 1280;
    canvas.height = videoRef.current.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], "camera-capture.png", { type: "image/png" });
        handleFileUpload(file);
      }
    }, "image/png");
  };

  // Upload to Backend
  const handleFileUpload = async (file: File) => {
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
        throw new Error(errJson?.detail || `Server responded with status ${res.status}`);
      }

      const data = await res.json();
      setImageUrl(data.image_url);
      setImgDimensions({ width: data.width, height: data.height });

      if (data.detected_circle) {
        setRingDiameterPx(data.detected_circle.diameter_px);
        const percentX = (data.detected_circle.x / data.width) * 100;
        const percentY = (data.detected_circle.y / data.height) * 100;
        setRingPos({ x: percentX, y: percentY });
      } else {
        setRingDiameterPx(120);
        setRingPos({ x: 30, y: 75 });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload error";
      setErrorMessage(msg);
    } finally {
      setUploading(false);
    }
  };

  // Generate Benchmark Test PNG using HTML5 Canvas (100% Valid Raster PNG)
  const generateBenchmarkPNG = (isEvolving: boolean) => {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 600;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Skin base tone
    ctx.fillStyle = "#e0b59f";
    ctx.fillRect(0, 0, 600, 600);

    // Subtle skin texture
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)";
      ctx.fillRect(Math.random() * 600, Math.random() * 600, 2, 2);
    }

    // 25mm Reference Coin at bottom-left
    const coinX = 180;
    const coinY = 450;
    const coinR = 60; // 120px diameter

    // Outer coin rim
    ctx.beginPath();
    ctx.arc(coinX, coinY, coinR, 0, Math.PI * 2);
    ctx.fillStyle = "#b5871f";
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#7c5506";
    ctx.stroke();

    // Inner coin face
    ctx.beginPath();
    ctx.arc(coinX, coinY, coinR - 8, 0, Math.PI * 2);
    ctx.fillStyle = "#d4af37";
    ctx.fill();

    // Text on coin
    ctx.fillStyle = "#4a3202";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("25 mm", coinX, coinY);

    // Skin Lesion (Baseline vs Evolving)
    const moleX = 400;
    const moleY = 220;

    if (!isEvolving) {
      // Baseline Case (Circular, uniform color, ~6mm diameter)
      ctx.beginPath();
      ctx.arc(moleX, moleY, 20, 0, Math.PI * 2);
      ctx.fillStyle = "#482613";
      ctx.fill();

      // Inner subtle gradient
      ctx.beginPath();
      ctx.arc(moleX - 3, moleY - 2, 12, 0, Math.PI * 2);
      ctx.fillStyle = "#331606";
      ctx.fill();
    } else {
      // Evolving Case (Asymmetrical, notched border, multi-tone color, ~12mm diameter)
      ctx.beginPath();
      ctx.ellipse(moleX + 10, moleY - 5, 38, 28, Math.PI / 4, 0, Math.PI * 2);
      ctx.fillStyle = "#5c2b18";
      ctx.fill();

      // Second dark asymmetrical lobule
      ctx.beginPath();
      ctx.ellipse(moleX - 12, moleY + 10, 26, 20, -Math.PI / 6, 0, Math.PI * 2);
      ctx.fillStyle = "#261105";
      ctx.fill();

      // Deep pigmented core
      ctx.beginPath();
      ctx.arc(moleX, moleY, 14, 0, Math.PI * 2);
      ctx.fillStyle = "#0d0502";
      ctx.fill();
    }

    // Convert Canvas to standard PNG Blob & upload
    canvas.toBlob((blob) => {
      if (blob) {
        const name = isEvolving ? "case2-evolving-month6.png" : "case1-baseline-month0.png";
        const file = new File([blob], name, { type: "image/png" });
        handleFileUpload(file);
      }
    }, "image/png");
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl">
      {/* Tab Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
          <button
            onClick={() => setMode("presets")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-all ${
              mode === "presets" 
                ? "bg-teal-500 text-slate-950 font-semibold shadow-lg shadow-teal-500/20" 
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            1-Click Benchmark Cases
          </button>
          <button
            onClick={() => setMode("upload")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-all ${
              mode === "upload" 
                ? "bg-teal-500 text-slate-950 font-semibold shadow-lg shadow-teal-500/20" 
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Upload className="w-4 h-4" />
            Upload File
          </button>
          <button
            onClick={() => setMode("camera")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-all ${
              mode === "camera" 
                ? "bg-teal-500 text-slate-950 font-semibold shadow-lg shadow-teal-500/20" 
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Camera className="w-4 h-4" />
            Live Camera
          </button>
        </div>

        {/* Reference Coin Selector */}
        <div className="flex items-center gap-2.5">
          <span className="text-xs text-slate-400 font-medium">Reference Scale:</span>
          <select
            value={selectedCoinMm}
            onChange={(e) => setSelectedCoinMm(parseFloat(e.target.value))}
            className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 outline-none focus:border-teal-500"
          >
            {PRESET_COINS.map((c) => (
              <option key={c.name} value={c.mm}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {errorMessage && (
        <div className="mt-4 p-3 bg-rose-950/50 border border-rose-800 rounded-xl text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Interaction Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-6">
        {/* Left Column: Viewport / Input */}
        <div className="lg:col-span-8 flex flex-col items-center justify-center min-h-[460px] bg-slate-950 rounded-2xl border border-slate-800/80 relative overflow-hidden">
          {mode === "presets" && !imageUrl && (
            <div className="p-8 w-full max-w-lg space-y-4 text-center">
              <h3 className="text-base font-bold text-white mb-2">
                Select Benchmark Lesion Case
              </h3>
              <p className="text-xs text-slate-400 mb-6">
                Instant test samples calibrated with standard ₹5 (25mm) scale for hackathon demonstration.
              </p>

              <div className="grid grid-cols-1 gap-4">
                <button
                  onClick={() => generateBenchmarkPNG(false)}
                  className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-teal-500/60 text-left transition-all hover:translate-y-[-2px] group"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-teal-300">Case A: Baseline Mole (Month 0)</span>
                    <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400">Regular Nevus</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    Uniform circular border, symmetric pigment distribution, ~5.2mm diameter.
                  </p>
                </button>

                <button
                  onClick={() => generateBenchmarkPNG(true)}
                  className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-amber-500/60 text-left transition-all hover:translate-y-[-2px] group"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-amber-300">Case B: Longitudinal Follow-up (Month 6)</span>
                    <span className="text-[10px] bg-rose-950/80 border border-rose-800 text-rose-300 px-2 py-0.5 rounded">Evolving Lesion</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    Progressive radial growth, multi-tone pigmentation, irregular borders ({">"}9.5mm diameter).
                  </p>
                </button>
              </div>
            </div>
          )}

          {mode === "upload" && !imageUrl && (
            <label className="w-full h-full flex flex-col items-center justify-center p-8 cursor-pointer hover:bg-slate-900/50 transition-colors">
              <div className="w-16 h-16 rounded-2xl bg-teal-500/10 text-teal-400 flex items-center justify-center mb-4 border border-teal-500/20">
                <Upload className="w-8 h-8" />
              </div>
              <p className="text-sm font-semibold text-slate-200">
                Drop your skin image here, or <span className="text-teal-400 underline">browse</span>
              </p>
              <p className="text-xs text-slate-500 mt-2 text-center max-w-sm">
                Supports standard PNG and JPEG images with a visible circular coin marker.
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

          {mode === "camera" && !imageUrl && (
            <div className="relative w-full h-full flex flex-col items-center justify-center p-4">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full max-h-[460px] object-cover rounded-xl"
              />
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-64 h-64 border-2 border-dashed border-teal-400/50 rounded-full animate-pulse flex items-center justify-center">
                  <span className="text-[10px] text-teal-300 font-mono uppercase bg-slate-950/80 px-2 py-0.5 rounded">
                    Center Lesion & Coin Here
                  </span>
                </div>
              </div>
              <button
                onClick={captureCameraFrame}
                className="mt-4 px-6 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold rounded-xl text-xs flex items-center gap-2 shadow-lg transition-transform active:scale-95"
              >
                <Camera className="w-4 h-4" />
                Capture Snapshot
              </button>
            </div>
          )}

          {/* Active Calibrator Viewport */}
          {imageUrl && (
            <div className="relative w-full h-full flex items-center justify-center p-2 select-none">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt="Lesion to calibrate"
                className="max-h-[480px] w-auto object-contain rounded-xl shadow-lg"
              />

              {/* Interactive Calibration Ring */}
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

        {/* Right Column: Calibration Controls & Readouts */}
        <div className="lg:col-span-4 flex flex-col justify-between space-y-6 bg-slate-950/60 border border-slate-800/80 p-6 rounded-2xl">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Disc className="w-4 h-4 text-teal-400" />
              <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-wide">
                Metric Calibration
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Drag the amber ring over the reference coin. Adjust the diameter slider until it matches the coin boundary to establish true millimeter scale.
            </p>

            {/* Slider to adjust ring size manually */}
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

            {/* Calculated Scale Metrics Card */}
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

          {/* Action buttons */}
          <div className="space-y-3">
            {imageUrl && (
              <button
                onClick={() => {
                  setImageUrl(null);
                  setErrorMessage(null);
                  if (mode === "camera") startCamera();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium border border-slate-800 transition-colors"
              >
                Choose Another Image / Preset
              </button>
            )}

            <button
              disabled={!imageUrl}
              onClick={() => {
                if (imageUrl) {
                  onCalibrationComplete({
                    imageUrl,
                    width: imgDimensions.width,
                    height: imgDimensions.height,
                    ppm: calculatedPPM,
                    coinDiameterMm: selectedCoinMm,
                  });
                }
              }}
              className="w-full py-3 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 transition-all active:scale-[0.98]"
            >
              Confirm Scale & Proceed to ABCDE
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}