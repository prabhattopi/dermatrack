"use client";

import { useEffect, useState } from "react";
import { 
  Activity, 
  ShieldAlert, 
  Camera, 
  History, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  Sparkles,
  Layers
} from "lucide-react";

interface BackendStatus {
  status: string;
  version: string;
  cv_engine: string;
  python_version: string;
}

export default function Dashboard() {
  const [backendData, setBackendData] = useState<BackendStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const checkConnection = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/health", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
      const data: BackendStatus = await res.json();
      setBackendData(data);
    } catch (err: unknown) {
      setError(
        err instanceof Error 
          ? err.message 
          : "Could not connect to FastAPI server at http://127.0.0.1:8000"
      );
      setBackendData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      {/* Header Bar */}
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

        {/* Live Engine Status Badge */}
        <div className="flex items-center gap-3 bg-slate-900/90 border border-slate-800 p-2.5 px-4 rounded-xl shadow-inner">
          <div className="flex flex-col text-right">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
              FastAPI Vision Service
            </span>
            <span className="text-xs font-mono text-slate-300">
              {loading ? (
                "Testing socket..."
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

      {/* Main Workspace Preview */}
      <section className="max-w-7xl mx-auto mt-8">
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-200 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Backend Engine Unreachable</p>
              <p className="text-xs text-rose-300 mt-0.5">
                FastAPI server run nahi ho raha hai. Terminal me `cd backend && python main.py` run karein.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: New Scan */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-teal-500/40 transition-all flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center mb-4 border border-teal-500/20">
                <Camera className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-semibold text-white">Capture & Calibrate</h2>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Live camera stream ya image upload with millimeter coin scale calibration ring.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-800/60 flex justify-between items-center text-xs text-slate-500 font-mono">
              <span>MODULE 01</span>
              <span className="text-teal-400 font-medium">Ready for Phase 2 →</span>
            </div>
          </div>

          {/* Card 2: ABCDE Computer Vision */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-teal-500/40 transition-all flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-4 border border-indigo-500/20">
                <Layers className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-semibold text-white">ABCDE Segmentation</h2>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                OpenCV automated contouring, dual-axis asymmetry and border irregularity scoring.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-800/60 flex justify-between items-center text-xs text-slate-500 font-mono">
              <span>MODULE 02</span>
              <span className="text-slate-500">Phase 3</span>
            </div>
          </div>

          {/* Card 3: Temporal Evolution Diff */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-teal-500/40 transition-all flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-4 border border-purple-500/20">
                <History className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-semibold text-white">Temporal Delta Engine</h2>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Side-by-side progression slider with expansion heatmaps and clinical change velocity.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-800/60 flex justify-between items-center text-xs text-slate-500 font-mono">
              <span>MODULE 03</span>
              <span className="text-slate-500">Phase 4</span>
            </div>
          </div>
        </div>

        {/* Phase 1 Verification Checklist Banner */}
        <div className="mt-10 p-6 rounded-2xl bg-slate-900/40 border border-slate-800">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-teal-400" />
            Phase 1 Integration Checklist
          </h3>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-400">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>
              FastAPI server responding on port 8000
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>
              OpenCV & NumPy native bindings loaded
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>
              Next.js 16+ App Router UI running on port 3000
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>
              CORS & Cross-Origin API communication validated
            </li>
          </ul>
        </div>
      </section>
    </main>
  );
}