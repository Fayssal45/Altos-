"use client";

import { useState, useRef } from "react";
import { formatCurrency, formatDate, calculateVAT, calculateTTC } from "@/lib/utils";
import type { Estimate, EstimateItem, Business, Client } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Check, PenLine, X, Phone, Mail } from "lucide-react";
import toast from "react-hot-toast";

type FullEstimate = Estimate & {
  client: Client | null;
  items: EstimateItem[];
  business: Business | null;
};

export default function ClientEstimateView({ estimate }: { estimate: FullEstimate }) {
  const { business, client, items } = estimate;
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(!!estimate.signed_at);
  const [signerName, setSignerName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  const totalHT = estimate.total_amount_ht || 0;
  const vatAmount = calculateVAT(totalHT, estimate.vat_rate || 20);
  const totalTTC = calculateTTC(totalHT, estimate.vat_rate || 20);

  const isExpired = estimate.expires_at && new Date(estimate.expires_at) < new Date();
  const isDeclined = estimate.status === "declined";
  const canSign = !signed && !isExpired && !isDeclined &&
    !["paid", "accepted", "archived"].includes(estimate.status);

  // Canvas drawing
  const getPos = (e: React.TouchEvent | React.MouseEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    setDrawing(true);
    lastPosRef.current = getPos(e, canvas);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!drawing || !canvasRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx || !lastPosRef.current) return;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.stroke();
    lastPosRef.current = pos;
  };

  const endDraw = () => {
    setDrawing(false);
    lastPosRef.current = null;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  };

  const submitSignature = async () => {
    if (!signerName.trim()) {
      toast.error("Veuillez saisir votre nom");
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
    const hasSignature = imageData?.data.some((v, i) => i % 4 === 3 && v > 0);
    if (!hasSignature) {
      toast.error("Veuillez signer dans le cadre");
      return;
    }

    setSubmitting(true);
    try {
      const signatureSVG = canvas.toDataURL("image/png");
      const res = await fetch(`/api/estimates/${estimate.id}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signature_svg: signatureSVG,
          signed_by_name: signerName.trim(),
          share_token: estimate.share_token,
        }),
      });

      if (!res.ok) throw new Error("Erreur de signature");

      setSigned(true);
      setSigning(false);
      toast.success("Devis accepté et signé !");
    } catch {
      toast.error("Erreur lors de la signature");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header client */}
      <div className="bg-blue-600 text-white px-4 py-6 pt-safe">
        <div className="max-w-2xl mx-auto">
          {business?.logo_url ? (
            <img src={business.logo_url} alt={business.name} className="h-10 object-contain mb-3" />
          ) : (
            <p className="text-2xl font-black mb-1">{business?.name}</p>
          )}
          {business?.activity && (
            <p className="text-blue-200 text-sm">{business.activity}</p>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-5">
        {/* Statut */}
        {signed && (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Check className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="font-bold text-emerald-900">Devis accepté et signé</p>
              <p className="text-sm text-emerald-600">par {estimate.signed_by_name}</p>
            </div>
          </div>
        )}

        {isExpired && !signed && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
            <p className="font-bold text-red-900">Devis expiré</p>
            <p className="text-sm text-red-600">Contactez-nous pour un nouveau devis</p>
          </div>
        )}

        {/* Infos devis */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <span className="text-xs font-mono text-slate-400">{estimate.number}</span>
              <h1 className="text-xl font-black text-slate-900 mt-0.5">{estimate.title || "Devis"}</h1>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-blue-600 tabular-nums">{formatCurrency(totalTTC)}</p>
              <p className="text-xs text-slate-400">TTC</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-slate-400">Émis le</p>
              <p className="font-semibold text-slate-900">{formatDate(estimate.issued_at)}</p>
            </div>
            {estimate.expires_at && (
              <div>
                <p className="text-slate-400">Valable jusqu'au</p>
                <p className="font-semibold text-slate-900">{formatDate(estimate.expires_at)}</p>
              </div>
            )}
            {client && (
              <div className="col-span-2">
                <p className="text-slate-400">Destinataire</p>
                <p className="font-semibold text-slate-900">{client.full_name}</p>
              </div>
            )}
          </div>
        </div>

        {/* Lignes */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-50">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Détail des prestations</h2>
          </div>
          {items.map((item) => {
            if (item.is_section) {
              return (
                <div key={item.id} className="px-5 py-2.5 bg-slate-50 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{item.description}</p>
                </div>
              );
            }
            const lineTotal = item.quantity * item.unit_price * (1 - item.discount / 100);
            return (
              <div key={item.id} className="px-5 py-3.5 border-b border-slate-50 last:border-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">{item.description}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {item.quantity} {item.unit} × {formatCurrency(item.unit_price)}
                      {item.discount > 0 && ` – ${item.discount}% remise`}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-slate-900 tabular-nums flex-shrink-0">
                    {formatCurrency(lineTotal)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Totaux */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-2.5">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Total HT</span>
            <span className="font-semibold text-slate-900 tabular-nums">{formatCurrency(totalHT)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">TVA {estimate.vat_rate}%</span>
            <span className="font-semibold text-slate-900 tabular-nums">{formatCurrency(vatAmount)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-100 pt-2.5">
            <span className="font-black text-slate-900 text-lg">Total TTC</span>
            <span className="text-2xl font-black text-blue-600 tabular-nums">{formatCurrency(totalTTC)}</span>
          </div>
        </div>

        {/* Notes client */}
        {estimate.client_notes && (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
            <p className="text-sm font-bold text-amber-900 mb-1">Notes</p>
            <p className="text-sm text-amber-800 whitespace-pre-line">{estimate.client_notes}</p>
          </div>
        )}

        {/* Contact entreprise */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-sm font-bold text-slate-700 mb-3">{business?.name}</p>
          <div className="flex flex-col gap-2">
            {business?.phone && (
              <a href={`tel:${business.phone}`} className="flex items-center gap-2 text-sm text-slate-600">
                <Phone className="w-4 h-4 text-slate-400" />
                {business.phone}
              </a>
            )}
            {business?.email && (
              <a href={`mailto:${business.email}`} className="flex items-center gap-2 text-sm text-slate-600">
                <Mail className="w-4 h-4 text-slate-400" />
                {business.email}
              </a>
            )}
            {business?.siret && (
              <p className="text-xs text-slate-400">SIRET : {business.siret}</p>
            )}
            {business?.vat_number && (
              <p className="text-xs text-slate-400">TVA : {business.vat_number}</p>
            )}
          </div>
        </div>

        {/* Zone de signature */}
        {canSign && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {!signing ? (
              <div className="p-5">
                <p className="text-sm text-slate-600 mb-4 text-center">
                  Pour accepter ce devis, signez électroniquement
                </p>
                <Button
                  size="lg"
                  onClick={() => setSigning(true)}
                  className="w-full"
                >
                  <PenLine className="w-5 h-5" />
                  Accepter et signer
                </Button>
              </div>
            ) : (
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-bold text-slate-900">Votre signature</p>
                  <button onClick={() => setSigning(false)}>
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                <input
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="Votre nom complet"
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-base mb-3 focus:outline-none focus:border-blue-500"
                />

                <div className="relative border-2 border-slate-200 rounded-xl overflow-hidden bg-slate-50 mb-3">
                  <canvas
                    ref={canvasRef}
                    width={340}
                    height={120}
                    className="w-full touch-none"
                    onMouseDown={startDraw}
                    onMouseMove={draw}
                    onMouseUp={endDraw}
                    onTouchStart={startDraw}
                    onTouchMove={draw}
                    onTouchEnd={endDraw}
                  />
                  <p className="absolute inset-0 flex items-center justify-center text-slate-300 text-sm pointer-events-none select-none">
                    Signez ici avec votre doigt
                  </p>
                  <button
                    onClick={clearCanvas}
                    className="absolute top-2 right-2 text-xs text-slate-400 font-medium"
                  >
                    Effacer
                  </button>
                </div>

                <Button
                  size="lg"
                  onClick={submitSignature}
                  loading={submitting}
                  variant="success"
                  className="w-full"
                >
                  <Check className="w-5 h-5" />
                  Confirmer la signature
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="h-8" />
      </div>
    </div>
  );
}
