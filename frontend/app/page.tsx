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
  Check 
} from "lucide-react";
import CaptureWorkspace from "@/components/CaptureWorkspace";
import ABCDEViewer from "@/components/ABCDEViewer";
import LongitudinalDiff from "@/components/LongitudinalDiff";

interface BackendStatus {
  status: string;
  version: string;
  cv_engine: string;
  python_version: string;
}

interface CalibrationResult {
  imageUrl: string;
  imageFilename: string;
  width: number;
  height: number;
  ppm: number;
  coinDiameterMm: number;
}

interface ABCDEResult {
  success: boolean;
  overlay_image_url: string;
  mask_image_url: string;
  asymmetry_score: number;
  asymmetry_class: string;
  border_compactness: number;
  border_class: string;
  color_variegation_score: number;
  color_shades: string[];
  diameter_mm: number;
  diameter_risk: string;
  total_abcde_risk: string;
  clinical_summary: string;
}

export default function Dashboard() {
  const [backendData, setBackendData] = useState<BackendStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"capture" | "segmentation" | "temporal">("capture");
  
  // Stored state
  const [calibratedT1, setCalibratedT1] = useState<CalibrationResult | null>(null);
  const [calibratedT2, setCalibratedT2] = useState<CalibrationResult | null>(null);
  const [abcdeResult, setAbcdeResult] = useState<ABCDEResult | null>(null);

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

  const handleCalibrationComplete = (t1: CalibrationResult, t2?: CalibrationResult | null) => {
    setCalibratedT1(t1);
    setCalibratedT2(t2 || null);
    setActiveTab("segmentation");
  };

  const handleProceedToTemporal = (result: ABCDEResult) => {
    setAbcdeResult(result);
    setActiveTab("temporal");
  };

  const handleReset = () => {
    setCalibratedT1(null);
    setCalibratedT2(null);
    setAbcdeResult(null);
    setActiveTab("capture");
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      {/* Header */}
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

      {/* Tabs */}
      <section className="max-w-7xl mx-auto mt-8">
        <div className="flex flex-wrap items-center gap-3 mb-6">
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
            {calibratedT1 && <Check className="w-3.5 h-3.5 text-emerald-400 ml-1" />}
          </button>

          <button
            onClick={() => setActiveTab("segmentation")}
            disabled={!calibratedT1}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              activeTab === "segmentation"
                ? "bg-teal-500/10 border-teal-500 text-teal-300 shadow-sm shadow-teal-500/20"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            <Layers className="w-4 h-4" />
            2. ABCDE Extraction
            {abcdeResult && <Check className="w-3.5 h-3.5 text-emerald-400 ml-1" />}
          </button>

          <button
            onClick={() => setActiveTab("temporal")}
            disabled={!abcdeResult}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              activeTab === "temporal"
                ? "bg-teal-500/10 border-teal-500 text-teal-300 shadow-sm shadow-teal-500/20"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            <History className="w-4 h-4" />
            3. Longitudinal Diff
          </button>
        </div>

        {/* Tab Views */}
        {activeTab === "capture" && (
          <CaptureWorkspace onCalibrationComplete={handleCalibrationComplete} />
        )}

      {/* Tab 2: ABCDE Extraction */}
        {activeTab === "segmentation" && calibratedT1 && (
          <ABCDEViewer
            calibration={calibratedT1}
            isSingleScan={!calibratedT2}
            onProceedToTemporal={handleProceedToTemporal}
            onBackToCalibration={() => setActiveTab("capture")}
          />
        )}

        {activeTab === "temporal" && calibratedT1 && abcdeResult && (
          <LongitudinalDiff
            baselineCalibration={calibratedT1}
            baselineABCDE={abcdeResult}
            followupCalibration={calibratedT2}
            onReset={handleReset}
          />
        )}
      </section>
    </main>
  );
}