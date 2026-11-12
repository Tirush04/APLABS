import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, CheckCircle2, AlertCircle, X, RefreshCw } from 'lucide-react';
import { enforceNumberGuard } from '../utils/numberGuard';
import { useData } from '../context/DataContext';

interface ExplainModalProps {
  isOpen: boolean;
  onClose: () => void;
  screenName: string;
  contextJson: Record<string, any>;
}

export const ExplainModal: React.FC<ExplainModalProps> = ({
  isOpen,
  onClose,
  screenName,
  contextJson,
}) => {
  const { addAIGuardLog } = useData();
  const [explanation, setExplanation] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState<boolean>(true);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const lastFetchedKeyRef = useRef<string>('');

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

    setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 0);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  const fetchExplanation = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/gemini/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ screenName, contextJson }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to generate explanation');
      }

      const data = await res.json();
      const rawText = data.text || '';

      // Number Guard
      const guardResult = enforceNumberGuard(rawText, contextJson);
      setExplanation(guardResult.sanitizedText);
      setVerified(guardResult.verified);

      addAIGuardLog({
        source: 'explain',
        originalResponse: rawText,
        flaggedTokens: guardResult.flaggedTokens,
        verified: guardResult.verified,
      });
    } catch (err: any) {
      setError(err?.message || 'AI service temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  };

  // Refetch whenever screenName or contextJson changes while open
  useEffect(() => {
    if (!isOpen) return;

    const currentKey = `${screenName}:${JSON.stringify(contextJson)}`;
    if (currentKey !== lastFetchedKeyRef.current) {
      lastFetchedKeyRef.current = currentKey;
      setExplanation('');
      fetchExplanation();
    }
  }, [isOpen, screenName, contextJson]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60"
      onClick={onClose}
    >
      <div className="min-h-full flex items-start justify-center p-4 sm:p-8">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="explain-modal-title"
          className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-auto sm:my-8 text-slate-800"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Sticky Action Bar */}
          <div className="sticky top-0 z-10 bg-white px-6 py-4 border-b border-slate-100 flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-teal-50 text-teal-700 rounded-lg">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 id="explain-modal-title" className="font-bold text-slate-900">
                  Explain this to my client
                </h3>
                <p className="text-xs text-slate-500">2-sentence owner-ready talking points</p>
              </div>
            </div>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              className="px-2.5 py-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors text-xs font-semibold flex items-center gap-1.5 min-h-[44px]"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
              <span>Close</span>
            </button>
          </div>

          <div className="p-6 pt-4">
            {loading ? (
              <div className="py-8 flex flex-col items-center justify-center space-y-3">
                <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-slate-500">Drafting 2-sentence explanation from computed metrics...</p>
              </div>
            ) : error ? (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm">
                <p className="font-semibold">Unable to generate AI explanation</p>
                <p className="text-xs text-rose-700 mt-1">{error}</p>
                <button
                  type="button"
                  onClick={fetchExplanation}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 bg-rose-700 text-white rounded-lg hover:bg-rose-800 transition-colors min-h-[44px]"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retry
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm leading-relaxed text-slate-800 font-sans">
                  "{explanation}"
                </div>

                {/* Number Guard Badge */}
                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                  {verified ? (
                    <span className="inline-flex items-center gap-1 text-teal-700 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-teal-600" />
                      ✓ All numbers verified against data
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                      Unverified numbers replaced with [not in data]
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={fetchExplanation}
                    className="text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium min-h-[44px] px-2"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Regenerate
                  </button>
                </div>
              </div>
            )}

            {/* Bottom Close Button */}
            <div className="mt-6 pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors min-h-[44px]"
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
