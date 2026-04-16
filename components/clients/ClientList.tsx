"use client";

import { useState } from "react";
import Link from "next/link";
import { Users, Plus, Search, Phone, Mail, ChevronRight, MessageCircle } from "lucide-react";
import type { Client } from "@/lib/types";
import { Button } from "@/components/ui/button";

interface ClientListProps {
  clients: Client[];
}

export default function ClientList({ clients }: ClientListProps) {
  const [search, setSearch] = useState("");

  const filtered = clients.filter((c) =>
    c.full_name.toLowerCase().includes(search.toLowerCase()) ||
    c.company_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  // Grouper par initiale
  const grouped = filtered.reduce<Record<string, Client[]>>((acc, client) => {
    const initial = client.full_name[0].toUpperCase();
    if (!acc[initial]) acc[initial] = [];
    acc[initial].push(client);
    return acc;
  }, {});

  const sortedKeys = Object.keys(grouped).sort();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Clients</h1>
            <p className="text-sm text-slate-500">{clients.length} contact{clients.length > 1 ? "s" : ""}</p>
          </div>
          <Link href="/clients/nouveau">
            <Button size="icon">
              <Plus className="w-5 h-5" />
            </Button>
          </Link>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un client..."
            className="w-full bg-white border-2 border-slate-200 rounded-xl pl-10 pr-4 py-3 text-base focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4">
        {clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
              <Users className="w-8 h-8 text-slate-400" />
            </div>
            <div>
              <p className="font-bold text-slate-700">Aucun client</p>
              <p className="text-sm text-slate-500 mt-1">Ajoutez votre premier client</p>
            </div>
            <Link href="/clients/nouveau">
              <Button>
                <Plus className="w-4 h-4" />
                Nouveau Client
              </Button>
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center py-8 text-slate-400">Aucun résultat pour "{search}"</p>
        ) : (
          <div className="pb-6">
            {sortedKeys.map((initial) => (
              <div key={initial}>
                <div className="sticky top-0 py-1.5 bg-slate-50 z-10">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{initial}</span>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-3">
                  {grouped[initial].map((client, i) => (
                    <Link
                      key={client.id}
                      href={`/clients/${client.id}`}
                      className={`flex items-center gap-3 px-4 py-3.5 active:bg-slate-50 transition-colors ${
                        i < grouped[initial].length - 1 ? "border-b border-slate-50" : ""
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-bold text-sm">{client.full_name[0].toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{client.full_name}</p>
                        {client.company_name && (
                          <p className="text-sm text-slate-500 truncate">{client.company_name}</p>
                        )}
                        {client.phone && (
                          <p className="text-sm text-slate-400 truncate">{client.phone}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {client.phone && (
                          <a
                            href={`tel:${client.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center"
                          >
                            <Phone className="w-4 h-4 text-slate-500" />
                          </a>
                        )}
                        <ChevronRight className="w-4 h-4 text-slate-300 ml-1" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
