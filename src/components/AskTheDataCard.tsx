import React, { useState, useRef, useEffect } from 'react';
import { Provenance, PropertyProfile, PricingTiers, RevenueMetrics } from '../types';
import { enforceNumberGuard } from '../utils/numberGuard';
import { useData } from '../context/DataContext';
import {
  MessageSquare,
  Send,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  RotateCcw,
  Info,
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
  rawText?: string;
}

export const AskTheDataCard: React.FC<AskTheDataCardProps> = ({
  contextJson,
  profile,
  pricing,
  revenue,
  onOpenProvenance,
}) => {
  const { addAIGuardLog } = useData();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: `Hello! I am your DC STR Advisor data analyst. I answer questions strictly from the computed market metrics for your **${profile.bedrooms}-bedroom ${profile.propertyType}** in **${profile.neighbourhood}** (${pricing.n} similar listings). Ask me about pricing tiers, revenue, booking pace, or amenities.`,
      verified: true,
    },
  ]);

  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // 4 dynamic suggested question chips that change with the property
  const suggestedQuestions = [
    `Why is the recommended price $${Math.round(pricing.recommendedPrice)}/night?`,
    `How much more revenue does free parking add in ${profile.neighbourhood}?`,
    `What is the typical occupancy pace for 1-bed listings here?`,
    `Is ${profile.neighbourhood} crowded with active listings?`,
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  const handleSend = async (messageText: string) => {
    if (!messageText.trim() || isStreaming) return;

    const userMsg: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      role: 'user',
      text: messageText,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsStreaming(true);
    setError(null);

    const assistantMsgId = Math.random().toString(36).substring(2, 9);
    setMessages((prev) => [
      ...prev,
      { id: assistantMsgId, role: 'assistant', text: '' },
    ]);

    let accumulatedRaw = '';

    try {
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          contextJson,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to stream response from server');
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported on this response');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.replace('data: ', '').trim();
              if (jsonStr) {
                try {
                  const parsed = JSON.parse(jsonStr);
                  if (parsed.text) {
                    accumulatedRaw += parsed.text;
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === assistantMsgId
                          ? { ...msg, text: accumulatedRaw, rawText: accumulatedRaw }
                          : msg
                      )
                    );
                  }
                  if (parsed.error) {
                    throw new Error(parsed.error);
                  }
                } catch {
                  // ignore non-json chunk lines
                }
              }
            }
          }
        }
      }

      // Run Number Guard on the complete response
      const guardResult = enforceNumberGuard(accumulatedRaw, contextJson);

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                text: guardResult.sanitizedText,
                rawText: accumulatedRaw,
                verified: guardResult.verified,
              }
            : msg
        )
      );

      // Log to AI Guard Log
      addAIGuardLog({
        source: 'chat',
        originalResponse: accumulatedRaw,
        flaggedTokens: guardResult.flaggedTokens,
        verified: guardResult.verified,
      });
    } catch (err: any) {
      console.error('Chat stream error:', err);
      setError(err?.message || 'Chat service encountered an error.');
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                text: 'I could not connect to the AI model right now. You can still inspect all computed metrics, charts, and provenance tables directly on the other tabs.',
                verified: true,
              }
            : msg
        )
      );
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col h-[600px] overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-teal-50 text-teal-700 rounded-lg">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Ask the Data
            </h3>
            <p className="text-[11px] text-slate-500">
              Gemini 3.8 Flash grounded strictly in current profile metrics
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
                text: `Reset chat. Ready to answer questions on **${profile.bedrooms}-bed ${profile.propertyType}** in **${profile.neighbourhood}**.`,
                verified: true,
              },
            ]);
          }}
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          title="Reset conversation"
        >
          <RotateCcw className="w-3.5 h-3.5" />
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
            className="px-2.5 py-1 bg-white hover:bg-teal-50 hover:text-teal-900 hover:border-teal-300 border border-slate-200 rounded-lg text-slate-700 whitespace-nowrap transition-colors shrink-0 disabled:opacity-50 text-[11px]"
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
                {/* Format markdown bold if present */}
                <div
                  className="space-y-1"
                  dangerouslySetInnerHTML={{
                    __html: m.text
                      ? m.text
                          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                          .replace(/\n/g, '<br />')
                      : isStreaming && m.role === 'assistant'
                      ? '<span class="inline-block animate-pulse">Typing...</span>'
                      : '',
                  }}
                />
              </div>

              {/* Provenance & Number Guard info under assistant response */}
              {!isUser && m.text && (
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
                    onClick={() => onOpenProvenance(pricing.provenance)}
                    className="text-slate-500 hover:text-teal-800 underline flex items-center gap-0.5"
                  >
                    <Info className="w-3 h-3" />
                    <span>Where did that number come from?</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
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
          className="flex-1 px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-teal-700 text-slate-900 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!input.trim() || isStreaming}
          className="px-4 py-2 bg-teal-800 hover:bg-teal-900 disabled:opacity-40 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5"
        >
          <span>Ask</span>
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
