import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { INSIDE_AIRBNB_DATA_URL, EXPECTED_LISTING_COLUMNS } from '../config/data';
import { Listing } from '../types';
import {
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ShieldCheck,
  Calculator,
  Table,
} from 'lucide-react';

interface DataMethodTabProps {
  comps?: Listing[];
}

const COLUMN_DESCRIPTIONS: { name: string; type: string; description: string }[] = [
  { name: 'id', type: 'string', description: 'Unique Airbnb listing identifier' },
  { name: 'listing_url', type: 'string', description: 'Canonical URL to the public Airbnb listing' },
  { name: 'scrape_id', type: 'string', description: 'Inside Airbnb scrape job run identifier' },
  { name: 'last_scraped', type: 'date', description: 'Date listing was scraped from Airbnb' },
  { name: 'source', type: 'string', description: 'Data pipeline source tag' },
  { name: 'name', type: 'string', description: 'Public listing title and headline' },
  { name: 'description', type: 'string', description: 'Listing narrative description text' },
  { name: 'neighbourhood_cleansed', type: 'string', description: 'Official DC neighbourhood designation' },
  { name: 'property_type', type: 'string', description: 'Detailed property architectural category' },
  { name: 'room_type', type: 'string', description: 'Entire home/apt, Private room, or Shared room' },
  { name: 'accommodates', type: 'integer', description: 'Maximum guest capacity' },
  { name: 'bathrooms', type: 'float', description: 'Number of full and half bathrooms' },
  { name: 'bathrooms_text', type: 'string', description: 'Raw textual bathroom specification' },
  { name: 'bedrooms', type: 'integer', description: 'Bedroom count (0 designates Studio)' },
  { name: 'beds', type: 'integer', description: 'Count of physical beds' },
  { name: 'amenities', type: 'json array', description: 'List of features and amenities provided' },
  { name: 'price', type: 'float', description: 'Current published nightly rate in USD' },
  { name: 'minimum_nights', type: 'integer', description: 'Minimum booking duration requirement' },
  { name: 'maximum_nights', type: 'integer', description: 'Maximum allowed booking duration' },
  { name: 'availability_365', type: 'integer', description: 'Nights available over the next 365 days' },
  { name: 'number_of_reviews', type: 'integer', description: 'Total lifetime guest reviews' },
  { name: 'number_of_reviews_ltm', type: 'integer', description: 'Reviews received in last 12 months' },
  { name: 'review_scores_rating', type: 'float', description: 'Overall guest rating (0.00–5.00)' },
  { name: 'review_scores_accuracy', type: 'float', description: 'Accuracy sub-score rating (0.00–5.00)' },
  { name: 'review_scores_cleanliness', type: 'float', description: 'Cleanliness sub-score rating (0.00–5.00)' },
  { name: 'review_scores_checkin', type: 'float', description: 'Check-in sub-score rating (0.00–5.00)' },
  { name: 'review_scores_communication', type: 'float', description: 'Host communication rating (0.00–5.00)' },
  { name: 'review_scores_location', type: 'float', description: 'Location rating (0.00–5.00)' },
  { name: 'review_scores_value', type: 'float', description: 'Value for money rating (0.00–5.00)' },
  { name: 'license', type: 'string', description: 'DC DLCP short-term rental license number' },
  { name: 'host_is_superhost', type: 'string (t/f)', description: 'Whether the host holds Airbnb Superhost badge' },
  { name: 'estimated_revenue_l365d', type: 'float', description: 'Inside Airbnb model estimated revenue (USD/year)' },
  { name: 'estimated_booked_nights_l365d', type: 'integer', description: 'Inside Airbnb model estimated booked nights' },
];

export const DataMethodTab: React.FC<DataMethodTabProps> = ({ comps = [] }) => {
  const {
    cleaningLog,
    aiGuardLogs,
    downloadCleanedCsv,
    downloadCompsCsv,
    uploadCustomListings,
    loadSource,
    detectedSource,
    scrapeDate,
    listings,
  } = useData();

  const [uploadStatus, setUploadStatus] = useState<{
    success?: boolean;
    message?: string;
  } | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus(null);

    const result = await uploadCustomListings(file);
    setUploadStatus(result);
    setIsUploading(false);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* 1. Header & Source Attribution */}
      <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase tracking-wider text-teal-800 font-semibold block">
            Transparency & Auditability
          </span>
          <h2 className="text-xl font-bold text-slate-900 mt-1">
            Data Source, Methodology & Mathematical Formulas
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-slate-600">
              Active Source: <strong className="text-teal-900">{detectedSource}</strong> ({loadSource})
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-600 font-mono">
              Scrape: {scrapeDate} · {listings.length.toLocaleString()} active listings
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {comps.length > 0 && (
            <button
              type="button"
              onClick={() => downloadCompsCsv(comps)}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-teal-900 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition-colors shrink-0 min-h-[44px]"
            >
              <Download className="w-3.5 h-3.5 text-teal-700" />
              <span>Download Similar Comps ({comps.length} rows)</span>
            </button>
          )}

          <button
            type="button"
            onClick={downloadCleanedCsv}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors shrink-0 min-h-[44px]"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Download Full Cleaned CSV ({listings.length} rows)</span>
          </button>
        </div>
      </div>

      {/* 2. Upload Newer Cleaned File (Keyboard Accessible) */}
      <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-teal-700" />
            <h3 className="text-sm font-bold text-slate-900">
              Upload a Newer Cleaned CSV
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {EXPECTED_LISTING_COLUMNS.length} expected columns
          </span>
        </div>

        <p className="text-xs text-slate-600">
          Upload an updated scrape file. The system validates all 33 required columns and ensures non-empty listings. If validation fails, existing data is safely preserved.
        </p>

        <div className="flex items-center gap-3 pt-2">
          <label className="relative inline-flex items-center gap-2 px-4 py-2.5 bg-teal-800 hover:bg-teal-900 focus-within:ring-2 focus-within:ring-teal-700 focus-within:ring-offset-2 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors shadow-xs min-h-[44px]">
            <Upload className="w-3.5 h-3.5" />
            <span>{isUploading ? 'Validating CSV...' : 'Select CSV File'}</span>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              disabled={isUploading}
              className="sr-only"
              aria-label="Upload cleaned listings CSV file"
            />
          </label>

          {uploadStatus && (
            <div
              className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                uploadStatus.success
                  ? 'bg-teal-50 border border-teal-200 text-teal-900'
                  : 'bg-rose-50 border border-rose-200 text-rose-900'
              }`}
            >
              {uploadStatus.success ? (
                <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{uploadStatus.message}</span>
            </div>
          )}
        </div>
      </div>

      {/* 3. Mathematical Formulas Reference */}
      <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-teal-700" />
          <h3 className="text-sm font-bold text-slate-900">
            Statistical Methods & Mathematical Formulas
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 bg-slate-50 rounded-xl space-y-1.5 border border-slate-200">
            <span className="font-bold text-slate-900 block">
              1. Percentile Calculation: Linear Interpolation (PERCENTILE.INC)
            </span>
            <p className="text-slate-600 font-mono text-[11px] leading-relaxed">
              k = p × (N - 1), i = floor(k), f = k - i<br />
              value = sorted[i] + f × (sorted[i + 1] - sorted[i])
            </p>
            <p className="text-slate-500 text-[11px] mt-1">
              Identical to Microsoft Excel's <code>PERCENTILE.INC</code> and R type 7. Ensures exact reproducibility in spreadsheet audits.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl space-y-1.5 border border-slate-200">
            <span className="font-bold text-slate-900 block">
              2. Annual Revenue Estimation
            </span>
            <p className="text-slate-600 font-mono text-[11px] leading-relaxed">
              Revenue = Median of estimated_revenue_l365d across comps
            </p>
            <p className="text-slate-500 text-[11px] mt-1">
              Does NOT multiply median price by median booked nights. A product of medians distorts revenue by assuming high-priced units book at median frequency.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl space-y-1.5 border border-slate-200">
            <span className="font-bold text-slate-900 block">
              3. Pricing Tiers
            </span>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              <strong>Launch:</strong> 40th percentile of comps (P40)<br />
              <strong>Market:</strong> 50th percentile / median (P50)<br />
              <strong>Premium:</strong> 75th percentile of comps with rating ≥ 4.8★
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl space-y-1.5 border border-slate-200">
            <span className="font-bold text-slate-900 block">
              4. Break-even Nightly Price
            </span>
            <p className="text-slate-600 font-mono text-[11px] leading-relaxed">
              Break-even Price = (Monthly Carrying Cost × 12) ÷ Median Booked Nights
            </p>
            <p className="text-slate-500 text-[11px] mt-1">
              Computed exclusively from user-specified owner carrying costs.
            </p>
          </div>
        </div>
      </div>

      {/* 4. Complete 33-Column Schema Descriptions */}
      <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Table className="w-4 h-4 text-teal-700" />
            <h3 className="text-sm font-bold text-slate-900">
              Cleaned Dataset Schema (All 33 Columns)
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {COLUMN_DESCRIPTIONS.length} documented columns
          </span>
        </div>

        <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs divide-y divide-slate-200">
            <thead className="bg-slate-50 text-slate-700 sticky top-0 z-10 font-semibold">
              <tr>
                <th className="p-3 w-8">#</th>
                <th className="p-3">Column Name</th>
                <th className="p-3">Type</th>
                <th className="p-3">Description & Usage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {COLUMN_DESCRIPTIONS.map((col, idx) => (
                <tr key={col.name} className="hover:bg-slate-50">
                  <td className="p-3 text-slate-400">{idx + 1}</td>
                  <td className="p-3 font-semibold text-slate-900">{col.name}</td>
                  <td className="p-3 text-teal-800">{col.type}</td>
                  <td className="p-3 font-sans text-slate-600">{col.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Cleaning Log */}
      <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-teal-700" />
          <h3 className="text-sm font-bold text-slate-900">
            Data Cleaning Log (cleaning_log.md)
          </h3>
        </div>
        <p className="text-xs text-slate-500">
          Full offline data preparation log specifying source, license, row transformations, and removed fields:
        </p>

        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 font-mono text-xs text-slate-800 whitespace-pre-wrap max-h-96 overflow-y-auto leading-relaxed">
          {cleaningLog}
        </div>
      </div>

      {/* 6. AI Guard Log */}
      <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-teal-700" />
            <h3 className="text-sm font-bold text-slate-900">
              AI Number Guard Verification Audit Log
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {aiGuardLogs.length} events logged
          </span>
        </div>

        <p className="text-xs text-slate-500">
          Every response generated by Gemini is inspected by the Number Guard regex engine. Any numeric token not matching the computed JSON context (exact match, ±0.5, or ±1% tolerance), including written number words, is redacted with [not in data] and recorded here.
        </p>

        {aiGuardLogs.length === 0 ? (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500">
            No AI requests logged in this session yet. Ask a question on "Ask the Data" or generate an explanation to view live audit checks.
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {aiGuardLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 uppercase text-[10px] bg-slate-200 px-1.5 py-0.5 rounded">
                      {log.source}
                    </span>
                    <span className="font-mono text-slate-400 text-[11px]">
                      {log.timestamp}
                    </span>
                  </div>

                  {log.verified ? (
                    <span className="text-teal-700 font-medium text-[11px] flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                      100% Numbers Verified
                    </span>
                  ) : (
                    <span className="text-amber-700 font-medium text-[11px] flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      {log.flaggedTokens.length} unverified number(s) redacted
                    </span>
                  )}
                </div>

                <p className="text-slate-700 italic">
                  "{log.originalResponse.substring(0, 180)}..."
                </p>

                {log.flaggedTokens.length > 0 && (
                  <p className="text-[11px] text-rose-700 font-mono">
                    Redacted tokens: {log.flaggedTokens.join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Attribution Link */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <p>
          Data: Inside Airbnb, Washington DC, scraped {scrapeDate},{' '}
          <a
            href={INSIDE_AIRBNB_DATA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-teal-800 font-semibold hover:underline"
          >
            https://insideairbnb.com/get-the-data/
          </a>
          , CC BY 4.0.
        </p>
        <span className="text-[11px] text-slate-400">
          Cleaned offline; no host PII retained.
        </span>
      </div>
    </div>
  );
};
