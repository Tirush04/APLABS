import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import { Listing, PricingTiers, PropertyProfile, Provenance } from '../types';
import { formatCurrency, formatNumber } from '../utils/math';
import { ProvenanceButton } from './ProvenanceModal';
import {
  Rocket,
  Target,
  Crown,
  Sparkles,
  ArrowUpDown,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';

interface PriceRecommendationCardProps {
  pricing: PricingTiers;
  comps: Listing[];
  profile: PropertyProfile;
  onOpenProvenance: (p: Provenance) => void;
  onOpenExplain: () => void;
  onNextStep?: () => void;
  onPrevStep?: () => void;
}

export const PriceRecommendationCard: React.FC<PriceRecommendationCardProps> = ({
  pricing,
  comps,
  profile,
  onOpenProvenance,
  onOpenExplain,
  onNextStep,
  onPrevStep,
}) => {
  // Sorting state for comps table
  const [sortField, setSortField] = useState<keyof Listing>('price');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const sortedComps = useMemo(() => {
    return [...comps].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [comps, sortField, sortDirection]);

  const totalPages = Math.ceil(sortedComps.length / pageSize);
  const paginatedComps = sortedComps.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleSort = (field: keyof Listing) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  };

  // Build price distribution histogram data
  const histogramData = useMemo(() => {
    if (!pricing.prices || pricing.prices.length === 0) return [];

    const minPrice = Math.floor(Math.min(...pricing.prices) / 25) * 25;
    const maxPrice = Math.ceil(Math.max(...pricing.prices) / 25) * 25;
    const binSize = Math.max(25, Math.ceil((maxPrice - minPrice) / 14 / 25) * 25);

    const bins: Record<string, { label: string; min: number; max: number; count: number }> = {};
    for (let p = minPrice; p <= maxPrice; p += binSize) {
      const key = `${p}`;
      bins[key] = {
        label: `$${p}–$${p + binSize}`,
        min: p,
        max: p + binSize,
        count: 0,
      };
    }

    pricing.prices.forEach((price) => {
      for (const b of Object.values(bins)) {
        if (price >= b.min && price < b.max) {
          b.count += 1;
          break;
        }
      }
    });

    return Object.values(bins).filter((b) => b.min <= Math.max(...pricing.prices) + binSize);
  }, [pricing.prices]);

  const oneSentenceHeadline = `Charge about ${formatCurrency(
    pricing.recommendedPrice
  )}/night. Similar ${profile.bedrooms}-bed ${
    profile.propertyType === 'Condo' ? 'condos' : 'properties'
  } in ${profile.neighbourhood} typically charge ${formatCurrency(
    pricing.p25
  )}–${formatCurrency(pricing.p75)} (${pricing.n} similar listings).`;

  return (
    <div className="space-y-6">
      {/* 1. Leading One-Sentence Answer */}
      <div className="p-5 md:p-6 bg-teal-900 text-white rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase tracking-wider text-teal-300 font-semibold block">
            Step 2 · Price Recommendation
          </span>
          <p className="text-lg md:text-xl font-medium tracking-tight mt-1 text-teal-50">
            {oneSentenceHeadline}
          </p>
          <p className="text-xs text-teal-200 mt-1">
            Grounded directly in Inside Airbnb scraped comps; never estimated by AI.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenExplain}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-slate-900 text-xs font-semibold rounded-xl hover:bg-teal-50 transition-colors shrink-0 shadow-xs"
        >
          <Sparkles className="w-3.5 h-3.5 text-teal-700" />
          <span>Explain this to my client</span>
        </button>
      </div>

      {/* 2. Three Price Tiers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Launch Tier */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-slate-100 text-slate-700 rounded-lg">
                  <Rocket className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Launch Tier</h3>
              </div>
              <ProvenanceButton
                provenance={pricing.provenance}
                onClick={onOpenProvenance}
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">
              40th percentile (P40) to drive rapid early booking velocity and secure initial 5-star reviews.
            </p>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 flex items-baseline justify-between">
            <div>
              <span className="text-3xl font-bold font-mono text-slate-900">
                {formatCurrency(pricing.p40)}
              </span>
              <span className="text-xs text-slate-500"> / night</span>
            </div>
            <span className="text-[11px] font-mono text-slate-500">
              -${Math.round(pricing.recommendedPrice - pricing.p40)} vs Market
            </span>
          </div>
        </div>

        {/* Market Tier (Recommended) */}
        <div className="p-5 bg-teal-50/50 rounded-2xl border-2 border-teal-700 shadow-sm transition-all flex flex-col justify-between relative">
          <div className="absolute -top-3 left-6 px-2.5 py-0.5 bg-teal-700 text-white rounded-md text-[10px] font-bold tracking-wider uppercase">
            Recommended
          </div>
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-teal-700 text-white rounded-lg">
                  <Target className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-teal-950 text-sm">Market Tier</h3>
              </div>
              <ProvenanceButton
                provenance={pricing.provenance}
                onClick={onOpenProvenance}
              />
            </div>
            <p className="text-xs text-teal-900 mt-2">
              Median nightly rate (P50) representing fair market equilibrium for comparable listings.
            </p>
          </div>

          <div className="mt-5 pt-3 border-t border-teal-200/60 flex items-baseline justify-between">
            <div>
              <span className="text-3xl font-bold font-mono text-teal-950">
                {formatCurrency(pricing.recommendedPrice)}
              </span>
              <span className="text-xs text-teal-800"> / night</span>
            </div>
            <span className="text-[11px] font-mono text-teal-900 font-medium">
              Band: {formatCurrency(pricing.p25)}–{formatCurrency(pricing.p75)}
            </span>
          </div>
        </div>

        {/* Premium Tier */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-50 text-amber-700 rounded-lg">
                  <Crown className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Premium Tier</h3>
              </div>
              <ProvenanceButton
                provenance={pricing.provenance}
                onClick={onOpenProvenance}
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">
              75th percentile of top-rated comps (rating ≥ 4.8★, n={pricing.topRatedN}) with pristine finishes.
            </p>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 flex items-baseline justify-between">
            <div>
              <span className="text-3xl font-bold font-mono text-slate-900">
                {formatCurrency(pricing.topRatedP75)}
              </span>
              <span className="text-xs text-slate-500"> / night</span>
            </div>
            <span className="text-[11px] font-mono text-teal-700 font-medium">
              +${Math.round(pricing.topRatedP75 - pricing.recommendedPrice)} vs Market
            </span>
          </div>
        </div>
      </div>

      {/* 3. Comp Price Histogram Chart */}
      <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Comparable Nightly Price Distribution
            </h3>
            <p className="text-xs text-slate-500">
              Histogram of {pricing.n} active similar listings in {profile.neighbourhood}
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
            n = {pricing.n} listings
          </span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={histogramData}
              margin={{ top: 15, right: 20, left: 0, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#64748B' }}
                axisLine={{ stroke: '#CBD5E1' }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: '#64748B' }}
                axisLine={{ stroke: '#CBD5E1' }}
                tickLine={false}
                unit=" listings"
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-slate-900 text-white p-2.5 rounded-lg text-xs shadow-md">
                        <p className="font-semibold">{data.label}</p>
                        <p className="text-teal-300 font-mono mt-0.5">
                          {data.count} listing{data.count === 1 ? '' : 's'}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              {/* Vertical Reference for Recommendation */}
              <ReferenceLine
                x={histogramData.find((b) => pricing.recommendedPrice >= b.min && pricing.recommendedPrice < b.max)?.label}
                stroke="#0F766E"
                strokeWidth={2}
                strokeDasharray="4 4"
                label={{
                  value: `Market: ${formatCurrency(pricing.recommendedPrice)}`,
                  position: 'top',
                  fill: '#0F766E',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              />
              <Bar dataKey="count" fill="#94A3B8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <p className="text-[11px] text-slate-500 mt-3 pt-3 border-t border-slate-100">
          What this means: The teal dashed line marks the recommended market rate of {formatCurrency(pricing.recommendedPrice)}/night. The typical 50% cluster ranges from {formatCurrency(pricing.p25)} to {formatCurrency(pricing.p75)}.
        </p>
      </div>

      {/* 4. Sortable Table of Comps (No host fields) */}
      <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Underlying Comparable Listings ({comps.length})
            </h3>
            <p className="text-xs text-slate-500">
              Cleaned records from Inside Airbnb (Washington, DC). No host-identifying data.
            </p>
          </div>

          <span className="text-xs text-slate-500 font-mono">
            Showing {(currentPage - 1) * pageSize + 1}–
            {Math.min(currentPage * pageSize, comps.length)} of {comps.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-y border-slate-200">
              <tr>
                <th
                  className="py-2.5 px-3 cursor-pointer hover:text-slate-900"
                  onClick={() => handleSort('id')}
                >
                  <div className="flex items-center gap-1">
                    <span>Listing ID</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-2.5 px-3">Property Type</th>
                <th
                  className="py-2.5 px-3 text-center cursor-pointer hover:text-slate-900"
                  onClick={() => handleSort('accommodates')}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Guests</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-2.5 px-3 text-center">Baths</th>
                <th
                  className="py-2.5 px-3 text-center cursor-pointer hover:text-slate-900"
                  onClick={() => handleSort('review_scores_rating')}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Rating</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  className="py-2.5 px-3 text-center cursor-pointer hover:text-slate-900"
                  onClick={() => handleSort('number_of_reviews_ltm')}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Reviews (LTM)</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  className="py-2.5 px-3 text-right cursor-pointer hover:text-slate-900"
                  onClick={() => handleSort('price')}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Price / Night</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedComps.map((comp) => {
                const isTopRated = Number(comp.review_scores_rating) >= 4.8;
                return (
                  <tr
                    key={comp.id}
                    className="hover:bg-slate-50 transition-colors font-mono"
                  >
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      {comp.id}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-700 max-w-xs truncate">
                      {comp.property_type}
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-600">
                      {comp.accommodates}
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-600 font-sans">
                      {comp.bathrooms_text || `${comp.bathrooms || 1} bath`}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                          isTopRated
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'text-slate-700'
                        }`}
                      >
                        {Number(comp.review_scores_rating)
                          ? Number(comp.review_scores_rating).toFixed(2)
                          : 'N/A'}
                        ★
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-600">
                      {comp.number_of_reviews_ltm || 0}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                      {formatCurrency(Number(comp.price))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between pt-2">
        {onPrevStep && (
          <button
            type="button"
            onClick={onPrevStep}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
          >
            ← Back to Step 1
          </button>
        )}
        {onNextStep && (
          <button
            type="button"
            onClick={onNextStep}
            className="px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-colors ml-auto"
          >
            Continue to Step 3: Your Plan →
          </button>
        )}
      </div>
    </div>
  );
};
