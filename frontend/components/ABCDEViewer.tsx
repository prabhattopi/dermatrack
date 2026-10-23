"use client";

import React, { useState, useEffect, useCallback } from "react";
import { 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  Layers, 
  RefreshCw, 
  ArrowRight,
  Eye,
  FileText,
  Printer
} from "lucide-react";

interface CalibrationData {
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

interface Props {
  calibration: CalibrationData;
  isSingleScan: boolean;
  onProceedToTemporal: (result: ABCDEResult) => void;
  onBackToCalibration: () => void;
}

export default function ABCDEViewer({ 
  calibration, 
  isSingleScan, 
  onProceedToTemporal, 
  onBackToCalibration 
}: Props) {
  const [loading, setLoading] = useState<boolean>(true);
  const [analysis, setAnalysis] = useState<ABCDEResult | null>(null);
  const [viewMode, setViewMode] = useState<"overlay" | "original" | "mask">("overlay");
  const [error, setError] = useState<string | null>(null);
  const [showSingleReport, setShowSingleReport] = useState<boolean>(false);

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("image_filename", calibration.imageFilename);
    formData.append("ppm", calibration.ppm.toString());

    try {
      const res = await fetch("http://127.0.0.1:8000/api/analyze-abcde", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.detail || "ABCDE segmentation failed");
      }

      const data: ABCDEResult = await res.json();
      setAnalysis(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error analyzing ABCDE");
    } finally {
      setLoading(false);
    }
  }, [calibration]);

  useEffect(() => {
    runAnalysis();
  }, [runAnalysis]);

  if (loading) {
    return (
      <div className="p-16 rounded-3xl bg-slate-900 border border-slate-800 text-center flex flex-col items-center justify-center">
        <RefreshCw className="w-10 h-10 text-teal-400 animate-spin mb-4" />
        <h3 className="text-base font-bold text-white">Running OpenCV Lesion Segmentation</h3>
        <p className="text-xs text-slate-400 mt-2 max-w-md">
          Executing Otsu thresholding, extracting dual-axis asymmetry moments, calculating isoperimetric compactness, and measuring true millimetric diameter...
        </p>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="p-10 rounded-3xl bg-rose-950/40 border border-rose-800 text-center flex flex-col items-center justify-center space-y-4">
        <ShieldAlert className="w-12 h-12 text-rose-400" />
        <h3 className="text-base font-bold text-rose-200">Segmentation Error</h3>
        <p className="text-xs text-rose-300 max-w-md">{error}</p>
        <div className="flex gap-3">
          <button
            onClick={runAnalysis}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs rounded-xl font-medium"
          >
            Retry Segmentation
          </button>
          <button
            onClick={onBackToCalibration}
            className="px-4 py-2 bg-teal-500 text-slate-950 text-xs font-bold rounded-xl"
          >
            Adjust Scale / Photo
          </button>
        </div>
      </div>
    );
  }

  const isHighRisk = analysis.total_abcde_risk.includes("High");
  const isModerateRisk = analysis.total_abcde_risk.includes("Moderate");

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-6 border-b border-slate-800 gap-4">
        <div>
          <span className="text-[11px] uppercase tracking-wider font-mono text-teal-400">
            OpenCV ABCDE Metric Extraction {isSingleScan && "• Baseline Mode"}
          </span>
          <h2 className="text-2xl font-bold text-white mt-1">Lesion Biometric Profile</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Calibrated at <span className="text-teal-300 font-mono">{calibration.ppm} px/mm</span> using a {calibration.coinDiameterMm}mm reference standard.
          </p>
        </div>

        {/* Clinical Risk Badge */}
        <div className={`px-4 py-2.5 rounded-2xl border flex items-center gap-2.5 ${
          isHighRisk 
            ? "bg-rose-950/60 border-rose-800 text-rose-300" 
            : isModerateRisk 
            ? "bg-amber-950/60 border-amber-800 text-amber-300"
            : "bg-emerald-950/60 border-emerald-800 text-emerald-300"
        }`}>
          {isHighRisk ? (
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-400" />
          ) : (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
          )}
          <div className="flex flex-col text-left">
            <span className="text-[10px] uppercase font-bold tracking-wider">ABCDE Risk Tier</span>
            <span className="text-xs font-bold">{analysis.total_abcde_risk}</span>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Visual Viewport */}
        <div className="lg:col-span-6 flex flex-col items-center justify-between bg-slate-950 rounded-2xl border border-slate-800 p-4">
          <div className="flex items-center gap-2 mb-3 w-full justify-between">
            <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setViewMode("overlay")}
                className={`px-3 py-1 rounded-lg transition-all ${
                  viewMode === "overlay" ? "bg-teal-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
                }`}
              >
                Contour & Axes
              </button>
              <button
                onClick={() => setViewMode("mask")}
                className={`px-3 py-1 rounded-lg transition-all ${
                  viewMode === "mask" ? "bg-teal-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
                }`}
              >
                Binary Mask
              </button>
              <button
                onClick={() => setViewMode("original")}
                className={`px-3 py-1 rounded-lg transition-all ${
                  viewMode === "original" ? "bg-teal-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
                }`}
              >
                Raw Image
              </button>
            </div>
            <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" /> Visual Layer
            </span>
          </div>

          <div className="relative w-full h-[380px] flex items-center justify-center overflow-hidden rounded-xl bg-slate-900/50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={
                viewMode === "overlay"
                  ? analysis.overlay_image_url
                  : viewMode === "mask"
                  ? analysis.mask_image_url
                  : calibration.imageUrl
              }
              alt="Lesion view"
              className="max-h-full max-w-full object-contain rounded-xl shadow-lg"
            />
          </div>

          <div className="mt-4 w-full p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Legend: <span className="text-emerald-400 font-semibold">Green = Contour</span> • <span className="text-amber-300 font-semibold">Yellow = Principal Axes</span></span>
            <span className="font-mono text-slate-300">{calibration.width} × {calibration.height} px</span>
          </div>
        </div>

        {/* Right: Detailed ABCDE Breakdown */}
        <div className="lg:col-span-6 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            {/* Metric A: Asymmetry */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/90">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center font-mono text-xs">
                    A
                  </span>
                  Asymmetry Index
                </span>
                <span className="text-xs font-mono font-bold text-teal-300">
                  {analysis.asymmetry_score}% ({analysis.asymmetry_class})
                </span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    analysis.asymmetry_score > 35 ? "bg-rose-500" : "bg-teal-400"
                  }`}
                  style={{ width: `${Math.min(analysis.asymmetry_score, 100)}%` }}
                />
              </div>
            </div>

            {/* Metric B: Border Irregularity */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/90">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center font-mono text-xs">
                    B
                  </span>
                  Border Compactness (P²/4πA)
                </span>
                <span className="text-xs font-mono font-bold text-teal-300">
                  {analysis.border_compactness}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Evaluation: <span className="text-slate-200 font-medium">{analysis.border_class}</span> (Threshold: &gt;1.35 indicates jagged notched margin).
              </p>
            </div>

            {/* Metric C: Color Variegation */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/90">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center font-mono text-xs">
                    C
                  </span>
                  Color Variegation & Spectrum
                </span>
                <span className="text-xs font-mono text-teal-300">
                  σ = {analysis.color_variegation_score}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {analysis.color_shades.map((shade, idx) => (
                  <span key={idx} className="text-[11px] bg-slate-800 px-2.5 py-1 rounded-lg text-slate-300 border border-slate-700">
                    {shade}
                  </span>
                ))}
              </div>
            </div>

            {/* Metric D: Millimeter Diameter */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/90">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center font-mono text-xs">
                    D
                  </span>
                  Physical Diameter (Scaled)
                </span>
                <span className={`text-sm font-mono font-bold ${
                  analysis.diameter_mm >= 6.0 ? "text-rose-400" : "text-emerald-400"
                }`}>
                  {analysis.diameter_mm} mm
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Standard Cutoff: &gt; 6.0 mm (Pencil eraser benchmark). Status: <span className="font-semibold text-slate-200">{analysis.diameter_risk}</span>
              </p>
            </div>
          </div>

          {/* Action Buttons: DYNAMIC BASED ON SINGLE VS LONGITUDINAL */}
          <div className="space-y-3 pt-2">
            {isSingleScan ? (
              <button
                onClick={() => setShowSingleReport(true)}
                className="w-full py-3.5 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 transition-all active:scale-[0.98]"
              >
                <FileText className="w-4 h-4" />
                Generate Baseline Doctor Intake Report (Print / PDF)
              </button>
            ) : (
              <button
                onClick={() => onProceedToTemporal(analysis)}
                className="w-full py-3.5 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 transition-all active:scale-[0.98]"
              >
                Compare with Follow-up (Phase 4 Diff)
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={onBackToCalibration}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 text-xs font-medium border border-slate-800 transition-colors"
            >
              ← Back to Calibration Viewport
            </button>
          </div>
        </div>
      </div>

      {/* Single Scan Baseline Report Modal */}
      {showSingleReport && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-2xl max-w-3xl w-full p-8 shadow-2xl space-y-6 my-8 font-sans">
            <div className="flex justify-between items-start border-b border-slate-200 pb-4">
              <div>
                <span className="text-[11px] font-mono font-bold tracking-widest text-teal-700 uppercase">
                  CodeTheCure 2026 • Oncology Clinical Intake
                </span>
                <h1 className="text-2xl font-bold text-slate-950 mt-1">
                  DermaTrack Baseline Lesion Profile
                </h1>
                <p className="text-xs text-slate-500">
                  Initial biometric record established for longitudinal melanoma surveillance.
                </p>
              </div>
              <button
                onClick={() => setShowSingleReport(false)}
                className="text-slate-400 hover:text-slate-800 text-sm font-bold p-1"
              >
                ✕ Close
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <div>
                <span className="text-slate-500 block">Assessment Target:</span>
                <span className="font-bold text-slate-800">Primary Pigmented Lesion</span>
              </div>
              <div>
                <span className="text-slate-500 block">Record Type:</span>
                <span className="font-bold text-slate-800">Baseline (Month 0)</span>
              </div>
              <div>
                <span className="text-slate-500 block">Calibrated Scale:</span>
                <span className="font-bold text-teal-700">{calibration.ppm} px/mm</span>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-2 uppercase tracking-wide">
                Biometric ABCDE Findings
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-lg border border-slate-200 bg-white">
                  <span className="text-slate-500 block font-medium">Asymmetry (A):</span>
                  <span className="text-base font-bold text-slate-900">{analysis.asymmetry_score}%</span>
                  <span className="text-[11px] text-slate-600 block mt-0.5">{analysis.asymmetry_class}</span>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 bg-white">
                  <span className="text-slate-500 block font-medium">Border (B):</span>
                  <span className="text-base font-bold text-slate-900">{analysis.border_compactness}</span>
                  <span className="text-[11px] text-slate-600 block mt-0.5">{analysis.border_class}</span>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 bg-white">
                  <span className="text-slate-500 block font-medium">Color (C):</span>
                  <span className="text-base font-bold text-slate-900">σ = {analysis.color_variegation_score}</span>
                  <span className="text-[11px] text-slate-600 block mt-0.5">{analysis.color_shades[0]}</span>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 bg-white">
                  <span className="text-slate-500 block font-medium">Diameter (D):</span>
                  <span className="text-base font-bold text-rose-700">{analysis.diameter_mm} mm</span>
                  <span className="text-[11px] text-slate-600 block mt-0.5">Cutoff: &gt;6.0mm</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-xs space-y-1.5">
              <span className="font-bold text-slate-900 block">Clinical Summary & Next Steps:</span>
              <p className="text-slate-600 leading-relaxed">
                {analysis.clinical_summary} Re-capture this exact lesion in 3 months with the same coin standard to evaluate the <strong>E (Evolution)</strong> parameter.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                onClick={() => window.print()}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow"
              >
                <Printer className="w-4 h-4" />
                Print / Save PDF
              </button>
              <button
                onClick={() => setShowSingleReport(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}