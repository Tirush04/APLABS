import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Provenance, PropertyProfile, PricingTiers, RevenueMetrics } from '../types';
import { enforceNumberGuard } from '../utils/numberGuard';
import { useData } from '../context/DataContext';
import {
  MessageSquare,
  Send,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Info,
  AlertTriangle,
} from 'lucide-react';

interface AskTheDataCardProps {
  contextJson: Record<string, any>;
  profile: PropertyProfile;
  pricing: PricingTiers;
  revenue: RevenueMetrics;
  onOpenProvenance: (p: Provenance) => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  verified?: boolean;
  category?: string;
  isSystemOrFallback?: boolean;
}

function trimToWords(str: string, maxWords: number): string {
  const words = str.trim().split(/\s+/);
  if (words.length <= maxWords) return str;
  return words.slice(0, maxWords).join(' ') + '…';
}

function renderFormattedText(text: string) {
  const lines = text.split('\n');
  return lines.map((line, lineIdx) => {
    const parts = line.split('**');
    return (
      <React.Fragment key={lineIdx}>
        {parts.map((part, partIdx) =>
          partIdx % 2 === 1 ? (
            <strong key={partIdx} className="font-semibold text-slate-900">
              {part}
            </strong>
          ) : (
            <span key={partIdx}>{part}</span>
          )
        )}
        {lineIdx < lines.length - 1 && <br />}
      </React.Fragment>
    );
  });
}

export const AskTheDataCard: React.FC<AskTheDataCardProps> = ({
  contextJson,
  profile,
  pricing,
  revenue,
  onOpenProvenance,
}) => {
  const { addAIGuardLog } = useData();

  const [aiStatus, setAiStatus] = useState<{ online: boolean | null; model?: string }>({
    online: null,
  });

  const bedLabel = profile.bedrooms === 0 ? 'Studio' : `${profile.bedrooms}-bedroom`;

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: `Hello! I am your DC STR Advisor data analyst. I answer questions strictly from the computed market metrics for your **${bedLabel} ${profile.propertyType}** in **${profile.neighbourhood}** (${pricing.n} similar listings). Ask me about pricing tiers, revenue, booking pace, or amenities.`,
      isSystemOrFallback: true,
    },
  ]);

  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Health check on mount
  useEffect(() => {
    let isMounted = true;
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        if (isMounted) {
          setAiStatus({ online: Boolean(data.ai), model: data.model });
        }
      })
      .catch((err) => {
        console.error('Health check failed:', err);
        if (isMounted) {
          setAiStatus({ online: false });
        }
      });

    return () => {
      isMounted = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  // Suggested questions strictly from context JSON
  const suggestedQuestions = useMemo(() => {
    const marketPrice = contextJson.pricing?.market_tier_median || Math.round(pricing.recommendedPrice);
    const occPct = contextJson.revenue_and_occupancy?.occupancy_pct || Math.round((revenue.bookedNightsMedian / 365) * 100);
    const annRev = contextJson.revenue_and_occupancy?.annual_revenue_median || revenue.annualRevenueMedian;
    const outlookPct = contextJson.booking_outlook?.next_3m_unavailable_pct || 0;
    const activeComps = contextJson.neighbourhood_compliance?.active_listings_total || pricing.n;

    return [
      `Why is the recommended rate $${marketPrice}/night for a ${bedLabel}?`,
      `What does ~${occPct}% occupancy mean for annual revenue ($${annRev.toLocaleString()})?`,
      `What is the booking outlook (~${outlookPct}% unavailable) for the next 3 months?`,
      `How competitive is ${profile.neighbourhood} with ${activeComps} listings?`,
    ];
  }, [contextJson, pricing, revenue, profile, bedLabel]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  if (pricing.n === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-8 text-center">
        <div className="p-6 bg-amber-50 border border-amber-200 rounded-2xl max-w-md mx-auto space-y-2">
          <AlertTriangle className="w-6 h-6 text-amber-600 mx-auto" />
          <h3 className="font-bold text-sm text-amber-900">
            Not enough similar listings: try a nearby neighbourhood
          </h3>
          <p className="text-xs text-amber-800">
            Ask the Data requires at least 1 active comparable listing to compute verified metrics.
          </p>
        </div>
      </div>
    );
  }

  const handleSend = async (messageText: string) => {
    const trimmedInput = messageText.trim();
    if (!trimmedInput || isStreaming) return;

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const userMsg: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      role: 'user',
      text: trimmedInput,
    };

    // Extract last 4 turns history
    const history = messages
      .filter((m) => !m.isSystemOrFallback)
      .slice(-4)
      .map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        text: m.text,
      }));

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsStreaming(true);
    setError(null);

    let accumulatedRaw = '';
    let serverError: string | null = null;

    try {
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmedInput,
          contextJson,
          history,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        let errBody = '';
        try {
          const errorData = await response.json();
          errBody = errorData.error || JSON.stringify(errorData);
        } catch {
          errBody = await response.text().catch(() => '');
        }
        console.error(`AI status ${response.status}:`, errBody);
        throw new Error(`AI unavailable (${response.status}): ${errBody || 'Request failed'}`);
      }

      if (!response.body) {
        throw new Error('AI unavailable: No response stream received from server');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            buffer += decoder.decode();
            break;
          }
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop() || '';

          for (const evt of events) {
            const lines = evt.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const jsonStr = line.slice(6).trim();
                if (jsonStr) {
                  let parsed: any = null;
                  try {
                    parsed = JSON.parse(jsonStr);
                  } catch {}
                  if (parsed) {
                    if (parsed.text) {
                      accumulatedRaw += parsed.text;
                    }
                    if (parsed.error) {
                      serverError = parsed.error;
                    }
                  }
                }
              }
            }
            if (serverError) {
              throw new Error(serverError);
            }
          }
        }

        if (buffer.trim()) {
          const lines = buffer.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6).trim();
              if (jsonStr) {
                let parsed: any = null;
                try {
                  parsed = JSON.parse(jsonStr);
                } catch {}
                if (parsed) {
                  if (parsed.text) accumulatedRaw += parsed.text;
                  if (parsed.error) serverError = parsed.error;
                }
              }
            }
          }
          if (serverError) {
            throw new Error(serverError);
          }
        }
      } finally {
        reader.releaseLock();
      }

      // Client trim to <= 80 words
      const trimmedOutput = trimToWords(accumulatedRaw, 80);

      // Enforce Number Guard on trimmed text before rendering
      const guardResult = enforceNumberGuard(trimmedOutput, contextJson);
      const matchedCategory = guardResult.verifiedTokens[0]?.metricCategory || 'pricing';

      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          role: 'assistant',
          text: guardResult.sanitizedText,
          verified: guardResult.verified,
          category: matchedCategory,
          isSystemOrFallback: false,
        },
      ]);

      addAIGuardLog({
        source: 'chat',
        originalResponse: accumulatedRaw,
        flaggedTokens: guardResult.flaggedTokens,
        verified: guardResult.verified,
      });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return;
      }
      const errMsg = err?.message || 'Chat service encountered an error.';
      console.error('Chat error:', errMsg);
      setError(errMsg);

      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          role: 'assistant',
          text: 'I could not connect to the AI model right now. You can still inspect all computed metrics, charts, and provenance tables directly on the other tabs.',
          isSystemOrFallback: true,
        },
      ]);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleOpenCategoryProvenance = (category?: string) => {
    if (category === 'revenue') {
      onOpenProvenance(revenue.provenance);
    } else {
      onOpenProvenance(pricing.provenance);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col h-[600px] overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-teal-50 text-teal-700 rounded-lg">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                Ask the Data
              </h3>
              {/* Online/Offline status pill from /api/health */}
              {aiStatus.online === true ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  AI online
                </span>
              ) : aiStatus.online === false ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  AI offline: calculations still work
                </span>
              ) : null}
            </div>
            <p className="text-[11px] text-slate-500">
              Grounded strictly in computed data for {bedLabel} in {profile.neighbourhood}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setMessages([
              {
                id: 'welcome',
                role: 'assistant',
                text: `Reset chat. Ready to answer questions on **${bedLabel} ${profile.propertyType}** in **${profile.neighbourhood}**.`,
                isSystemOrFallback: true,
              },
            ]);
            setError(null);
          }}
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Reset conversation"
          title="Reset conversation"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Suggested question chips */}
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2 overflow-x-auto text-xs">
        <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">
          Suggestions:
        </span>
        {suggestedQuestions.map((q, idx) => (
          <button
            key={idx}
            type="button"
            disabled={isStreaming}
            onClick={() => handleSend(q)}
            className="px-2.5 py-1.5 bg-white hover:bg-teal-50 hover:text-teal-900 hover:border-teal-300 border border-slate-200 rounded-lg text-slate-700 whitespace-nowrap transition-colors shrink-0 disabled:opacity-50 text-[11px] min-h-[36px]"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Messages area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.map((m) => {
          const isUser = m.role === 'user';
          return (
            <div
              key={m.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                  isUser
                    ? 'bg-slate-900 text-white rounded-br-xs'
                    : 'bg-slate-100 text-slate-800 rounded-bl-xs'
                }`}
              >
                <div className="space-y-1">
                  {renderFormattedText(m.text)}
                </div>
              </div>

              {!isUser && !m.isSystemOrFallback && m.text && (
                <div className="flex flex-wrap items-center gap-2 mt-1.5 px-1 text-[11px]">
                  {m.verified ? (
                    <span className="text-teal-700 inline-flex items-center gap-1 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                      ✓ All numbers verified against data
                    </span>
                  ) : (
                    <span className="text-amber-700 inline-flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                      Unverified numbers replaced with [not in data]
                    </span>
                  )}

                  <span className="text-slate-300">·</span>

                  <button
                    type="button"
                    onClick={() => handleOpenCategoryProvenance(m.category)}
                    className="text-slate-500 hover:text-teal-800 underline flex items-center gap-0.5 min-h-[30px]"
                  >
                    <Info className="w-3 h-3" />
                    <span>Where did that number come from?</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {isStreaming && (
          <div className="flex flex-col items-start">
            <div className="bg-slate-100 text-slate-700 p-3.5 rounded-2xl rounded-bl-xs flex items-center gap-2.5 text-xs shadow-2xs">
              <div className="w-4 h-4 border-2 border-teal-700 border-t-transparent rounded-full animate-spin shrink-0" />
              <span className="font-medium text-slate-800">Verifying numbers against data…</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend(input);
        }}
        className="p-3 border-t border-slate-100 flex items-center gap-2 bg-white"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about this property's computed data..."
          disabled={isStreaming}
          className="flex-1 px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-teal-700 text-slate-900 disabled:opacity-50 min-h-[44px]"
          aria-label="Ask a question about the computed data"
        />
        <button
          type="submit"
          disabled={!input.trim() || isStreaming}
          className="px-4 py-2.5 bg-teal-800 hover:bg-teal-900 disabled:opacity-40 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 min-h-[44px]"
          aria-label="Send question"
        >
          <span>Ask</span>
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>

      {/* Error state */}
      {error && (
        <div className="px-4 py-2.5 bg-rose-50 border-t border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
