// ============================================================
// ALTOS – Types TypeScript (mirroring Supabase schema)
// ============================================================

// ── Accounting / billing ──────────────────────────────────────────────────────

export type BillingMode = "pdf" | "peppol" | "both";

export type AccountingProvider =
  | "odoo" | "exact" | "yuki" | "accountable" | "billit" | "other";

export type IntegrationStatus = "pending" | "configured" | "active" | "error";

/** One record per provider per business.  Stores pre-config even before
 *  a real connector is implemented — connected_at stays null until then. */
export interface BusinessIntegration {
  id: string;
  business_id: string;
  provider: AccountingProvider;
  status: IntegrationStatus;
  /** Arbitrary key/value pre-config: instance URL, company code, GLN, …
   *  Sensitive secrets (API keys, OAuth tokens) must NOT be stored here. */
  config: Record<string, string>;
  display_name: string | null;  // used when provider = 'other'
  notes: string | null;
  connected_at: string | null;  // null until a real connector sets it
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────

export type EstimateStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "accepted"
  | "declined"
  | "invoiced"
  | "paid"
  | "archived";

export type JobStatus = "planned" | "in_progress" | "completed" | "cancelled";
export type PhotoType = "before" | "after" | "progress";
export type ReminderType = "quote_followup" | "unpaid" | "maintenance" | "custom";

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Business {
  id: string;
  owner_id: string;
  name: string;
  logo_url: string | null;
  activity: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  vat_number: string | null;
  siret: string | null;
  iban: string | null;
  payment_terms: string | null;
  vat_regime: "normal" | "micro" | "none";
  stripe_account_id: string | null;
  // ── Added by accounting_config migration ────────────────────────────────
  billing_mode: BillingMode;
  accounting_email: string | null;
  peppol_address: string | null;
  peppol_enabled: boolean;
  accounting_provider: AccountingProvider | null;
  // ────────────────────────────────────────────────────────────────────────
  created_at: string;
}

export interface Client {
  id: string;
  business_id: string;
  full_name: string;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  notes: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface Estimate {
  id: string;
  business_id: string;
  client_id: string | null;
  number: string | null;
  version: number;
  status: EstimateStatus;
  title: string | null;
  total_amount_ht: number;
  vat_rate: number;
  discount: number;
  discount_type: "amount" | "percent";
  notes: string | null;
  client_notes: string | null;
  payment_terms: string | null;
  validity_days: number;
  share_token: string | null;
  viewed_at: string | null;
  viewed_count: number;
  signed_at: string | null;
  signature_svg: string | null;
  signed_by_name: string | null;
  signed_by_ip: string | null;
  stripe_payment_intent_id: string | null;
  stripe_payment_link: string | null;
  paid_at: string | null;
  issued_at: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  client?: Client | null;
  items?: EstimateItem[];
  attachments?: EstimateAttachment[];
}

export interface EstimateItem {
  id: string;
  estimate_id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount: number;
  sort_order: number;
  is_section: boolean;
  created_at: string;
}

export interface LibraryItem {
  id: string;
  business_id: string;
  description: string;
  unit: string;
  unit_price: number;
  category: string | null;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: string;
  business_id: string;
  client_id: string | null;
  estimate_id: string | null;
  title: string;
  description: string | null;
  status: JobStatus;
  scheduled_date: string | null;
  completed_date: string | null;
  address: string | null;
  notes: string | null;
  estimated_hours: number | null;
  created_at: string;
  updated_at: string;
  // Joined
  client?: Client | null;
  estimate?: Estimate | null;
  photos?: JobPhoto[];
}

export interface JobPhoto {
  id: string;
  job_id: string;
  url: string;
  storage_path: string | null;
  type: PhotoType;
  caption: string | null;
  created_at: string;
}

export interface EstimateAttachment {
  id: string;
  estimate_id: string;
  url: string;
  storage_path: string;
  file_type: "photo" | "video";
  sort_order: number;
  created_at: string;
}

export interface Reminder {
  id: string;
  business_id: string;
  estimate_id: string | null;
  client_id: string | null;
  type: ReminderType;
  status: "pending" | "sent" | "dismissed";
  scheduled_at: string | null;
  last_sent_at: string | null;
  message: string | null;
  created_at: string;
  // Joined
  estimate?: Estimate | null;
  client?: Client | null;
}

// Dashboard metrics
export interface DashboardMetrics {
  pendingEstimatesAmount: number;  // CA devis en attente
  pendingReminders: number;        // Nombre de relances à faire
  activeJobs: number;              // Chantiers en cours
  monthRevenue: number;            // CA facturé ce mois (TTC)
  prevMonthRevenue: number;        // CA mois précédent (TTC)
  pendingCount: number;            // Nombre de devis en attente
  viewedNotSigned: number;         // Devis vus mais non signés
  sentCount: number;               // Devis envoyés ce mois
  acceptedCount: number;           // Devis acceptés ce mois
}

// Form types (for creation)
export interface CreateEstimateData {
  client_id?: string;
  title?: string;
  notes?: string;
  client_notes?: string;
  vat_rate?: number;
  discount?: number;
  discount_type?: "amount" | "percent";
  payment_terms?: string;
  validity_days?: number;
  items?: Omit<EstimateItem, "id" | "estimate_id" | "created_at">[];
}

export interface CreateClientData {
  full_name: string;
  company_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  notes?: string;
}
