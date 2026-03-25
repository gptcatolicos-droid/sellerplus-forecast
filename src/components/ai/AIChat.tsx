'use client';
import { useState, useRef, useEffect } from 'react';
import type { Product } from '@/types';

interface Message { role: 'user' | 'assistant'; content: string }
interface SuggestedProduct { id: string; slug: string; title: string; price_usd: number }

interface Props {
  product?: { title: string; description: string; price: string };
  placeholder?: string;
  compact?: boolean;
}

export default function AIChat({ product, placeholder, compact = false }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(!compact);
  const [suggested, setSuggested] = useState<SuggestedProduct[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(text?: string) {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput('');
    setLoading(true);
    setSuggested([]);

    const userMsg: Message = { role: 'user', content: msg };
    setMessages(prev => [...prev, userMsg]);

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          message: msg,
          history: messages.slice(-8),
          product,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.data.response }]);
        if (data.data.suggested_products?.length) setSuggested(data.data.suggested_products);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Lo siento, hubo un error. Intenta de nuevo.' }]);
    }
    setLoading(false);
  }

  const hints = product
    ? ['¿Es bueno para empezar?', '¿Qué otras series recomiendas?', '¿Vale la pena comprarlo?']
    : ['¿Cuál es el mejor Batman?', 'Comics para principiantes', 'Figuras de Iron Studios'];

  if (compact && !open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-brand-black text-white rounded-full shadow-xl flex items-center justify-center hover:bg-red transition-colors z-40"
        aria-label="Abrir chat"
      >
        <span className="text-xl">💬</span>
      </button>
    );
  }

  return (
    <div className={compact ? 'fixed bottom-6 right-6 z-40 w-80 shadow-2xl rounded-2xl overflow-hidden' : 'w-full'}>
      {/* Header */}
      <div className="bg-brand-black px-4 py-3 flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-red animate-pulse-dot" />
        <span className="text-white text-sm font-semibold flex-1">
          {product ? 'Pregunta sobre este producto' : 'Chat IA — Experto en Comics'}
        </span>
        {compact && (
          <button onClick={() => setOpen(false)} className="text-white/50 hover:text-white text-lg leading-none">×</button>
        )}
      </div>

      {/* Messages */}
      <div className={`bg-white ${compact ? 'h-72' : 'min-h-[240px] max-h-96'} overflow-y-auto p-4 flex flex-col gap-3`}>
        {messages.length === 0 && (
          <div className="text-center py-4">
            <p className="text-gray-400 text-sm mb-4">
              {product ? `Pregúntame lo que quieras sobre "${product.title.slice(0, 40)}..."` : 'Hola! Soy tu experto en cómics. ¿Qué quieres saber?'}
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {hints.map(hint => (
                <button
                  key={hint}
                  onClick={() => send(hint)}
                  className="text-xs px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  {hint}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
              m.role === 'user'
                ? 'bg-brand-black text-white rounded-br-sm'
                : 'bg-gray-100 text-gray-800 rounded-bl-sm'
            }`}>
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-xl rounded-bl-sm px-4 py-3 flex gap-1">
              {[0,1,2].map(i => (
                <div key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse-dot" style={{ animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          </div>
        )}

        {/* Suggested products */}
        {suggested.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {suggested.map(p => (
              <a
                key={p.id}
                href={`/producto/${p.slug}`}
                className="flex-shrink-0 bg-gray-50 border border-gray-200 rounded-lg p-2.5 w-28 hover:border-red transition-colors"
              >
                <p className="text-xs font-medium text-gray-800 line-clamp-2 leading-snug mb-1">{p.title}</p>
                <p className="text-xs font-bold text-red">${p.price_usd.toFixed(2)}</p>
              </a>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 bg-white p-3 flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder={placeholder || 'Escribe tu pregunta...'}
          className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-red focus:bg-white transition-colors"
          disabled={loading}
        />
        <button
          onClick={() => send()}
          disabled={loading || !input.trim()}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-red text-white hover:bg-red-dark transition-colors disabled:opacity-40"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
