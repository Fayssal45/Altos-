"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Camera, Upload, FileText, Trash2, X, Download, ScanLine, FolderOpen } from "lucide-react";
import toast from "react-hot-toast";
// imageCompression loaded on demand (see upload handler)

interface BusinessDocument {
  id: string;
  url: string;
  storage_path: string;
  name: string;
  doc_type: "scan" | "receipt" | "invoice" | "other";
  file_type: "image" | "pdf";
  created_at: string;
}

const DOC_TYPE_LABELS: Record<BusinessDocument["doc_type"], string> = {
  scan: "Scan",
  receipt: "Ticket de caisse",
  invoice: "Facture",
  other: "Autre",
};

const DOC_TYPE_COLORS: Record<BusinessDocument["doc_type"], string> = {
  scan: "bg-blue-100 text-blue-700",
  receipt: "bg-amber-100 text-amber-700",
  invoice: "bg-emerald-100 text-emerald-700",
  other: "bg-slate-100 text-slate-600",
};

interface DocumentsViewProps {
  businessId: string;
  initialDocuments: BusinessDocument[];
}

export default function DocumentsView({ businessId, initialDocuments }: DocumentsViewProps) {
  const supabase = createClient();
  const [documents, setDocuments] = useState<BusinessDocument[]>(initialDocuments);
  const [uploading, setUploading] = useState(false);
  const [pendingDocType, setPendingDocType] = useState<BusinessDocument["doc_type"]>("scan");
  const [showTypeSheet, setShowTypeSheet] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const scanInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChosen = async (file: File, docType: BusinessDocument["doc_type"]) => {
    if (!file) return;
    setUploading(true);
    try {
      const isImage = file.type.startsWith("image/");
      const isPdf = file.type === "application/pdf";
      const ext = file.name.split(".").pop()?.toLowerCase() || (isImage ? "jpg" : "pdf");
      const filename = `${businessId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

      let fileToUpload: File | Blob = file;
      if (isImage) {
        const imageCompression = (await import("browser-image-compression")).default;
        fileToUpload = await imageCompression(file, { maxSizeMB: 3, maxWidthOrHeight: 2048, useWebWorker: true });
      }

      const { error } = await supabase.storage
        .from("business-documents")
        .upload(filename, fileToUpload, { contentType: file.type, upsert: false });
      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage.from("business-documents").getPublicUrl(filename);

      const name = file.name.replace(/\.[^.]+$/, "") || `Document ${new Date().toLocaleDateString("fr-BE")}`;
      const { data: doc, error: dbError } = await supabase
        .from("business_documents")
        .insert({
          business_id: businessId,
          url: publicUrl,
          storage_path: filename,
          name,
          doc_type: docType,
          file_type: isPdf ? "pdf" : "image",
        })
        .select()
        .single();
      if (dbError) throw dbError;

      setDocuments((prev) => [doc as BusinessDocument, ...prev]);
      toast.success("Document enregistré !");
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || String(err);
      toast.error(`Erreur : ${msg}`);
    } finally {
      setUploading(false);
      setPendingFile(null);
      setPreviewUrl(null);
      setShowTypeSheet(false);
    }
  };

  const openTypeSheet = (file: File) => {
    const url = URL.createObjectURL(file);
    setPendingFile(file);
    setPreviewUrl(url);
    setShowTypeSheet(true);
  };

  const onScanChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) openTypeSheet(file);
    e.target.value = "";
  };

  const onGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) openTypeSheet(file);
    e.target.value = "";
  };

  const confirmUpload = () => {
    if (pendingFile) handleFileChosen(pendingFile, pendingDocType);
  };

  const handleDelete = async (doc: BusinessDocument) => {
    await supabase.storage.from("business-documents").remove([doc.storage_path]);
    await supabase.from("business_documents").delete().eq("id", doc.id);
    setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    toast.success("Document supprimé");
  };

  const grouped = documents.reduce<Record<string, BusinessDocument[]>>((acc, doc) => {
    const month = new Date(doc.created_at).toLocaleDateString("fr-BE", { month: "long", year: "numeric" });
    if (!acc[month]) acc[month] = [];
    acc[month].push(doc);
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Hidden inputs */}
      <input ref={scanInputRef} type="file" accept="image/*" capture="environment" onChange={onScanChange} className="hidden" />
      <input ref={galleryInputRef} type="file" accept="image/*,application/pdf" onChange={onGalleryChange} className="hidden" />

      {/* Header */}
      <div className="px-4 pt-5 pb-4">
        <h1 className="text-2xl font-black text-slate-900">Mes documents</h1>
        <p className="text-sm text-slate-500 mt-0.5">{documents.length} document{documents.length !== 1 ? "s" : ""} · Tickets, factures, scans</p>
      </div>

      {/* Action buttons */}
      <div className="px-4 pb-4 grid grid-cols-2 gap-3">
        <button
          onClick={() => scanInputRef.current?.click()}
          disabled={uploading}
          className="flex flex-col items-center justify-center gap-2 bg-blue-600 text-white rounded-2xl py-4 shadow-lg shadow-blue-600/25 active:scale-95 transition-transform disabled:opacity-60"
        >
          <ScanLine className="w-6 h-6" />
          <span className="text-sm font-bold">Scanner</span>
        </button>
        <button
          onClick={() => galleryInputRef.current?.click()}
          disabled={uploading}
          className="flex flex-col items-center justify-center gap-2 bg-white border-2 border-slate-200 text-slate-700 rounded-2xl py-4 active:scale-95 transition-transform disabled:opacity-60"
        >
          <Upload className="w-6 h-6" />
          <span className="text-sm font-bold">Importer</span>
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 pb-8">
        {documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
              <FolderOpen className="w-8 h-8 text-slate-300" />
            </div>
            <div>
              <p className="font-bold text-slate-700">Aucun document</p>
              <p className="text-sm text-slate-400 mt-1">Scannez un ticket ou importez une facture</p>
            </div>
          </div>
        ) : (
          Object.entries(grouped).map(([month, docs]) => (
            <div key={month} className="mb-5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 capitalize">{month}</p>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-50">
                {docs.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3 px-4 py-3.5">
                    {/* Thumbnail or icon */}
                    <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center flex-shrink-0">
                      {doc.file_type === "image"
                        ? <img src={doc.url} alt={doc.name} className="w-full h-full object-cover" />
                        : <FileText className="w-6 h-6 text-slate-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{doc.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${DOC_TYPE_COLORS[doc.doc_type]}`}>
                          {DOC_TYPE_LABELS[doc.doc_type]}
                        </span>
                        <span className="text-xs text-slate-400">
                          {new Date(doc.created_at).toLocaleDateString("fr-BE")}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center"
                      >
                        <Download className="w-4 h-4 text-slate-500" />
                      </a>
                      <button
                        onClick={() => handleDelete(doc)}
                        className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Type selection sheet */}
      {showTypeSheet && previewUrl && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => { setShowTypeSheet(false); setPendingFile(null); setPreviewUrl(null); }} />
          <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-50 bg-white rounded-t-3xl shadow-2xl">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3 mb-3" />

            {/* Preview */}
            <div className="px-4 mb-4">
              <div className="aspect-video rounded-2xl overflow-hidden bg-slate-100">
                <img src={previewUrl} alt="Aperçu" className="w-full h-full object-contain" />
              </div>
            </div>

            <div className="px-4 pb-2">
              <p className="text-sm font-bold text-slate-900 mb-3">Type de document</p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {(Object.entries(DOC_TYPE_LABELS) as [BusinessDocument["doc_type"], string][]).map(([type, label]) => (
                  <button
                    key={type}
                    onClick={() => setPendingDocType(type)}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-semibold text-sm transition-all ${
                      pendingDocType === type
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                onClick={confirmUpload}
                disabled={uploading}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-4 rounded-2xl disabled:opacity-60"
              >
                {uploading
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Enregistrement…</>
                  : <><Camera className="w-5 h-5" />Enregistrer ce document</>}
              </button>
              <button
                onClick={() => { setShowTypeSheet(false); setPendingFile(null); setPreviewUrl(null); }}
                className="w-full flex items-center justify-center gap-2 mt-2 py-3 rounded-2xl text-slate-500 font-semibold text-sm"
              >
                <X className="w-4 h-4" />
                Annuler
              </button>
            </div>
            <div className="pb-safe h-4" />
          </div>
        </>
      )}
    </div>
  );
}
