import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  Legend,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import { Listing, PricingTiers, PropertyProfile, Provenance, SeasonalPriceTrendPoint } from '../types';
import { formatCurrency, formatDiff, formatNumber } from '../utils/math';
import { ProvenanceButton } from './ProvenanceModal';
import { percentileInc } from '../utils/math';
import {
  Rocket,
  Target,
  Crown,
  Sparkles,
  ArrowUpDown,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  Calendar,
} from 'lucide-react';

interface PriceRecommendationCardProps {
  pricing: PricingTiers;
  comps: Listing[];
  profile: PropertyProfile;
  seasonalTrend?: SeasonalPriceTrendPoint[];
  seasonalProvenance?: Provenance;
  onOpenProvenance: (p: Provenance) => void;
  onOpenExplain: () => void;
  onNextStep?: () => void;
  onPrevStep?: () => void;
}

export const PriceRecommendationCard: React.FC<PriceRecommendationCardProps> = ({
  pricing,
  comps,
  profile,
  seasonalTrend = [],
  seasonalProvenance,
  onOpenProvenance,
  onOpenExplain,
  onNextStep,
  onPrevStep,
}) => {
  const [sortField, setSortField] = useState<keyof Listing>('price');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const isDistrictWide =
    pricing.provenance.filterApplied.includes('District-wide') ||
    pricing.provenance.widenedSteps?.some((s) => s.toLowerCase().includes('district'));
  const locationLabel = isDistrictWide ? 'across DC' : `in ${profile.neighbourhood}`;

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

  // Build price distribution histogram data capped at P95 with overflow bin
  const histogramData = useMemo(() => {
    if (!pricing.prices || pricing.prices.length === 0) return [];

    const p95 = percentileInc(pricing.prices, 0.95);
    const minPrice = Math.floor(Math.min(...pricing.prices) / 25) * 25;
    const capPrice = Math.max(minPrice + 100, Math.ceil(p95 / 25) * 25);
    const binSize = 25;

    const bins: { label: string; min: number; max: number; count: number; isOverflow?: boolean }[] = [];

    for (let p = minPrice; p < capPrice; p += binSize) {
      bins.push({
        label: `$${p}–$${p + binSize}`,
        min: p,
        max: p + binSize,
        count: 0,
      });
    }

    // Overflow bin for prices >= capPrice
    const overflowBin = {
      label: `over $${capPrice}`,
      min: capPrice,
      max: Infinity,
      count: 0,
      isOverflow: true,
    };
    bins.push(overflowBin);

    pricing.prices.forEach((price) => {
      let placed = false;
      for (let i = 0; i < bins.length - 1; i++) {
        if (price >= bins[i].min && price < bins[i].max) {
          bins[i].count += 1;
          placed = true;
          break;
        }
      }
      if (!placed && price >= capPrice) {
        overflowBin.count += 1;
      }
    });

    return bins;
  }, [pricing.prices]);

  // Seasonal demand and price trend analysis
  const seasonalAnalysis = useMemo(() => {
    if (!seasonalTrend || seasonalTrend.length === 0) return null;
    const sortedByPrice = [...seasonalTrend].sort((a, b) => b.medianBookedPrice - a.medianBookedPrice);
    const peak = sortedByPrice[0];
    const trough = sortedByPrice[sortedByPrice.length - 1];
    return { peak, trough };
  }, [seasonalTrend]);

  // Empty state if pricing.n === 0
  if (pricing.n === 0) {
    return (
      <div className="p-8 sm:p-12 bg-white rounded-2xl border border-slate-200 text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-amber-600 mx-auto" />
        <h3 className="text-base sm:text-lg font-bold text-slate-900">
          Not enough similar listings
        </h3>
        <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
          Not enough similar listings: try a nearby neighbourhood or broaden your guest capacity in the Property Profile.
        </p>
        {onPrevStep && (
          <button
            type="button"
            onClick={onPrevStep}
            className="px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors min-h-[44px]"
          >
            ← Modify Property Profile
          </button>
        )}
      </div>
    );
  }

  const oneSentenceHeadline = `Charge about ${formatCurrency(
    pricing.recommendedPrice
  )}/night. Similar ${profile.bedrooms === 0 ? 'studios' : profile.bedrooms + '-bed'} ${
    profile.propertyType === 'Condo' ? 'condos' : 'properties'
  } ${locationLabel} typically charge ${formatCurrency(
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
          <p className="text-base sm:text-lg md:text-xl font-medium tracking-tight mt-1 text-teal-50">
            {oneSentenceHeadline}
          </p>
          <p className="text-xs text-teal-200 mt-1">
            Grounded directly in Inside Airbnb scraped comps; never estimated by AI.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenExplain}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-slate-900 text-xs font-semibold rounded-xl hover:bg-teal-50 transition-colors shrink-0 shadow-xs min-h-[44px]"
        >
          <Sparkles className="w-3.5 h-3.5 text-teal-700" />
          <span>Explain this to my client</span>
        </button>
      </div>

      {/* Widening Amber Banner if n < 10 or widenedSteps present */}
      {((pricing.provenance.widenedSteps && pricing.provenance.widenedSteps.length > 0) || pricing.n < 10) && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Not enough exact matches; widened to:</p>
            <p className="text-amber-800">
              {pricing.provenance.widenedSteps?.join(' → ') || 'broader criteria (n < 10)'}
            </p>
          </div>
        </div>
      )}

      {/* 2. Three Price Tiers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Launch Tier */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-slate-100 text-slate-700 rounded-lg">
                  <Rocket className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Launch Tier</h3>
              </div>
              <ProvenanceButton
                provenance={pricing.launchProvenance}
                onClick={onOpenProvenance}
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">
              40th percentile (P40) to drive rapid early booking velocity and secure initial reviews.
            </p>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 flex items-baseline justify-between">
            <div>
              <span className="text-2xl sm:text-3xl font-bold font-mono text-slate-900">
                {formatCurrency(pricing.p40)}
              </span>
              <span className="text-xs text-slate-500"> / night</span>
            </div>
            <span className="text-[11px] font-mono text-slate-600 font-medium">
              {formatDiff(pricing.p40 - pricing.recommendedPrice)} vs Market
            </span>
          </div>
        </div>

        {/* Market Tier (Recommended) */}
        <div className="p-5 bg-teal-50/50 rounded-2xl border-2 border-teal-700 shadow-sm flex flex-col justify-between relative">
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
                provenance={pricing.marketProvenance}
                onClick={onOpenProvenance}
              />
            </div>
            <p className="text-xs text-teal-900 mt-2">
              Median nightly rate (P50) representing fair market equilibrium for comparable listings.
            </p>
          </div>

          <div className="mt-5 pt-3 border-t border-teal-200/60 flex items-baseline justify-between">
            <div>
              <span className="text-2xl sm:text-3xl font-bold font-mono text-teal-950">
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
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-50 text-amber-700 rounded-lg">
                  <Crown className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Premium Tier</h3>
              </div>
              <ProvenanceButton
                provenance={pricing.premiumProvenance}
                onClick={onOpenProvenance}
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">
              75th percentile of comps rated ≥ 4.8★ (n={pricing.topRatedN}).
            </p>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 flex items-baseline justify-between">
            {pricing.topRatedN < 10 ? (
              <div className="py-2 text-xs font-semibold text-slate-500">
                Not enough top-rated listings (n={pricing.topRatedN})
              </div>
            ) : (
              <>
                <div>
                  <span className="text-2xl sm:text-3xl font-bold font-mono text-slate-900">
                    {formatCurrency(pricing.topRatedP75)}
                  </span>
                  <span className="text-xs text-slate-500"> / night</span>
                </div>
                <span className="text-[11px] font-mono text-teal-700 font-medium">
                  {formatDiff(pricing.topRatedP75 - pricing.recommendedPrice)} vs Market
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 3. Comp Price Histogram Chart */}
      <div className="p-5 sm:p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Comparable Nightly Price Distribution (n = {pricing.n})
            </h3>
            <p className="text-xs text-slate-500">
              Histogram of {pricing.n} active similar listings {locationLabel} (capped at P95)
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 shrink-0">
            n = {pricing.n} listings
          </span>
        </div>

        <div className="h-64 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={histogramData}
              margin={{ top: 20, right: 20, left: -5, bottom: 25 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: '#64748B' }}
                axisLine={{ stroke: '#CBD5E1' }}
                interval={0}
                angle={-35}
                textAnchor="end"
                unit=""
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 10, fill: '#64748B' }}
                axisLine={{ stroke: '#CBD5E1' }}
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
              <Bar dataKey="count" name="Listings" fill="#94A3B8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-100">
          X-axis: Nightly rate ($) · Y-axis: Listings count. Teal dashed line marks market median ({formatCurrency(pricing.recommendedPrice)}/nt). The middle 50% cluster spans {formatCurrency(pricing.p25)}–{formatCurrency(pricing.p75)}.
        </p>
      </div>

      {/* 4. Seasonal Demand & Historical Trend Chart */}
      {seasonalTrend.length > 0 && (
        <div className="p-5 sm:p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Seasonal Demand & Nightly Rate Trend (12 Months)
              </h3>
              <p className="text-xs text-slate-500">
                Monthly median booked rates and forward demand rate (% unavailable)
              </p>
            </div>
            {seasonalProvenance && (
              <ProvenanceButton
                provenance={seasonalProvenance}
                onClick={onOpenProvenance}
              />
            )}
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={seasonalTrend}
                margin={{ top: 15, right: 25, left: -10, bottom: 25 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis
                  dataKey="displayMonth"
                  tick={{ fontSize: 10, fill: '#64748B' }}
                  axisLine={{ stroke: '#CBD5E1' }}
                  interval={0}
                  angle={-35}
                  textAnchor="end"
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 10, fill: '#64748B' }}
                  axisLine={{ stroke: '#CBD5E1' }}
                  unit="$"
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 10, fill: '#64748B' }}
                  axisLine={{ stroke: '#CBD5E1' }}
                  unit="%"
                  domain={[0, 100]}
                />
                <Tooltip
                  formatter={(val: any, name: any) => [
                    name === 'Demand Rate' ? `${val}%` : formatCurrency(Number(val)),
                    name,
                  ]}
                  labelFormatter={(lbl) => `Month: ${lbl}`}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="medianBookedPrice"
                  name="Median Booked Price ($/night)"
                  stroke="#0F766E"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="demandRate"
                  name="Demand Rate (% nights unavailable)"
                  stroke="#F59E0B"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {seasonalAnalysis && seasonalAnalysis.peak && (
            <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-100">
              Peak rate reached <strong className="text-slate-900 font-mono">{formatCurrency(seasonalAnalysis.peak.medianBookedPrice)}/nt</strong> in {seasonalAnalysis.peak.displayMonth}, compared to seasonal trough of <strong className="text-slate-900 font-mono">{formatCurrency(seasonalAnalysis.trough.medianBookedPrice)}/nt</strong> in {seasonalAnalysis.trough.displayMonth}.
            </p>
          )}
        </div>
      )}

      {/* 5. Comps Table / Mobile Cards */}
      <div className="p-5 sm:p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Underlying Comparable Listings ({comps.length})
            </h3>
            <p className="text-xs text-slate-500">
              Active records from Inside Airbnb (Washington, DC). No host-identifying data.
            </p>
          </div>

          <span className="text-xs text-slate-500 font-mono">
            Showing {(currentPage - 1) * pageSize + 1}–
            {Math.min(currentPage * pageSize, comps.length)} of {comps.length}
          </span>
        </div>

        {/* Mobile View: Cards (avoids horizontal table clipping on 375px) */}
        <div className="md:hidden space-y-3">
          {paginatedComps.map((comp) => {
            const isTopRated = Number(comp.review_scores_rating) >= 4.8;
            return (
              <div key={comp.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-900">ID: {comp.id}</span>
                  <span className="font-mono font-bold text-teal-800 text-sm">{formatCurrency(Number(comp.price))}</span>
                </div>
                <p className="text-slate-700 truncate">{comp.property_type}</p>
                <div className="flex items-center justify-between text-slate-500 text-[11px]">
                  <span>{comp.accommodates} guests · {comp.bathrooms_text || `${comp.bathrooms || 1} bath`}</span>
                  <span className={isTopRated ? 'text-amber-800 font-semibold' : 'text-slate-600'}>
                    {Number(comp.review_scores_rating) ? Number(comp.review_scores_rating).toFixed(2) : 'N/A'}★ ({comp.number_of_reviews_ltm || 0} revs)
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block overflow-x-auto">
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
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-2 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50 min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-2 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50 min-h-[44px] min-w-[44px] flex items-center justify-center"
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
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors min-h-[44px]"
          >
            ← Back to Step 1
          </button>
        )}
        {onNextStep && (
          <button
            type="button"
            onClick={onNextStep}
            className="px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-colors ml-auto min-h-[44px]"
          >
            Continue to Step 3: Your Plan →
          </button>
        )}
      </div>
    </div>
  );
};
