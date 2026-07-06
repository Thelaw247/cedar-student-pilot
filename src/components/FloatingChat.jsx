import React, { useState, useRef, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { MessageCircle, X, Send, Loader2, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const AGENT_NAME = 'academic_assistant';

export default function FloatingChat() {
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const unsubscribeRef = useRef(null);

  useEffect(() => {
    return () => { if (unsubscribeRef.current) unsubscribeRef.current(); };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const loadConversation = useCallback(async () => {
    try {
      let convs = await base44.agents.listConversations({ agent_name: AGENT_NAME });
      setConversations(convs);
      let conv;
      if (convs.length > 0) {
        conv = await base44.agents.getConversation(convs[0].id);
        setActiveConvId(conv.id);
        setMessages(conv.messages || []);
      }
    } catch (e) { console.error(e); }
  }, []);

  const openChat = () => {
    setOpen(true);
    if (!activeConvId) loadConversation();
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');

    let convId = activeConvId;
    try {
      if (!convId) {
        const conv = await base44.agents.createConversation({
          agent_name: AGENT_NAME,
          metadata: { name: userMsg.substring(0, 40) },
        });
        convId = conv.id;
        setConversations(prev => [conv, ...prev]);
        setActiveConvId(convId);
      }

      setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
      setLoading(true);

      const conv = await base44.agents.getConversation(convId);
      await base44.agents.addMessage(conv, { role: 'user', content: userMsg });

      if (unsubscribeRef.current) unsubscribeRef.current();

      unsubscribeRef.current = base44.agents.subscribeToConversation(convId, (data) => {
        setMessages(data.messages || []);
        const lastMsg = (data.messages || [])[data.messages?.length - 1];
        if (lastMsg && lastMsg.role === 'assistant' && !lastMsg.tool_calls?.some(tc => ['pending', 'running', 'in_progress'].includes(tc.status))) {
          setLoading(false);
          if (unsubscribeRef.current) { unsubscribeRef.current(); unsubscribeRef.current = null; }
        }
      });

      setTimeout(() => { setLoading(false); }, 30000);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating message button */}
      {!open && (
        <button
          onClick={openChat}
          className="fixed bottom-20 lg:bottom-6 right-4 z-40 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors"
          title="Chat with Cedar AI"
        >
          <MessageCircle className="w-5 h-5" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-20 lg:bottom-6 right-4 z-40 w-80 max-w-[calc(100vw-2rem)] animate-fade-in">
          <div className="rounded-2xl border border-border bg-card shadow-xl flex flex-col" style={{ height: '460px' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm font-medium">Cedar AI</span>
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.length === 0 && !loading && (
                <div className="text-center text-xs text-muted-foreground mt-8">
                  <Sparkles className="w-6 h-6 mx-auto mb-2 opacity-50" />
                  Ask me about your lectures, notes, or assignments.
                </div>
              )}
              {messages.map((msg, idx) => {
                const isUser = msg.role === 'user';
                return (
                  <div key={idx} className={isUser ? 'flex justify-end' : 'flex justify-start'}>
                    <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${
                      isUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                    }`}>
                      {msg.content && (
                        <ReactMarkdown className="prose prose-sm max-w-none prose-p:my-0">{msg.content}</ReactMarkdown>
                      )}
                    </div>
                  </div>
                );
              })}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-xl px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <form onSubmit={(e) => { e.preventDefault(); send(); }} className="px-3 py-3 border-t border-border flex gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); send(); } }}
                placeholder="Ask about your lectures..."
                className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                disabled={loading}
              />
              <button type="submit" disabled={loading || !input.trim()}
                className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50 flex-shrink-0">
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}