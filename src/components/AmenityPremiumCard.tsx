import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  ReferenceLine,
} from 'recharts';
import { AmenityComparison, Provenance } from '../types';
import { formatCurrency } from '../utils/math';
import { ProvenanceButton } from './ProvenanceModal';
import { Sparkles, AlertCircle, Info } from 'lucide-react';

interface AmenityPremiumCardProps {
  amenities: AmenityComparison[];
  neighbourhood: string;
  onOpenProvenance: (p: Provenance) => void;
}

export const AmenityPremiumCard: React.FC<AmenityPremiumCardProps> = ({
  amenities,
  neighbourhood,
  onOpenProvenance,
}) => {
  // Sort amenities by diff descending
  const sortedAmenities = [...amenities].sort((a, b) => b.diff - a.diff);

  const highestAmenity = sortedAmenities.find((a) => !a.isLowSample && a.diff > 0);

  const headline = highestAmenity
    ? `In ${neighbourhood}, 1-bedroom listings with ${highestAmenity.label.toLowerCase()} command a +${formatCurrency(
        highestAmenity.diff
      )}/night median premium.`
    : `Median price variance for 1-bedroom active listings in ${neighbourhood} with vs without key amenities.`;

  return (
    <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-teal-50 text-teal-700 rounded-lg">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Amenity Premium Analysis (1-Bedroom Comps)
            </h3>
            <p className="text-xs text-slate-500">
              Nightly price differential for active 1-bedroom comps with vs without each amenity
            </p>
          </div>
        </div>

        <span className="text-xs text-slate-400 font-mono">
          {neighbourhood}
        </span>
      </div>

      <p className="text-xs font-medium text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200">
        {headline}
      </p>

      {/* Horizontal Bar Chart */}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={sortedAmenities}
            margin={{ top: 10, right: 30, left: 40, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
            <XAxis
              type="number"
              unit=" $"
              tick={{ fontSize: 11, fill: '#64748B' }}
              axisLine={{ stroke: '#CBD5E1' }}
            />
            <YAxis
              type="category"
              dataKey="label"
              tick={{ fontSize: 11, fill: '#334155' }}
              width={140}
              axisLine={{ stroke: '#CBD5E1' }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload as AmenityComparison;
                  return (
                    <div className="bg-slate-900 text-white p-3 rounded-xl text-xs shadow-lg space-y-1.5 max-w-xs">
                      <p className="font-bold text-sm">{data.label}</p>
                      <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-800">
                        <div>
                          <span className="text-slate-400 block">With (n={data.withN})</span>
                          <span className="font-mono font-semibold text-emerald-400">
                            {formatCurrency(data.medWith)}/nt
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Without (n={data.withoutN})</span>
                          <span className="font-mono font-semibold text-slate-300">
                            {formatCurrency(data.medWithout)}/nt
                          </span>
                        </div>
                      </div>
                      <p className="font-mono text-teal-300 font-semibold pt-1">
                        Difference: {data.diff >= 0 ? `+${formatCurrency(data.diff)}` : `-${formatCurrency(Math.abs(data.diff))}`}/night
                      </p>
                      {data.isLowSample && (
                        <p className="text-amber-400 text-[10px] flex items-center gap-1 mt-1">
                          ⚠️ Low sample (either side has n &lt; 10)
                        </p>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />
            <ReferenceLine x={0} stroke="#94A3B8" />
            <Bar dataKey="diff" radius={[0, 4, 4, 0]}>
              {sortedAmenities.map((entry, index) => {
                let fillColor = '#0F766E'; // teal
                if (entry.isLowSample) {
                  fillColor = '#CBD5E1'; // grey out if n < 10
                } else if (entry.diff < 0) {
                  fillColor = '#94A3B8';
                }
                return <Cell key={`cell-${index}`} fill={fillColor} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Amenity Breakdown List with Provenance */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-2">
        {sortedAmenities.map((amenity) => (
          <div
            key={amenity.key}
            className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
              amenity.isLowSample
                ? 'bg-slate-50 border-slate-200 text-slate-400'
                : 'bg-white border-slate-200 text-slate-800'
            }`}
          >
            <div>
              <p className="font-medium truncate max-w-[130px]">{amenity.label}</p>
              <p className="text-[10px] text-slate-500 font-mono">
                n: {amenity.withN} vs {amenity.withoutN}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={`font-mono font-bold ${
                  amenity.isLowSample
                    ? 'text-slate-400'
                    : amenity.diff >= 0
                    ? 'text-teal-800'
                    : 'text-slate-600'
                }`}
              >
                {amenity.diff >= 0 ? `+${formatCurrency(amenity.diff)}` : formatCurrency(amenity.diff)}
              </span>
              <ProvenanceButton
                provenance={amenity.provenance}
                onClick={onOpenProvenance}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Mandatory exact caption */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-start gap-2">
        <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>Association, not causation.</strong> Greyed out bars indicate low sample size where either side has fewer than 10 listings in this neighbourhood.
        </p>
      </div>
    </div>
  );
};
