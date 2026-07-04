import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Sparkles, Send, Loader2, Plus, MessageSquare, Trash2, ChevronLeft, Wrench, Check, X, Loader } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const AGENT_NAME = 'academic_assistant';

export default function AIAssistant() {
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [showSidebar, setShowSidebar] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const loadConversations = useCallback(async () => {
    setLoadingConvs(true);
    try {
      const convs = await base44.agents.listConversations({ agent_name: AGENT_NAME });
      setConversations(convs);
      if (convs.length > 0) {
        selectConversation(convs[0].id);
      }
    } catch (e) {
      console.error(e);
    }
    setLoadingConvs(false);
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  const selectConversation = async (convId) => {
    try {
      const conv = await base44.agents.getConversation(convId);
      setActiveConvId(convId);
      setMessages(conv.messages || []);
      setShowSidebar(false);
    } catch (e) { console.error(e); }
  };

  const newConversation = async () => {
    try {
      const conv = await base44.agents.createConversation({
        agent_name: AGENT_NAME,
        metadata: { name: 'New Conversation' },
      });
      setConversations(prev => [conv, ...prev]);
      setActiveConvId(conv.id);
      setMessages([]);
      setShowSidebar(false);
    } catch (e) { console.error(e); }
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');

    let convId = activeConvId;
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

    try {
      const conv = await base44.agents.getConversation(convId);
      await base44.agents.addMessage(conv, { role: 'user', content: userMsg });
    } catch (e) {
      console.error(e);
      setLoading(false);
      return;
    }

    // Subscribe to streaming updates
    const unsubscribe = base44.agents.subscribeToConversation(convId, (data) => {
      setMessages(data.messages || []);
      const lastMsg = (data.messages || [])[data.messages?.length - 1];
      if (lastMsg && lastMsg.role === 'assistant' && !lastMsg.tool_calls?.some(tc => ['pending', 'running', 'in_progress'].includes(tc.status))) {
        setLoading(false);
      }
    });

    // Fallback timeout to stop loading
    setTimeout(() => { setLoading(false); }, 30000);
    return () => unsubscribe();
  };

  const deleteConversation = async (convId, e) => {
    e.stopPropagation();
    try {
      await base44.agents.updateConversation(convId, { metadata: { deleted: true } });
      const remaining = conversations.filter(c => c.id !== convId);
      setConversations(remaining);
      if (activeConvId === convId) {
        setActiveConvId(null);
        setMessages([]);
      }
    } catch (e) { console.error(e); }
  };

  const suggestions = [
    'What did my professor say about enzyme inhibition?',
    'Summarize my last biology lecture',
    'Create flashcards from my most recent lecture',
    'What topics are covered across all my lectures?',
  ];

  return (
    <div className="flex h-screen lg:h-screen overflow-hidden">
      {/* Conversation sidebar */}
      <div className={`${showSidebar ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:relative z-40 w-72 h-full bg-card border-r border-border transition-transform duration-200 flex flex-col`}>
        <div className="p-4 border-b border-border">
          <button onClick={newConversation}
            className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90">
            <Plus className="w-4 h-4" /> New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loadingConvs ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-muted-foreground animate-spin" /></div>
          ) : conversations.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No conversations yet</p>
          ) : (
            conversations.map(c => (
              <div key={c.id} onClick={() => selectConversation(c.id)}
                className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${activeConvId === c.id ? 'bg-primary/10' : 'hover:bg-muted'}`}>
                <MessageSquare className={`w-4 h-4 flex-shrink-0 ${activeConvId === c.id ? 'text-primary' : 'text-muted-foreground'}`} />
                <p className="text-sm text-foreground truncate flex-1">{c.metadata?.name || 'Conversation'}</p>
                <button onClick={(e) => deleteConversation(c.id, e)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main chat */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 sm:px-6 py-4 border-b border-border">
          <button onClick={() => setShowSidebar(!showSidebar)} className="lg:hidden text-muted-foreground">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-heading text-base font-bold">Cedar AI Assistant</h1>
            <p className="text-xs text-muted-foreground">References your lectures, transcripts & notes</p>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
          <div className="max-w-2xl mx-auto space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-8 h-8 text-primary" strokeWidth={1.5} />
                </div>
                <h2 className="font-heading text-lg font-semibold mb-1">Ask me anything</h2>
                <p className="text-sm text-muted-foreground mb-6">I can search your lectures, transcripts, notes, and assignments.</p>
                <div className="space-y-2 max-w-sm mx-auto">
                  {suggestions.map((s, i) => (
                    <button key={i} onClick={() => setInput(s)}
                      className="w-full text-left px-4 py-3 rounded-xl border border-border bg-card text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} />
            ))}

            {loading && (
              <div className="flex justify-start animate-fade-in">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div className="rounded-2xl px-4 py-3 bg-card border border-border">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input */}
        <div className="px-4 sm:px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t border-border">
          <div className="max-w-2xl mx-auto flex items-end gap-2">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask about your lectures..."
              rows={1}
              className="flex-1 px-4 py-3 rounded-xl border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none max-h-32"
            />
            <button onClick={send} disabled={!input.trim() || loading}
              className="w-11 h-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 transition-colors flex-shrink-0">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Overlay for mobile sidebar */}
      {showSidebar && <div className="lg:hidden fixed inset-0 bg-black/30 z-30" onClick={() => setShowSidebar(false)} />}
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center mr-2 flex-shrink-0 mt-1">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
      )}
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${isUser ? 'bg-primary text-primary-foreground' : 'bg-card border border-border'}`}>
        {message.content && (
          <ReactMarkdown className={`text-sm prose prose-sm max-w-none ${isUser ? 'prose-invert' : ''}`}>
            {message.content}
          </ReactMarkdown>
        )}
        {message.tool_calls?.map((tc, i) => <ToolCallDisplay key={i} toolCall={tc} />)}
      </div>
    </div>
  );
}

function ToolCallDisplay({ toolCall }) {
  const [expanded, setExpanded] = useState(false);
  const status = tc_status(toolCall);
  const name = formatToolName(toolCall.name);

  let parsedArgs = toolCall.arguments_string;
  try { parsedArgs = JSON.parse(toolCall.arguments_string); } catch (e) {}

  let parsedResults = toolCall.results;
  if (typeof parsedResults === 'string') {
    try { parsedResults = JSON.parse(parsedResults); } catch (e) {}
  }

  const dp = toolCall.display_projection || {};
  const hideDetails = dp.hide_details && dp.details_redacted;

  if (hideDetails) {
    return (
      <div className="mt-2 text-xs flex items-center gap-1.5 text-muted-foreground">
        {status === 'failed' ? <X className="w-3 h-3 text-destructive" /> : status === 'success' ? <Check className="w-3 h-3 text-emerald-600" /> : <Loader className="w-3 h-3 animate-spin" />}
        <span>{status === 'failed' ? (dp.error_label || 'Failed') : status === 'success' ? (dp.label || name) : (dp.active_label || 'Working...')}</span>
      </div>
    );
  }

  return (
    <div className="mt-2 text-xs">
      <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
        {status === 'failed' ? <X className="w-3 h-3 text-destructive" /> : status === 'success' ? <Check className="w-3 h-3 text-emerald-600" /> : <Loader className="w-3 h-3 animate-spin" />}
        <Wrench className="w-3 h-3" />
        <span className="font-medium">{name}</span>
        <span className="text-muted-foreground">— {status}</span>
      </button>
      {expanded && (
        <div className="mt-2 space-y-2 pl-5">
          {parsedArgs && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Parameters</p>
              <pre className="bg-muted rounded p-2 text-[11px] overflow-x-auto">{typeof parsedArgs === 'string' ? parsedArgs : JSON.stringify(parsedArgs, null, 2)}</pre>
            </div>
          )}
          {parsedResults && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Result</p>
              <pre className="bg-muted rounded p-2 text-[11px] overflow-x-auto max-h-40 overflow-y-auto">{typeof parsedResults === 'string' ? parsedResults : JSON.stringify(parsedResults, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function tc_status(tc) {
  const s = tc.status;
  if (s === 'failed' || s === 'error') return 'failed';
  if (s === 'success' || s === 'completed') return 'success';
  return 'pending';
}

function formatToolName(name) {
  if (!name) return 'Tool';
  return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}