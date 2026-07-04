import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Mic, X, Loader2, Volume2, VolumeX } from 'lucide-react';

const WAKE_WORD = 'cedar';

export default function VoiceAgent() {
  const [enabled, setEnabled] = useState(false);
  const [listening, setListening] = useState(false);
  const [awake, setAwake] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [lastResponse, setLastResponse] = useState('');
  const recognitionRef = useRef(null);
  const wakeTimeoutRef = useRef(null);
  const awakeRef = useRef(false);

  const speak = useCallback((text) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
    setListening(false);
  }, []);

  const handleCommand = useCallback(async (command) => {
    const cmd = command.toLowerCase().trim();
    setTranscript(command);
    setProcessing(true);

    // Timer/pomodoro commands — dispatch events for PomodoroTimer
    if (/(start|begin).*(timer|study|pomodoro|session)|start studying/.test(cmd)) {
      window.dispatchEvent(new CustomEvent('cedar-pomodoro', { detail: { action: 'start' } }));
      speak('Starting your study timer now.');
      setProcessing(false);
      return;
    }
    if (/(pause|stop|hold).*(timer|study|pomodoro|session)/.test(cmd)) {
      window.dispatchEvent(new CustomEvent('cedar-pomodoro', { detail: { action: 'pause' } }));
      speak('Pausing your timer.');
      setProcessing(false);
      return;
    }
    if (/(resume|continue|keep going)/.test(cmd)) {
      window.dispatchEvent(new CustomEvent('cedar-pomodoro', { detail: { action: 'resume' } }));
      speak('Resuming your timer.');
      setProcessing(false);
      return;
    }
    if (/(take|start).*(break|rest)/.test(cmd)) {
      window.dispatchEvent(new CustomEvent('cedar-pomodoro', { detail: { action: 'break' } }));
      speak('Taking a break now.');
      setProcessing(false);
      return;
    }
    if (/(end|finish|done|quit).*(session|timer|study)/.test(cmd)) {
      window.dispatchEvent(new CustomEvent('cedar-pomodoro', { detail: { action: 'end' } }));
      speak('Ending your session. Great work.');
      setProcessing(false);
      return;
    }

    // General AI query — send to academic_assistant agent
    try {
      let conv = null;
      const convs = await base44.agents.listConversations({ agent_name: 'academic_assistant' });
      if (convs.length > 0) {
        conv = convs[0];
      } else {
        conv = await base44.agents.createConversation({
          agent_name: 'academic_assistant',
          metadata: { name: 'Voice Chat' },
        });
      }
      conv = await base44.agents.getConversation(conv.id);
      await base44.agents.addMessage(conv, { role: 'user', content: command });

      // Wait for response via subscription
      const responseText = await new Promise((resolve) => {
        let resolved = false;
        const unsub = base44.agents.subscribeToConversation(conv.id, (data) => {
          const msgs = data.messages || [];
          const last = msgs[msgs.length - 1];
          if (last && last.role === 'assistant' && last.content && !last.tool_calls?.some(tc => ['pending', 'running', 'in_progress'].includes(tc.status))) {
            if (!resolved) {
              resolved = true;
              unsub();
              resolve(last.content);
            }
          }
        });
        setTimeout(() => { if (!resolved) { unsub(); resolve(null); } }, 30000);
      });

      const responseClean = responseText ? responseText.replace(/[#*_`]/g, '').substring(0, 500) : 'Sorry, I could not process that.';
      setLastResponse(responseClean);
      speak(responseClean);
    } catch (e) {
      speak('Sorry, something went wrong.');
    }
    setProcessing(false);
  }, [speak]);

  // Initialize speech recognition
  useEffect(() => {
    if (!enabled) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice recognition is not supported in this browser. Please use Chrome.');
      setEnabled(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript.toLowerCase().trim();
      setTranscript(text);

      if (!awakeRef.current) {
        // Check for wake word
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
        // Already awake — treat as command
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
      setListening(false);
      // Restart if still enabled
      if (enabled && !processing) {
        setTimeout(() => {
          try { recognition.start(); setListening(true); } catch (e) {}
        }, 200);
      }
    };

    recognitionRef.current = recognition;

    try { recognition.start(); setListening(true); } catch (e) {}

    return () => {
      clearTimeout(wakeTimeoutRef.current);
      try { recognition.stop(); } catch (e) {}
    };
  }, [enabled, processing, speak, handleCommand]);

  // Listen for voice prompts from PomodoroTimer
  useEffect(() => {
    const handler = (e) => {
      const { text } = e.detail;
      speak(text);
    };
    window.addEventListener('cedar-speak', handler);
    return () => window.removeEventListener('cedar-speak', handler);
  }, [speak]);

  // Handle voice responses for pomodoro confirmations
  useEffect(() => {
    if (!enabled) return;
    const handler = (e) => {
      const { question, onResponse } = e.detail;
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) return;

      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';
      rec.onresult = (event) => {
        const text = event.results[0][0].transcript.toLowerCase().trim();
        onResponse(text);
      };
      rec.onerror = () => onResponse('timeout');
      rec.onend = () => {};
      try { rec.start(); } catch (e) {}
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
      {!processing && awake && (
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
        onClick={() => { setEnabled(false); setAwake(false); awakeRef.current = false; }}
        className="w-12 h-12 rounded-full bg-destructive text-destructive-foreground shadow-lg flex items-center justify-center hover:bg-destructive/90 transition-colors"
        title="Disable voice agent"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}