"use client";

import { useEffect, useState } from "react";
import { 
  Activity, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  Camera,
  Layers,
  History,
  Check,
  ArrowRight
} from "lucide-react";
import CaptureWorkspace from "@/components/CaptureWorkspace";

interface BackendStatus {
  status: string;
  version: string;
  cv_engine: string;
  python_version: string;
}

interface CalibrationResult {
  imageUrl: string;
  width: number;
  height: number;
  ppm: number;
  coinDiameterMm: number;
}

export default function Dashboard() {
  const [backendData, setBackendData] = useState<BackendStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"capture" | "segmentation" | "temporal">("capture");
  
  // Calibrated image result stored in state
  const [calibratedData, setCalibratedData] = useState<CalibrationResult | null>(null);

  const checkConnection = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/health", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setBackendData(data);
    } catch {
      setBackendData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  const handleCalibrationComplete = (data: CalibrationResult) => {
    setCalibratedData(data);
    // Smooth auto-transition to next tab
    setActiveTab("segmentation");
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      {/* Top Header */}
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center pb-8 border-b border-slate-800 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <Activity className="w-5 h-5" />
            </span>
            <span className="text-xs uppercase tracking-widest font-mono text-teal-400">
              CodeTheCure 2026 • Oncology Track
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            DermaTrack
            <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
              Longitudinal Nevus Engine
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Millimetric ABCDE tracking & side-by-side progression analysis for early melanoma detection.
          </p>
        </div>

        {/* Engine Status */}
        <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 p-2.5 px-4 rounded-xl shadow-inner">
          <div className="flex flex-col text-right">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
              FastAPI Vision Service
            </span>
            <span className="text-xs font-mono text-slate-300">
              {loading ? (
                "Connecting..."
              ) : backendData ? (
                <span className="text-emerald-400 flex items-center justify-end gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {backendData.cv_engine}
                </span>
              ) : (
                <span className="text-rose-400 flex items-center justify-end gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Disconnected
                </span>
              )}
            </span>
          </div>
          <button
            onClick={checkConnection}
            title="Refresh status"
            disabled={loading}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      {/* Module Progression Tabs */}
      <section className="max-w-7xl mx-auto mt-8">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setActiveTab("capture")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
              activeTab === "capture"
                ? "bg-teal-500/10 border-teal-500 text-teal-300 shadow-sm shadow-teal-500/20"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            <Camera className="w-4 h-4" />
            1. Capture & Calibrate
            {calibratedData && <Check className="w-3.5 h-3.5 text-emerald-400 ml-1" />}
          </button>

          <button
            onClick={() => setActiveTab("segmentation")}
            disabled={!calibratedData}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              activeTab === "segmentation"
                ? "bg-teal-500/10 border-teal-500 text-teal-300 shadow-sm shadow-teal-500/20"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            <Layers className="w-4 h-4" />
            2. ABCDE Extraction (Phase 3)
          </button>

          <button
            onClick={() => setActiveTab("temporal")}
            disabled={!calibratedData}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              activeTab === "temporal"
                ? "bg-teal-500/10 border-teal-500 text-teal-300 shadow-sm shadow-teal-500/20"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            <History className="w-4 h-4" />
            3. Longitudinal Diff (Phase 4)
          </button>
        </div>

        {/* Phase 2: Active Workspace */}
        {activeTab === "capture" && (
          <CaptureWorkspace onCalibrationComplete={handleCalibrationComplete} />
        )}

        {/* Phase 3 Tab View: Calibrated Target Preview */}
        {activeTab === "segmentation" && calibratedData && (
          <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 space-y-6">
            <div className="flex justify-between items-center pb-6 border-b border-slate-800">
              <div>
                <span className="text-xs uppercase font-mono text-teal-400 tracking-wider">
                  Phase 2 Hand-off Complete
                </span>
                <h2 className="text-xl font-bold text-white mt-1">Calibrated Target Staged for ABCDE</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Established Scale: <span className="text-teal-300 font-mono font-semibold">{calibratedData.ppm} px/mm</span> using a {calibratedData.coinDiameterMm}mm reference standard.
                </p>
              </div>
              <button
                onClick={() => setActiveTab("capture")}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl font-medium transition-colors"
              >
                Re-calibrate / Change Image
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div className="flex justify-center bg-slate-950 p-4 rounded-2xl border border-slate-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={calibratedData.imageUrl}
                  alt="Calibrated target"
                  className="max-h-[380px] w-auto object-contain rounded-xl shadow-lg"
                />
              </div>

              <div className="space-y-4">
                <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-3 font-mono text-xs">
                  <h4 className="text-slate-300 font-sans font-semibold text-sm">Calibrated Image Metadata</h4>
                  <div className="flex justify-between text-slate-400">
                    <span>Resolution:</span>
                    <span className="text-slate-200">{calibratedData.width} × {calibratedData.height} px</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Target Scale Ratio:</span>
                    <span className="text-teal-300 font-bold">{calibratedData.ppm} px/mm</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Physical Reference:</span>
                    <span className="text-slate-200">{calibratedData.coinDiameterMm} mm Coin</span>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-teal-500/10 border border-teal-500/30">
                  <h4 className="text-teal-300 font-semibold text-xs mb-1">Ready for Phase 3 Pipeline</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    FastAPI will now perform Otsu segmentation to isolate the lesion contour, extract dual-axis asymmetry, measure perimeter irregularity, and calculate exact millimeter diameter.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}