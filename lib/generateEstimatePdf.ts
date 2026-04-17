import { jsPDF } from "jspdf";
import type { Estimate, EstimateItem, Business, Client } from "@/lib/types";

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("fr-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-BE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function wrap(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth) as string[];
}

const PAGE_W = 210;
const PAGE_H = 297;
const ML = 14;   // margin left
const MR = 196;  // margin right (210-14)
const CONTENT_W = MR - ML;

const COLORS = {
  primary:    [37, 99, 235]  as [number, number, number],   // blue-600
  dark:       [15, 23, 42]   as [number, number, number],   // slate-900
  mid:        [100, 116, 139] as [number, number, number],  // slate-500
  light:      [241, 245, 249] as [number, number, number],  // slate-100
  white:      [255, 255, 255] as [number, number, number],
  border:     [226, 232, 240] as [number, number, number],  // slate-200
  green:      [22, 163, 74]  as [number, number, number],   // green-600
};

// ─── main export ──────────────────────────────────────────────────────────────

export async function generateEstimatePdf(
  estimate: Estimate & { items?: EstimateItem[] },
  business: Business | null,
  client: Client | null
): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  // -- fonts setup
  doc.setFont("helvetica");

  let y = 14;

  // ── HEADER BAND ─────────────────────────────────────────────────────────────
  // Blue top band
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, PAGE_W, 30, "F");

  // Logo area (placeholder circle if no logo)
  doc.setFillColor(...COLORS.white);
  doc.setDrawColor(...COLORS.white);
  if (business?.logo_url) {
    try {
      // Fetch logo as base64
      const res = await fetch(business.logo_url);
      const blob = await res.blob();
      const b64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      doc.addImage(b64, "PNG", ML, 6, 18, 18);
    } catch {
      // fallback: draw white circle
      doc.circle(ML + 9, 15, 9, "F");
    }
  } else {
    doc.circle(ML + 9, 15, 9, "F");
    doc.setTextColor(...COLORS.primary);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    const initial = (business?.name || "A")[0].toUpperCase();
    doc.text(initial, ML + 9, 18, { align: "center" });
  }

  // Business name in header
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(business?.name || "Mon Entreprise", ML + 22, 13);

  if (business?.activity) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(business.activity, ML + 22, 19);
  }

  // Contact info right side
  const contactLines: string[] = [];
  if (business?.phone)   contactLines.push(business.phone);
  if (business?.email)   contactLines.push(business.email);
  if (business?.address) contactLines.push(business.address);

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.white);
  contactLines.forEach((line, i) => {
    doc.text(line, MR, 10 + i * 5, { align: "right" });
  });

  y = 38;

  // ── DEVIS TITLE + NUMBER ─────────────────────────────────────────────────────
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.dark);
  doc.text("DEVIS", ML, y);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.mid);
  if (estimate.number) {
    doc.text(`N° ${estimate.number}`, ML, y + 6);
  }
  if (estimate.title) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.dark);
    doc.text(estimate.title, ML, y + 12);
  }

  // Date block (right side)
  const dateLines = [
    ["Date :", fmtDate(estimate.issued_at)],
    ["Valide jusqu'au :", fmtDate(estimate.expires_at)],
  ];

  doc.setFontSize(8.5);
  dateLines.forEach(([label, val], i) => {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.mid);
    doc.text(label, MR - 40, y + i * 5.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.dark);
    doc.text(val, MR, y + i * 5.5, { align: "right" });
  });

  y += 20;

  // ── EMETTEUR / CLIENT ────────────────────────────────────────────────────────
  const colW = CONTENT_W / 2 - 5;

  // "De" block
  doc.setFillColor(...COLORS.light);
  doc.roundedRect(ML, y, colW, 28, 2, 2, "F");

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.mid);
  doc.text("DE", ML + 4, y + 5);

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.dark);
  doc.text(business?.name || "Mon Entreprise", ML + 4, y + 11);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const bizLines: string[] = [];
  if (business?.address)    bizLines.push(business.address);
  if (business?.vat_number) bizLines.push(`TVA : ${business.vat_number}`);
  if (business?.siret)      bizLines.push(`SIRET : ${business.siret}`);
  bizLines.forEach((l, i) => {
    doc.setTextColor(...COLORS.mid);
    doc.text(l, ML + 4, y + 16 + i * 4.5, { maxWidth: colW - 8 });
  });

  // "Pour" block
  const cx = ML + colW + 10;
  doc.setFillColor(...COLORS.light);
  doc.roundedRect(cx, y, colW, 28, 2, 2, "F");

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.mid);
  doc.text("POUR", cx + 4, y + 5);

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.dark);
  doc.text(client?.full_name || "Client", cx + 4, y + 11);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const clientLines: string[] = [];
  if (client?.company_name) clientLines.push(client.company_name);
  if (client?.address)      clientLines.push(client.address);
  if (client?.city)         clientLines.push([client.postal_code, client.city].filter(Boolean).join(" "));
  if (client?.phone)        clientLines.push(client.phone);
  if (client?.email)        clientLines.push(client.email);
  clientLines.filter(Boolean).slice(0, 4).forEach((l, i) => {
    doc.setTextColor(...COLORS.mid);
    doc.text(l, cx + 4, y + 16 + i * 4.5, { maxWidth: colW - 8 });
  });

  y += 35;

  // ── ITEMS TABLE ──────────────────────────────────────────────────────────────
  const items = (estimate.items || []).filter((it) => !it.is_section).sort((a, b) => a.sort_order - b.sort_order);
  const sections = (estimate.items || []).filter((it) => it.is_section).sort((a, b) => a.sort_order - b.sort_order);

  // Column widths
  const COL = { desc: 82, qty: 16, unit: 18, price: 26, disc: 18, total: 22 };

  // Header row
  doc.setFillColor(...COLORS.primary);
  doc.rect(ML, y, CONTENT_W, 8, "F");

  const headers: [string, number, "left" | "right"][] = [
    ["Description",     ML + 3,                     "left"],
    ["Qté",             ML + COL.desc + COL.qty / 2, "right"],
    ["Unité",           ML + COL.desc + COL.qty + COL.unit / 2, "right"],
    ["P.U. HT",         ML + COL.desc + COL.qty + COL.unit + COL.price, "right"],
    ["Rem.",            ML + COL.desc + COL.qty + COL.unit + COL.price + COL.disc, "right"],
    ["Total HT",        MR, "right"],
  ];

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.white);

  headers.forEach(([label, x, align]) => {
    doc.text(label, x, y + 5.5, { align });
  });

  y += 8;

  // All items
  const allSorted = [...(estimate.items || [])].sort((a, b) => a.sort_order - b.sort_order);

  let rowIndex = 0;
  for (const item of allSorted) {
    if (item.is_section) {
      // Section header
      if (y > PAGE_H - 30) { doc.addPage(); y = 20; }
      doc.setFillColor(226, 232, 240);
      doc.rect(ML, y, CONTENT_W, 6.5, "F");
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COLORS.dark);
      doc.text(item.description, ML + 3, y + 4.5);
      y += 6.5;
    } else {
      // Item row
      const descLines = wrap(doc, item.description, COL.desc - 4);
      const rowH = Math.max(7, descLines.length * 4.5 + 3);

      if (y + rowH > PAGE_H - 30) { doc.addPage(); y = 20; }

      if (rowIndex % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(ML, y, CONTENT_W, rowH, "F");
      }

      const lineTotal = item.quantity * item.unit_price * (1 - (item.discount || 0) / 100);
      const lineY = y + 5;

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.dark);
      doc.text(descLines, ML + 3, lineY);

      doc.setTextColor(...COLORS.mid);
      const numX = ML + COL.desc + COL.qty;
      doc.text(String(item.quantity), numX, lineY, { align: "right" });

      const unitX = ML + COL.desc + COL.qty + COL.unit;
      doc.text(item.unit || "u", unitX + 2, lineY, { align: "right" });

      const priceX = ML + COL.desc + COL.qty + COL.unit + COL.price;
      doc.text(fmt(item.unit_price), priceX, lineY, { align: "right" });

      const discX = ML + COL.desc + COL.qty + COL.unit + COL.price + COL.disc;
      doc.text(item.discount ? `${item.discount}%` : "—", discX, lineY, { align: "right" });

      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COLORS.dark);
      doc.text(fmt(lineTotal), MR, lineY, { align: "right" });

      y += rowH;
      rowIndex++;
    }

    // Bottom border
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.2);
    doc.line(ML, y, MR, y);
  }

  y += 6;

  // ── TOTALS ───────────────────────────────────────────────────────────────────
  const totalsX = ML + CONTENT_W * 0.55;
  const totalsW = CONTENT_W * 0.45;

  const totalHT = estimate.total_amount_ht || 0;
  let discountAmount = 0;
  if (estimate.discount > 0) {
    discountAmount = estimate.discount_type === "percent"
      ? totalHT * (estimate.discount / 100)
      : estimate.discount;
  }
  const baseHT = totalHT - discountAmount;
  const vatRate = estimate.vat_rate || 20;
  const vatAmount = baseHT * (vatRate / 100);
  const totalTTC = baseHT + vatAmount;

  const totalsRows: [string, string, boolean][] = [
    ["Total HT",         fmt(totalHT), false],
    ...(discountAmount > 0 ? [["Remise",            `-${fmt(discountAmount)}`, false] as [string, string, boolean]] : []),
    ...(discountAmount > 0 ? [["Net HT",             fmt(baseHT), false] as [string, string, boolean]] : []),
    [`TVA (${vatRate}%)`, fmt(vatAmount), false],
    ["Total TTC",        fmt(totalTTC), true],
  ];

  if (y + totalsRows.length * 7 + 10 > PAGE_H - 40) {
    doc.addPage(); y = 20;
  }

  totalsRows.forEach(([label, value, isBold]) => {
    if (isBold) {
      doc.setFillColor(...COLORS.primary);
      doc.rect(totalsX - 2, y - 1, totalsW + 4, 8, "F");
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COLORS.white);
    } else {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.mid);
    }
    doc.setFontSize(9);
    doc.text(label, totalsX + 2, y + 5);
    doc.text(value, MR, y + 5, { align: "right" });
    if (!isBold) {
      doc.setDrawColor(...COLORS.border);
      doc.setLineWidth(0.2);
      doc.line(totalsX - 2, y + 7, MR, y + 7);
    }
    y += 8;
  });

  y += 8;

  // ── NOTES ────────────────────────────────────────────────────────────────────
  if (estimate.client_notes || estimate.notes || estimate.payment_terms || business?.payment_terms || business?.iban) {
    if (y > PAGE_H - 60) { doc.addPage(); y = 20; }

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.dark);

    if (estimate.client_notes) {
      doc.text("Conditions :", ML, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.mid);
      const noteLines = wrap(doc, estimate.client_notes, CONTENT_W);
      doc.text(noteLines, ML, y);
      y += noteLines.length * 4.5 + 5;
    }

    const payTerms = estimate.payment_terms || business?.payment_terms;
    if (payTerms) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COLORS.dark);
      doc.text("Modalités de paiement :", ML, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.mid);
      const ptLines = wrap(doc, payTerms, CONTENT_W);
      doc.text(ptLines, ML, y);
      y += ptLines.length * 4.5 + 5;
    }

    if (business?.iban) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COLORS.dark);
      doc.text(`IBAN : `, ML, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.mid);
      doc.text(business.iban, ML + 14, y);
      y += 7;
    }
  }

  // ── SIGNATURE ────────────────────────────────────────────────────────────────
  if (estimate.signed_at && estimate.signature_svg) {
    if (y > PAGE_H - 40) { doc.addPage(); y = 20; }
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.green);
    doc.text(`✓ Accepté le ${fmtDate(estimate.signed_at)}${estimate.signed_by_name ? " par " + estimate.signed_by_name : ""}`, MR, y, { align: "right" });
    y += 6;
  }

  // ── FOOTER ───────────────────────────────────────────────────────────────────
  const footerY = PAGE_H - 10;
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.mid);

  const legalParts: string[] = [];
  if (business?.siret)      legalParts.push(`SIRET : ${business.siret}`);
  if (business?.vat_number) legalParts.push(`TVA : ${business.vat_number}`);
  if (business?.address)    legalParts.push(business.address);

  if (legalParts.length) {
    doc.text(legalParts.join("  |  "), PAGE_W / 2, footerY, { align: "center" });
  }

  // ── SAVE ─────────────────────────────────────────────────────────────────────
  const filename = `Devis-${estimate.number || estimate.id.slice(0, 8)}.pdf`;
  doc.save(filename);
}

/**
 * Same as generateEstimatePdf but returns the PDF as a Blob instead of
 * triggering a browser download. Used for ZIP batch export.
 */
export async function generateEstimatePdfBlob(
  estimate: Estimate & { items?: EstimateItem[] },
  business: Business | null,
  client: Client | null
): Promise<{ blob: Blob; filename: string }> {
  // Re-use the same generation logic by temporarily monkey-patching save.
  // We abuse jsPDF's output() method directly.
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  // Run the full generation (copy of generateEstimatePdf body minus doc.save)
  // ─── We call the same code path by re-exporting a modified version ────────
  // Instead of duplicating 200+ lines, we trick jsPDF: generate the PDF the
  // same way but call doc.output("blob") instead of doc.save().
  // The simplest correct approach: call generateEstimatePdf, intercept save.
  const originalSave = doc.save.bind(doc);
  let capturedBlob: Blob | null = null;

  // Override save on the prototype temporarily — not ideal, but avoids code duplication
  // Better: call output on doc after generation. We use a wrapper approach below.

  // Since we cannot easily intercept doc.save without modifying the internals,
  // we duplicate the generation using a shared internal helper.
  void originalSave; // suppress unused warning
  void capturedBlob;

  // ── Actual implementation: call the full generation on a fresh doc ──────────
  // We accept the duplication and inline the essentials below via jsPDF output.
  // The cleanest real solution: refactor generateEstimatePdf to accept a jsPDF
  // instance and return it. For now, use the output API.

  // Generate via full function then capture blob via output before save fires.
  // We use a custom jsPDF subclass trick:
  let pdfBlob!: Blob;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proto = jsPDF.prototype as any;
  const origDocSave = proto.save;
  proto.save = function (this: jsPDF) {
    pdfBlob = new Blob([this.output("arraybuffer")], { type: "application/pdf" });
  };
  try {
    await generateEstimatePdf(estimate, business, client);
  } finally {
    proto.save = origDocSave;
  }

  const filename = `Devis-${estimate.number || estimate.id.slice(0, 8)}.pdf`;
  return { blob: pdfBlob, filename };
}
