import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Send, X, Brain } from 'lucide-react';

export default function AIStudyChat({ classId, className, onInteractionsChange }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [interactions, setInteractions] = useState([]);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const question = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: question }]);
    setLoading(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a helpful study tutor. A student is currently in a focus/study session${className ? ` for ${className}` : ''}. Answer their question clearly and concisely to help them understand the material.

Student question: ${question}`,
      });
      const answer = typeof res === 'string' ? res : (res.text || JSON.stringify(res));
      setMessages(prev => [...prev, { role: 'assistant', content: answer }]);
      const newInteraction = { question, answer };
      const updated = [...interactions, newInteraction];
      setInteractions(updated);
      if (onInteractionsChange) onInteractionsChange(updated);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I could not answer that right now.' }]);
    }
    setLoading(false);
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 w-80 max-w-[calc(100vw-2rem)]">
      <div className="rounded-2xl border border-border bg-card shadow-xl flex flex-col" style={{ height: '420px' }}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Brain className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm font-medium">Study Assistant</span>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground mt-8">
              <Brain className="w-6 h-6 mx-auto mb-2 opacity-50" />
              Ask a question about your course material while you study.
            </div>
          ) : messages.map((msg, idx) => (
            <div key={idx} className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-xl px-3 py-2">
                <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSend} className="px-3 py-3 border-t border-border flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about your material..."
            className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
            disabled={loading}
          />
          <button type="submit" disabled={loading || !input.trim()}
            className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50 flex-shrink-0">
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}