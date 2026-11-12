import React from 'react';
import { Provenance } from '../types';
import { formatPercent } from '../utils/math';
import { ProvenanceButton } from './ProvenanceModal';
import { OFFICIAL_DLCP_URL } from '../config/data';
import {
  ShieldAlert,
  Award,
  Home,
  ExternalLink,
  Building,
  FileCheck,
} from 'lucide-react';

interface CompetitionCardProps {
  neighbourhood: string;
  totalListings: number;
  entireHomeShare: number;
  licenseShare: number;
  superhostShare: number;
  provenance: Provenance;
  onOpenProvenance: (p: Provenance) => void;
}

export const CompetitionCard: React.FC<CompetitionCardProps> = ({
  neighbourhood,
  totalListings,
  entireHomeShare,
  licenseShare,
  superhostShare,
  provenance,
  onOpenProvenance,
}) => {
  return (
    <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-teal-50 text-teal-700 rounded-lg">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Competition & DLCP Compliance Density
            </h3>
            <p className="text-xs text-slate-500">
              Data-grounded compliance markers for active listings in {neighbourhood}
            </p>
          </div>
        </div>

        <ProvenanceButton
          provenance={provenance}
          onClick={onOpenProvenance}
        />
      </div>

      {/* 4 Compliance Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Active Listings */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold uppercase">
            <Building className="w-3.5 h-3.5" />
            <span>Active Listings</span>
          </div>
          <p className="text-2xl font-bold font-mono text-slate-900 mt-2">
            {totalListings}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">all room types in neighbourhood</p>
        </div>

        {/* Entire Home Share */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold uppercase">
            <Home className="w-3.5 h-3.5" />
            <span>Entire Home Share</span>
          </div>
          <p className="text-2xl font-bold font-mono text-slate-900 mt-2">
            {formatPercent(entireHomeShare)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">vs private/shared rooms</p>
        </div>

        {/* License Share */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold uppercase">
            <FileCheck className="w-3.5 h-3.5 text-teal-700" />
            <span>Licensed Share</span>
          </div>
          <p className="text-2xl font-bold font-mono text-teal-800 mt-2">
            {formatPercent(licenseShare)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">listings showing a licence number</p>
        </div>

        {/* Superhost Share */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold uppercase">
            <Award className="w-3.5 h-3.5 text-amber-600" />
            <span>Superhost Share</span>
          </div>
          <p className="text-2xl font-bold font-mono text-slate-900 mt-2">
            {formatPercent(superhostShare)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">listings whose host is a Superhost</p>
        </div>
      </div>

      {/* External Reference Link to Official DC DLCP (No model regulatory hallucination) */}
      <div className="p-4 bg-teal-50/60 border border-teal-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div>
          <p className="font-semibold text-teal-950">
            District of Columbia Short-Term Rental Regulations (DC DLCP)
          </p>
          <p className="text-teal-900 mt-0.5">
            Advisors must verify current zoning, registration, and inspection requirements through official DC Department of Licensing and Consumer Protection portals.
          </p>
        </div>

        <a
          href={OFFICIAL_DLCP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-800 text-white font-semibold rounded-lg hover:bg-teal-900 transition-colors shrink-0 min-h-[44px]"
        >
          <span>Official DC DLCP Guidelines</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
};
