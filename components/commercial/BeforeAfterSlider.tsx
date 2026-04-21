"use client";

import { useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

interface BeforeAfterSliderProps {
  beforeUrl: string;
  afterUrl: string;
  className?: string;
}

export default function BeforeAfterSlider({ beforeUrl, afterUrl, className }: BeforeAfterSliderProps) {
  const [pct, setPct] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const calcPct = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setPct(Math.round((x / rect.width) * 100));
  }, []);

  // Mouse
  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    calcPct(e.clientX);
    const onMove = (ev: MouseEvent) => { if (dragging.current) calcPct(ev.clientX); };
    const onUp   = () => { dragging.current = false; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Touch
  const onTouchStart = (e: React.TouchEvent) => {
    dragging.current = true;
    calcPct(e.touches[0].clientX);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (dragging.current) calcPct(e.touches[0].clientX);
  };
  const onTouchEnd = () => { dragging.current = false; };

  return (
    <div
      ref={containerRef}
      className={cn("ba-slider", className)}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* AVANT (full width, clipped right) */}
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={beforeUrl} alt="Avant" className="w-full h-full object-cover" draggable={false} />
        <span className="absolute top-3 left-3 text-[9px] font-black px-2 py-0.5 rounded-full bg-black/50 text-white">AVANT</span>
      </div>

      {/* APRÈS (clipped left by pct) */}
      <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 0 0 ${pct}%)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={afterUrl} alt="Après" className="w-full h-full object-cover" draggable={false} />
        <span className="absolute top-3 right-3 text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-500/90 text-white">APRÈS</span>
      </div>

      {/* Handle line */}
      <div className="ba-slider-handle" style={{ left: `${pct}%` }}>
        <div className="ba-slider-knob">
          {/* Left arrow */}
          <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
            <path d="M6 1L1 6L6 11" stroke="#475569" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {/* Right arrow */}
          <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
            <path d="M1 1L6 6L1 11" stroke="#475569" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
    </div>
  );
}
