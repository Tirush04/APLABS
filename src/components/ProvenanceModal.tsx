import React, { useState, useEffect, useRef } from 'react';
import { Provenance } from '../types';
import { Info, AlertTriangle, Copy, Check, X, Database, Filter, Hash, Calculator } from 'lucide-react';

interface ProvenanceModalProps {
  provenance: Provenance | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ProvenanceModal: React.FC<ProvenanceModalProps> = ({
  provenance,
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [showAllIds, setShowAllIds] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setShowAllIds(false);
  }, [provenance]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Move focus to Close button on open
    setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 0);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen || !provenance) return null;

  const handleCopyIds = () => {
    if (!provenance.listingIds) return;
    navigator.clipboard.writeText(provenance.listingIds.join(', '));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayedIds = showAllIds
    ? provenance.listingIds
    : provenance.listingIds?.slice(0, 30) || [];

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60"
      onClick={onClose}
    >
      <div className="min-h-full flex items-start justify-center p-4 sm:p-8">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="provenance-modal-title"
          className="relative w-full max-w-xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-auto sm:my-8 text-slate-800"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Sticky Action Bar */}
          <div className="sticky top-0 z-10 bg-white px-6 py-4 border-b border-slate-100 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-teal-700">
                <Database className="w-3.5 h-3.5" />
                <span>Data Provenance & Calculation Audit</span>
              </div>
              <h3 id="provenance-modal-title" className="text-lg font-bold text-slate-900 mt-1">
                {provenance.metricName}
              </h3>
            </div>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              className="px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors text-xs font-semibold flex items-center gap-1.5 min-h-[44px]"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
              <span>Close</span>
            </button>
          </div>

          <div className="p-6 pt-4 space-y-4">
            {/* Low sample warning */}
            {provenance.isLowSample && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-amber-800 text-sm">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Low Sample Warning (n = {provenance.rowCount})</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Sample size is below 10 listings. Use these figures with caution as individual outliers may exert higher influence.
                  </p>
                </div>
              </div>
            )}

            {/* Widening steps */}
            {provenance.widenedSteps && provenance.widenedSteps.length > 0 && (
              <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-teal-900 text-sm">
                <p className="font-semibold text-xs text-teal-800 uppercase tracking-wide">
                  Comp Set Widening Sequence Applied:
                </p>
                <ul className="mt-2 space-y-1.5 text-xs text-teal-700 list-disc pl-4">
                  {provenance.widenedSteps.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Audit Details */}
            <div className="space-y-3.5 text-sm">
              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                <Filter className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="text-xs font-semibold text-slate-500 uppercase">Dataset & Filter</span>
                  <p className="font-mono text-xs text-slate-700 mt-0.5">
                    <span className="font-semibold text-slate-900">{provenance.datasetFile}</span>
                    <span className="text-slate-400"> (scraped 2026-09-20)</span>
                  </p>
                  <p className="text-xs text-slate-600 mt-1 bg-white p-2 rounded border border-slate-200 font-mono">
                    {provenance.filterApplied}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold uppercase">
                    <Hash className="w-3.5 h-3.5" />
                    <span>Sample Size (n)</span>
                  </div>
                  <p className="text-2xl font-bold font-mono text-slate-900 mt-1">
                    {provenance.rowCount}
                  </p>
                  <p className="text-xs text-slate-500">listings matched</p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold uppercase">
                    <Calculator className="w-3.5 h-3.5" />
                    <span>Method</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-800 mt-1">
                    {provenance.method || 'Percentile PERCENTILE.INC'}
                  </p>
                  <p className="text-xs text-slate-500">Mathematical calculation</p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-xs font-semibold text-slate-500 uppercase">Mathematical Formula</span>
                <p className="text-xs text-slate-700 mt-0.5 font-mono">
                  {provenance.formula}
                </p>
              </div>

              {/* Listing IDs used */}
              {provenance.listingIds && provenance.listingIds.length > 0 && (
                <div className="p-3 bg-slate-50 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-500 uppercase">
                      Listing IDs Used ({provenance.listingIds.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyIds}
                      className="flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-900 transition-colors"
                      aria-label="Copy listing IDs to clipboard"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-teal-600" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy IDs</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="max-h-28 overflow-y-auto p-2 bg-white rounded border border-slate-200 font-mono text-xs text-slate-600 flex flex-wrap gap-1.5">
                    {displayedIds.map((id) => (
                      <span key={id} className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                        {id}
                      </span>
                    ))}
                    {provenance.listingIds.length > 30 && !showAllIds && (
                      <button
                        type="button"
                        onClick={() => setShowAllIds(true)}
                        className="text-teal-700 hover:underline font-sans text-xs ml-1 font-semibold"
                        aria-label="Show all listing IDs"
                      >
                        +{provenance.listingIds.length - 30} more...
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Footer with second Close button */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Computed strictly in TypeScript from local raw data.
              </span>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Close provenance modal"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ProvenanceButton: React.FC<{
  provenance: Provenance;
  onClick: (p: Provenance) => void;
  className?: string;
  label?: string;
}> = ({ provenance, onClick, className = '', label = 'Source' }) => {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick(provenance);
      }}
      className={`inline-flex items-center gap-1 text-xs text-slate-400 hover:text-teal-700 transition-colors p-1 rounded hover:bg-slate-100 focus:outline-hidden focus:ring-2 focus:ring-teal-700 ${className}`}
      title={`Click to view data source, formula, and listing IDs for ${provenance.metricName}`}
      aria-label={`Source information for ${provenance.metricName}`}
    >
      <Info className="w-3.5 h-3.5" />
      <span className="font-medium text-[11px]">{label}</span>
    </button>
  );
};
