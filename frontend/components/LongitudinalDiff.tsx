"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  TrendingUp, 
  AlertOctagon, 
  CheckCircle2, 
  RefreshCw, 
  Sliders, 
  ArrowRight,
  ShieldCheck,
  Flame,
  Layers,
  Printer,
  FileText
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

interface LongitudinalResult {
  success: boolean;
  diff_heatmap_url: string;
  t1_diameter_mm: number;
  t2_diameter_mm: number;
  delta_diameter_mm: number;
  delta_area_percent: number;
  delta_compactness: number;
  evolution_risk_tier: string;
  clinical_velocity_summary: string;
}

interface Props {
  baselineCalibration: CalibrationData;
  baselineABCDE: ABCDEResult;
  followupCalibration?: CalibrationData | null;
  onReset: () => void;
}

export default function LongitudinalDiff({
  baselineCalibration,
  baselineABCDE,
  followupCalibration,
  onReset,
}: Props) {
  const [loading, setLoading] = useState<boolean>(true);
  const [longitudinalData, setLongitudinalData] = useState<LongitudinalResult | null>(null);
  const [t2ImageUrl, setT2ImageUrl] = useState<string | null>(null);
  const [sliderPos, setSliderPos] = useState<number>(50);
  const [viewMode, setViewMode] = useState<"slider" | "heatmap">("heatmap");
  const [showDoctorReport, setShowDoctorReport] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const executeComparison = async (t2Filename: string, t2Ppm: number, t2Url: string) => {
      setT2ImageUrl(t2Url);
      const longFormData = new FormData();
      longFormData.append("t1_filename", baselineCalibration.imageFilename);
      longFormData.append("t1_ppm", baselineCalibration.ppm.toString());
      longFormData.append("t2_filename", t2Filename);
      longFormData.append("t2_ppm", t2Ppm.toString());

      try {
        const compRes = await fetch("http://127.0.0.1:8000/api/analyze-longitudinal", {
          method: "POST",
          body: longFormData,
        });
        const compData: LongitudinalResult = await compRes.json();
        if (!isCancelled) {
          setLongitudinalData(compData);
          setLoading(false);
        }
      } catch (err) {
        console.error("Longitudinal analysis error:", err);
        if (!isCancelled) setLoading(false);
      }
    };

    if (followupCalibration) {
      executeComparison(
        followupCalibration.imageFilename,
        followupCalibration.ppm,
        followupCalibration.imageUrl
      );
    } else {
      // Benchmark Month 6 Evolved Canvas
      const canvas = document.createElement("canvas");
      canvas.width = 600;
      canvas.height = 600;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.fillStyle = "#dfb49e";
      ctx.fillRect(0, 0, 600, 600);

      // Reference Coin
      ctx.beginPath();
      ctx.arc(180, 450, 60, 0, Math.PI * 2);
      ctx.fillStyle = "#b5871f";
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = "#7c5506";
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(180, 450, 52, 0, Math.PI * 2);
      ctx.fillStyle = "#d4af37";
      ctx.fill();

      ctx.fillStyle = "#4a3202";
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("25 mm", 180, 450);

      // Evolved Asymmetric Lesion
      const moleX = 400;
      const moleY = 220;
      ctx.beginPath();
      ctx.ellipse(moleX + 8, moleY - 4, 38, 28, Math.PI / 4, 0, Math.PI * 2);
      ctx.fillStyle = "#4d2211";
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(moleX - 10, moleY + 12, 30, 22, -Math.PI / 6, 0, Math.PI * 2);
      ctx.fillStyle = "#260e05";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(moleX, moleY, 16, 0, Math.PI * 2);
      ctx.fillStyle = "#0c0401";
      ctx.fill();

      canvas.toBlob(async (blob) => {
        if (!blob || isCancelled) return;
        const file = new File([blob], "month6-benchmark.png", { type: "image/png" });
        const formData = new FormData();
        formData.append("file", file);
        formData.append("reference_diameter_mm", "25.0");

        try {
          const res = await fetch("http://127.0.0.1:8000/api/detect-marker", {
            method: "POST",
            body: formData,
          });
          const t2Data = await res.json();
          if (!isCancelled) {
            executeComparison(
              t2Data.image_filename,
              t2Data.calculated_ppm || baselineCalibration.ppm,
              t2Data.image_url
            );
          }
        } catch (e) {
          console.error(e);
        }
      }, "image/png");
    }

    return () => {
      isCancelled = true;
    };
  }, [baselineCalibration, followupCalibration]);

  // Mouse/Touch Drag handler for pixel-perfect slider
  const handleSliderMove = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    setSliderPos(Math.min(Math.max(x, 0), 100));
  };

  if (loading || !longitudinalData) {
    return (
      <div className="p-16 rounded-3xl bg-slate-900 border border-slate-800 text-center flex flex-col items-center justify-center">
        <RefreshCw className="w-10 h-10 text-teal-400 animate-spin mb-4" />
        <h3 className="text-base font-bold text-white">Running Longitudinal Registration Engine</h3>
        <p className="text-xs text-slate-400 mt-2 max-w-md">
          Aligning sequential lesion centroids, calculating pixel-difference matrices, and mapping peripheral growth velocities...
        </p>
      </div>
    );
  }

  const isCritical = longitudinalData.evolution_risk_tier.includes("CRITICAL");

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-6 border-b border-slate-800 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1 rounded-md bg-purple-500/20 text-purple-300 font-mono text-[10px] uppercase tracking-wider">
              Longitudinal Delta Engine
            </span>
            <span className="text-xs text-slate-400 font-mono">Interval: 6 Months (T1 → T2)</span>
          </div>
          <h2 className="text-2xl font-bold text-white mt-1">Morphological Evolution Analysis</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Temporal change velocity (ABCDE - Evolution Factor)
          </p>
        </div>

        <div className={`px-4 py-2.5 rounded-2xl border flex items-center gap-2.5 ${
          isCritical 
            ? "bg-rose-950/70 border-rose-800 text-rose-300 shadow-lg shadow-rose-950/40" 
            : "bg-emerald-950/60 border-emerald-800 text-emerald-300"
        }`}>
          {isCritical ? (
            <AlertOctagon className="w-6 h-6 flex-shrink-0 text-rose-400 animate-pulse" />
          ) : (
            <CheckCircle2 className="w-6 h-6 flex-shrink-0 text-emerald-400" />
          )}
          <div className="flex flex-col text-left">
            <span className="text-[10px] uppercase font-bold tracking-wider">Evolution Velocity Tier</span>
            <span className="text-xs font-bold">{longitudinalData.evolution_risk_tier}</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Comparison Viewport & Delta Readouts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Pixel-Perfect Viewport */}
        <div className="lg:col-span-7 flex flex-col justify-between bg-slate-950 rounded-2xl border border-slate-800 p-4">
          <div className="flex items-center justify-between mb-3 w-full">
            <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setViewMode("heatmap")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all font-semibold ${
                  viewMode === "heatmap" ? "bg-rose-500 text-slate-950" : "text-slate-400 hover:text-white"
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                Differential Heatmap
              </button>
              <button
                onClick={() => setViewMode("slider")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all font-semibold ${
                  viewMode === "slider" ? "bg-teal-500 text-slate-950" : "text-slate-400 hover:text-white"
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                Pixel-Perfect Slider
              </button>
            </div>
            <span className="text-[10px] font-mono text-slate-500">Centroid-Registered</span>
          </div>

          {/* Viewport Canvas */}
          <div
            ref={containerRef}
            className="relative w-full h-[400px] flex items-center justify-center overflow-hidden rounded-xl bg-slate-900 select-none cursor-ew-resize"
            onMouseMove={(e) => {
              if (viewMode === "slider" && e.buttons === 1) handleSliderMove(e.clientX);
            }}
            onClick={(e) => {
              if (viewMode === "slider") handleSliderMove(e.clientX);
            }}
          >
            {viewMode === "heatmap" ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={longitudinalData.diff_heatmap_url}
                alt="Longitudinal differential heatmap"
                className="max-h-full max-w-full object-contain rounded-xl shadow-lg"
              />
            ) : (
              /* Pixel-Perfect Clip-Path Swipe Slider (ZERO Zoom/Shift Glitch) */
              <div className="relative w-full h-full flex items-center justify-center">
                {/* Baseline Image (Full Background) */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={baselineCalibration.imageUrl}
                  alt="Baseline T1"
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                />

                {/* Evolved Image (Clipped overlay with exact identical scaling) */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={t2ImageUrl || ""}
                  alt="Followup T2"
                  style={{
                    clipPath: `inset(0 calc(100% - ${sliderPos}%) 0 0)`
                  }}
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                />

                {/* Divider Line */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white shadow-2xl pointer-events-none"
                  style={{ left: `${sliderPos}%` }}
                >
                  <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-white text-slate-950 flex items-center justify-center shadow-md font-bold text-[11px]">
                    ↔
                  </div>
                </div>

                {/* Badges */}
                <span className="absolute top-3 left-3 bg-rose-950/80 border border-rose-800 text-rose-300 text-[10px] font-bold px-2 py-0.5 rounded pointer-events-none">
                  Month 6 (Follow-up)
                </span>
                <span className="absolute top-3 right-3 bg-teal-950/80 border border-teal-800 text-teal-300 text-[10px] font-bold px-2 py-0.5 rounded pointer-events-none">
                  Month 0 (Baseline)
                </span>
              </div>
            )}
          </div>

          {/* Viewport Legend */}
          <div className="mt-4 p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
                <span className="text-rose-300 font-semibold">Red: Radial Expansion Margin</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span>
                <span className="text-amber-300 font-semibold">Yellow: T1 Baseline Margin</span>
              </span>
            </span>
            <span className="font-mono text-slate-400">Scale: {baselineCalibration.ppm} px/mm</span>
          </div>
        </div>

        {/* Right: Quantitative Delta Scores */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3 font-mono text-xs">
            {/* Metric 1: Delta Diameter */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/90 font-sans">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-teal-400" />
                  Diameter Expansion (ΔD)
                </span>
                <span className={`text-sm font-bold font-mono ${
                  longitudinalData.delta_diameter_mm > 1.5 ? "text-rose-400" : "text-teal-300"
                }`}>
                  +{longitudinalData.delta_diameter_mm} mm
                </span>
              </div>
              <div className="flex justify-between text-xs text-slate-400 mt-2 font-mono">
                <span>Month 0: {longitudinalData.t1_diameter_mm} mm</span>
                <span>→</span>
                <span className="text-white font-bold">Month 6: {longitudinalData.t2_diameter_mm} mm</span>
              </div>
            </div>

            {/* Metric 2: Delta Area % */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/90 font-sans">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-400" />
                  Radial Surface Expansion
                </span>
                <span className={`text-sm font-bold font-mono ${
                  longitudinalData.delta_area_percent > 25 ? "text-rose-400" : "text-purple-300"
                }`}>
                  +{longitudinalData.delta_area_percent}%
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 font-sans">
                Clinical Standard: Area growth exceeding &gt;20% over 6 months indicates significant dysplastic activity.
              </p>
            </div>

            {/* Metric 3: Border Degradation */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/90 font-sans">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  Border Irregularity Shift
                </span>
                <span className="text-sm font-bold font-mono text-amber-300">
                  +{longitudinalData.delta_compactness}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 font-sans">
                Progressed from smooth circumference towards lobulated, notched perimeter.
              </p>
            </div>

            {/* Assessment Card */}
            <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-800/60 font-sans">
              <h4 className="text-xs font-bold text-rose-300 mb-1 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-rose-400" />
                Clinical Progression Assessment
              </h4>
              <p className="text-xs text-rose-200/90 leading-relaxed font-sans">
                {longitudinalData.clinical_velocity_summary}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-2">
            <button
              onClick={() => setShowDoctorReport(true)}
              className="w-full py-3.5 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 transition-all active:scale-[0.98]"
            >
              <FileText className="w-4 h-4" />
              Generate Printable Clinical Doctor Report
            </button>
            <button
              onClick={onReset}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 text-xs font-medium border border-slate-800 transition-colors"
            >
              Start New Patient Scan
            </button>
          </div>
        </div>
      </div>

      {/* Printable Clinical Report Modal (Phase 5 Deliverable) */}
      {showDoctorReport && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-2xl max-w-3xl w-full p-8 shadow-2xl space-y-6 my-8 font-sans">
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-slate-200 pb-4">
              <div>
                <span className="text-[11px] font-mono font-bold tracking-widest text-teal-700 uppercase">
                  CodeTheCure 2026 • Oncology Clinical Intake
                </span>
                <h1 className="text-2xl font-bold text-slate-950 mt-1">
                  DermaTrack Longitudinal Nevus Assessment
                </h1>
                <p className="text-xs text-slate-500">
                  Automated millimetric ABCDE tracking & temporal change velocity profile.
                </p>
              </div>
              <button
                onClick={() => setShowDoctorReport(false)}
                className="text-slate-400 hover:text-slate-800 text-sm font-bold p-1"
              >
                ✕ Close
              </button>
            </div>

            {/* Patient & Calibration Summary */}
            <div className="grid grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <div>
                <span className="text-slate-500 block">Assessment Target:</span>
                <span className="font-bold text-slate-800">Right Forearm Lesion #1</span>
              </div>
              <div>
                <span className="text-slate-500 block">Monitoring Period:</span>
                <span className="font-bold text-slate-800">6 Months (T1 → T2)</span>
              </div>
              <div>
                <span className="text-slate-500 block">Calibrated Scale:</span>
                <span className="font-bold text-teal-700">{baselineCalibration.ppm} px/mm (₹5 25mm Coin)</span>
              </div>
            </div>

            {/* Clinical ABCDE Findings Table */}
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-2 uppercase tracking-wide">
                1. Biometric ABCDE Findings
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-lg border border-slate-200 bg-white">
                  <span className="text-slate-500 block font-medium">Asymmetry (A):</span>
                  <span className="text-base font-bold text-slate-900">{baselineABCDE.asymmetry_score}%</span>
                  <span className="text-[11px] text-slate-600 block mt-0.5">{baselineABCDE.asymmetry_class}</span>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 bg-white">
                  <span className="text-slate-500 block font-medium">Border (B):</span>
                  <span className="text-base font-bold text-slate-900">{baselineABCDE.border_compactness}</span>
                  <span className="text-[11px] text-slate-600 block mt-0.5">{baselineABCDE.border_class}</span>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 bg-white">
                  <span className="text-slate-500 block font-medium">Color (C):</span>
                  <span className="text-base font-bold text-slate-900">σ = {baselineABCDE.color_variegation_score}</span>
                  <span className="text-[11px] text-slate-600 block mt-0.5">{baselineABCDE.color_shades[0]}</span>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 bg-white">
                  <span className="text-slate-500 block font-medium">Diameter (D):</span>
                  <span className="text-base font-bold text-rose-700">{longitudinalData.t2_diameter_mm} mm</span>
                  <span className="text-[11px] text-slate-600 block mt-0.5">Threshold: &gt;6.0mm</span>
                </div>
              </div>
            </div>

            {/* Longitudinal Evolution Metrics */}
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-2 uppercase tracking-wide">
                2. Longitudinal Evolution (E Factor)
              </h3>
              <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/60 text-xs space-y-2">
                <div className="flex justify-between font-bold text-rose-900">
                  <span>Evolution Velocity Tier:</span>
                  <span>{longitudinalData.evolution_risk_tier}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-rose-200/60 text-slate-700">
                  <div>Δ Diameter: <span className="font-bold text-slate-900">+{longitudinalData.delta_diameter_mm} mm</span></div>
                  <div>Δ Area Expansion: <span className="font-bold text-slate-900">+{longitudinalData.delta_area_percent}%</span></div>
                  <div>Δ Compactness: <span className="font-bold text-slate-900">+{longitudinalData.delta_compactness}</span></div>
                </div>
                <p className="text-slate-600 pt-1 leading-relaxed">
                  {longitudinalData.clinical_velocity_summary}
                </p>
              </div>
            </div>

            {/* Questions for Doctor */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <h4 className="font-bold text-slate-900 mb-1">Recommended Dermatologist Questions:</h4>
              <ul className="list-disc list-inside text-slate-600 space-y-1">
                <li>Does this degree of peripheral expansion warrant a punch or excisional biopsy?</li>
                <li>What dermoscopic structures (pigment network, globules, streaks) are visible under polarized light?</li>
                <li>Should we schedule a short-interval 3-month digital dermoscopy follow-up?</li>
              </ul>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                onClick={() => window.print()}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow"
              >
                <Printer className="w-4 h-4" />
                Print / Save PDF
              </button>
              <button
                onClick={() => setShowDoctorReport(false)}
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