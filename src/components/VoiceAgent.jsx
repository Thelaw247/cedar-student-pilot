import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Mic, X, Loader2, Volume2 } from 'lucide-react';

const WAKE_WORD = 'cedar';

export default function VoiceAgent() {
  const [enabled, setEnabled] = useState(false);
  const [listening, setListening] = useState(false);
  const [awake, setAwake] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [lastResponse, setLastResponse] = useState('');
  const [speaking, setSpeaking] = useState(false);

  const recognitionRef = useRef(null);
  const wakeTimeoutRef = useRef(null);
  const enabledRef = useRef(false);
  const processingRef = useRef(false);
  const awakeRef = useRef(false);
  const conversationRef = useRef(null);
  const utteranceRef = useRef(null);
  const voicesRef = useRef([]);
  const speakingRef = useRef(false);
  const listeningRef = useRef(false);

  // Keep refs in sync
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);
  useEffect(() => { processingRef.current = processing; }, [processing]);
  useEffect(() => { awakeRef.current = awake; }, [awake]);
  useEffect(() => { speakingRef.current = speaking; }, [speaking]);
  useEffect(() => { listeningRef.current = listening; }, [listening]);

  const speak = useCallback((text) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);

    // Small delay to let cancel take effect
    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1;
      utterance.volume = 1;

      // Pick a good English voice if available
      const voices = voicesRef.current;
      if (voices.length > 0) {
        const preferred = voices.find(v => v.lang.startsWith('en') && /female|samantha|google|natural/i.test(v.name))
          || voices.find(v => v.lang.startsWith('en'))
          || voices[0];
        if (preferred) utterance.voice = preferred;
      }

      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);

      // Keep a ref so it doesn't get garbage collected mid-speech
      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    }, 100);
  }, []);

  // Load voices (Chrome loads them asynchronously)
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) voicesRef.current = voices;
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  const getOrCreateConversation = useCallback(async () => {
    if (conversationRef.current) return conversationRef.current;
    const convs = await base44.agents.listConversations({ agent_name: 'academic_assistant' });
    let conv = convs.length > 0 ? convs[0] : await base44.agents.createConversation({
      agent_name: 'academic_assistant',
      metadata: { name: 'Voice Chat' },
    });
    conv = await base44.agents.getConversation(conv.id);
    conversationRef.current = conv;
    return conv;
  }, []);

  const waitForAgentResponse = useCallback(async (conversationId, userMessageText) => {
    // Poll for the assistant's response — more reliable than subscription for one-shot queries
    const maxAttempts = 30; // 60 seconds max
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 2000));
      try {
        const conv = await base44.agents.getConversation(conversationId);
        const msgs = conv.messages || [];
        // Find the last assistant message after the user's message
        let userMsgIndex = -1;
        for (let j = msgs.length - 1; j >= 0; j--) {
          if (msgs[j].role === 'user' && msgs[j].content === userMessageText) {
            userMsgIndex = j;
            break;
          }
        }
        if (userMsgIndex === -1) continue;

        // Look for an assistant message after the user message
        for (let j = msgs.length - 1; j > userMsgIndex; j--) {
          const msg = msgs[j];
          if (msg.role === 'assistant') {
            // Check if all tool calls are done
            const toolCallsPending = msg.tool_calls?.some(tc =>
              ['pending', 'running', 'in_progress'].includes(tc.status)
            );
            if (toolCallsPending) continue;
            // Has content and is complete
            if (msg.content && msg.content.trim().length > 0) {
              return msg.content;
            }
          }
        }
      } catch (e) {
        // keep polling
      }
    }
    return null;
  }, []);

  const handleCommand = useCallback(async (command) => {
    setTranscript(command);
    setProcessing(true);
    processingRef.current = true;

    const cmd = command.toLowerCase().trim();

    // Timer/pomodoro commands
    if (/(start|begin).*(timer|study|pomodoro|session)|start studying/.test(cmd)) {
      window.dispatchEvent(new CustomEvent('cedar-pomodoro', { detail: { action: 'start' } }));
      speak('Starting your study timer now.');
      setProcessing(false);
      processingRef.current = false;
      return;
    }
    if (/(pause|stop|hold).*(timer|study|pomodoro|session)/.test(cmd)) {
      window.dispatchEvent(new CustomEvent('cedar-pomodoro', { detail: { action: 'pause' } }));
      speak('Pausing your timer.');
      setProcessing(false);
      processingRef.current = false;
      return;
    }
    if (/(resume|continue|keep going)/.test(cmd) && !/(break|rest)/.test(cmd)) {
      window.dispatchEvent(new CustomEvent('cedar-pomodoro', { detail: { action: 'resume' } }));
      speak('Resuming your timer.');
      setProcessing(false);
      processingRef.current = false;
      return;
    }
    if (/(take|start).*(break|rest)/.test(cmd)) {
      window.dispatchEvent(new CustomEvent('cedar-pomodoro', { detail: { action: 'break' } }));
      speak('Taking a break now.');
      setProcessing(false);
      processingRef.current = false;
      return;
    }
    if (/(end|finish|done|quit).*(session|timer|study)/.test(cmd)) {
      window.dispatchEvent(new CustomEvent('cedar-pomodoro', { detail: { action: 'end' } }));
      speak('Ending your session. Great work.');
      setProcessing(false);
      processingRef.current = false;
      return;
    }

    // General AI query
    try {
      const conv = await getOrCreateConversation();
      await base44.agents.addMessage(conv, { role: 'user', content: command });

      const responseText = await waitForAgentResponse(conv.id, command);

      if (responseText) {
        const cleaned = responseText.replace(/[#*_`]/g, '').substring(0, 500);
        setLastResponse(cleaned);
        speak(cleaned);
      } else {
        const fallback = 'I could not find an answer in your lectures. Try asking in the AI Assistant chat for more detail.';
        setLastResponse(fallback);
        speak(fallback);
      }
    } catch (e) {
      const errMsg = 'Sorry, something went wrong connecting to your assistant.';
      setLastResponse(errMsg);
      speak(errMsg);
    }

    setProcessing(false);
    processingRef.current = false;
  }, [speak, getOrCreateConversation, waitForAgentResponse]);

  // Initialize speech recognition — only depends on `enabled`
  useEffect(() => {
    if (!enabled) return;

    const speechWindow = /** @type {Window & {SpeechRecognition?: any, webkitSpeechRecognition?: any}} */ (window);
    const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice recognition is not supported in this browser. Please use Chrome.');
      setEnabled(false);
      return;
    }

    let shouldRestart = true;

    const startRecognition = () => {
      if (!enabledRef.current || processingRef.current || speakingRef.current || listeningRef.current) return;
      try {
        recognition.start();
        listeningRef.current = true;
        setListening(true);
      } catch (e) {
        // already running — ignore
      }
    };

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript.toLowerCase().trim();
      setTranscript(text);

      if (!awakeRef.current) {
        if (text.includes(WAKE_WORD)) {
          awakeRef.current = true;
          setAwake(true);
          speak("Yes? I'm listening.");
          clearTimeout(wakeTimeoutRef.current);
          wakeTimeoutRef.current = setTimeout(() => {
            awakeRef.current = false;
            setAwake(false);
          }, 15000);
        }
      } else {
        awakeRef.current = false;
        setAwake(false);
        clearTimeout(wakeTimeoutRef.current);
        if (text.length > 2) {
          handleCommand(text);
        }
      }
    };

    recognition.onerror = (event) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.error('Speech recognition error:', event.error);
      }
    };

    recognition.onend = () => {
      listeningRef.current = false;
      setListening(false);
      // Restart after a short delay if still enabled, not processing, and not speaking
      if (shouldRestart && enabledRef.current && !processingRef.current && !speakingRef.current) {
        setTimeout(() => startRecognition(), 300);
      }
    };

    recognitionRef.current = recognition;
    startRecognition();

    // Watch for processing state changes to restart recognition when done
    const checkInterval = setInterval(() => {
      if (enabledRef.current && !processingRef.current && !speakingRef.current && !listeningRef.current) {
        startRecognition();
      }
    }, 1000);

    return () => {
      shouldRestart = false;
      clearInterval(checkInterval);
      clearTimeout(wakeTimeoutRef.current);
      try { recognition.stop(); } catch (e) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // Listen for speak events from PomodoroTimer
  useEffect(() => {
    const handler = (e) => speak(e.detail.text);
    window.addEventListener('cedar-speak', handler);
    return () => window.removeEventListener('cedar-speak', handler);
  }, [speak]);

  // Handle voice prompts from pomodoro confirmations
  useEffect(() => {
    if (!enabled) return;
    const handler = (e) => {
      const { onResponse } = e.detail;
      const speechWindow = /** @type {Window & {SpeechRecognition?: any, webkitSpeechRecognition?: any}} */ (window);
      const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
      if (!SpeechRecognition) { onResponse('timeout'); return; }

      // Pause the main recognition temporarily
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }

      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';
      const timeout = setTimeout(() => { try { rec.stop(); } catch (e) {} onResponse('timeout'); }, 15000);
      rec.onresult = (event) => {
        clearTimeout(timeout);
        const text = event.results[0][0].transcript.toLowerCase().trim();
        onResponse(text);
      };
      rec.onerror = () => { clearTimeout(timeout); onResponse('timeout'); };
      try { rec.start(); } catch (e) { clearTimeout(timeout); onResponse('timeout'); }
    };
    window.addEventListener('cedar-voice-prompt', handler);
    return () => window.removeEventListener('cedar-voice-prompt', handler);
  }, [enabled]);

  if (!enabled) {
    return (
      <button
        onClick={() => setEnabled(true)}
        className="fixed bottom-20 lg:bottom-6 right-4 z-40 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors"
        title="Enable voice agent"
      >
        <Mic className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-20 lg:bottom-6 right-4 z-40 flex items-center gap-2">
      {processing && (
        <div className="bg-card border border-border rounded-full px-3 py-1.5 shadow-lg flex items-center gap-2 max-w-[200px]">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary flex-shrink-0" />
          <p className="text-xs text-muted-foreground truncate">{transcript}</p>
        </div>
      )}
      {speaking && !awake && (
        <div className="bg-primary text-primary-foreground rounded-full px-3 py-1.5 shadow-lg flex items-center gap-2">
          <Volume2 className="w-3.5 h-3.5 animate-pulse" />
          <p className="text-xs font-medium">Speaking...</p>
        </div>
      )}
      {!processing && !speaking && awake && (
        <div className="bg-primary text-primary-foreground rounded-full px-3 py-1.5 shadow-lg">
          <p className="text-xs font-medium">🎤 Listening...</p>
        </div>
      )}
      {!processing && !awake && lastResponse && (
        <div className="bg-card border border-border rounded-full px-3 py-1.5 shadow-lg max-w-[250px]">
          <p className="text-xs text-muted-foreground truncate">{lastResponse}</p>
        </div>
      )}
      {!processing && !awake && !lastResponse && listening && (
        <div className="bg-card border border-border rounded-full px-3 py-1.5 shadow-lg">
          <p className="text-xs text-muted-foreground">Say "Cedar" to start</p>
        </div>
      )}
      <button
        onClick={() => {
          setEnabled(false);
          setAwake(false);
          awakeRef.current = false;
          processingRef.current = false;
        }}
        className="w-12 h-12 rounded-full bg-destructive text-destructive-foreground shadow-lg flex items-center justify-center hover:bg-destructive/90 transition-colors"
        title="Disable voice agent"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}
