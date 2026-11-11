import React, { useState } from 'react';
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
  const [hasLoaded, setHasLoaded] = useState<boolean>(false);

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

      setHasLoaded(true);
    } catch (err: any) {
      setError(err?.message || 'AI service temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (isOpen && !hasLoaded) {
      fetchExplanation();
    }
  }, [isOpen, hasLoaded]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 p-6 text-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-teal-50 text-teal-700 rounded-lg">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Explain this to my client</h3>
              <p className="text-xs text-slate-500">2-sentence owner-ready talking points</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4">
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
                onClick={fetchExplanation}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-rose-700 text-white rounded-lg hover:bg-rose-800 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm leading-relaxed text-slate-800">
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
                  onClick={fetchExplanation}
                  className="text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Regenerate
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 pt-3 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
