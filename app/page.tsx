'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Activity, CheckCircle2, FileText, MessageCircle, Mic, MicOff, PhoneCall, PhoneOff, Send, ShieldCheck, ShoppingBag, Sparkles, Volume2 } from 'lucide-react';
import { MOCK_ORDERS } from '@/data/orders';

type AgentState = 'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING';

interface TranscriptItem {
  speaker: 'Customer' | 'Aria';
  text: string;
  time: string;
}

interface CallSummary {
  customer_intent: string;
  order_id: string | null;
  resolution_status: string;
  call_summary: string;
}

interface BrowserRecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}

interface BrowserRecognitionEvent {
  resultIndex: number;
  results: ArrayLike<BrowserRecognitionResult>;
}

interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: BrowserRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

export default function VoiceAgentDashboard() {
  const [callState, setCallState] = useState<AgentState>('IDLE');
  const [isCallActive, setIsCallActive] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [summary, setSummary] = useState<CallSummary | null>(null);
  const [activeTab, setActiveTab] = useState<'orders' | 'summary'>('orders');
  const [speechError, setSpeechError] = useState('');
  const [textInput, setTextInput] = useState('');
  const [isListeningEnabled, setIsListeningEnabled] = useState(false);

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const browserUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isCallActiveRef = useRef(false);
  const isListeningEnabledRef = useRef(false);
  const isRecognitionRunningRef = useRef(false);
  const isProcessingRef = useRef(false);
  const isAssistantSpeakingRef = useRef(false);

  useEffect(() => {
    const speechWindow = window as Window & {
      SpeechRecognition?: BrowserSpeechRecognitionConstructor;
      webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
    };
    const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechError('इस browser में voice recognition उपलब्ध नहीं है। Chrome या Edge में खोलें, या message type करें।');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'hi-IN';

    recognition.onstart = () => {
      isRecognitionRunningRef.current = true;
      setCallState('LISTENING');
      setSpeechError('');
    };

    recognition.onresult = (event) => {
      const result = event.results[event.resultIndex];
      const message = result?.[0]?.transcript.trim();
      if (!result?.isFinal || !message || isProcessingRef.current) return;

      isProcessingRef.current = true;
      setSpeechError('');
      recognition.stop();
      addTranscript('Customer', message);
      void handleAgentReasoning(message);
    };

    recognition.onerror = (event) => {
      const messages: Record<string, string> = {
        network: 'Browser speech service connect नहीं हो पाया। Internet जाँचें और mic फिर चालू करें।',
        'not-allowed': 'Microphone permission blocked है। Browser settings में microphone allow करें।',
        'service-not-allowed': 'Browser speech recognition उपलब्ध नहीं है। Chrome या Edge आज़माएँ।',
        'audio-capture': 'Microphone नहीं मिला। Mic connect करके दोबारा कोशिश करें।',
        'no-speech': 'आवाज़ सुनाई नहीं दी। थोड़ा पास से बोलें।',
      };
      setSpeechError(messages[event.error] || 'आवाज़ पहचानने में समस्या हुई। Mic फिर चालू करके कोशिश करें।');
      if (event.error !== 'no-speech') {
        isListeningEnabledRef.current = false;
        setIsListeningEnabled(false);
      }
      setCallState('IDLE');
    };

    recognition.onend = () => {
      isRecognitionRunningRef.current = false;
      if (
        isListeningEnabledRef.current &&
        isCallActiveRef.current &&
        !isProcessingRef.current &&
        !isAssistantSpeakingRef.current
      ) {
        window.setTimeout(() => {
          if (
            isListeningEnabledRef.current &&
            isCallActiveRef.current &&
            !isRecognitionRunningRef.current &&
            !isProcessingRef.current &&
            !isAssistantSpeakingRef.current
          ) {
            try {
              recognition.start();
            } catch {
              setSpeechError('Mic restart नहीं हो पाया। Mic बंद करके फिर चालू करें।');
              isListeningEnabledRef.current = false;
              setIsListeningEnabled(false);
              setCallState('IDLE');
            }
          }
        }, 250);
      } else if (!isAssistantSpeakingRef.current && !isProcessingRef.current) {
        setCallState('IDLE');
      }
    };

    recognitionRef.current = recognition;

    return () => {
      isListeningEnabledRef.current = false;
      isCallActiveRef.current = false;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      if (isRecognitionRunningRef.current) {
        recognition.stop();
      }
      window.speechSynthesis?.cancel();
    };
  }, []);

  const startListening = () => {
    if (
      !recognitionRef.current ||
      !isCallActiveRef.current ||
      !isListeningEnabledRef.current ||
      isRecognitionRunningRef.current ||
      isProcessingRef.current ||
      isAssistantSpeakingRef.current
    ) return;

    try {
      recognitionRef.current.start();
    } catch {
      setSpeechError('Mic start नहीं हो पाया। Browser में microphone permission जाँचें और फिर कोशिश करें।');
      isListeningEnabledRef.current = false;
      setIsListeningEnabled(false);
      setCallState('IDLE');
    }
  };

  const startCall = () => {
    isCallActiveRef.current = true;
    isListeningEnabledRef.current = false;
    isProcessingRef.current = false;
    isAssistantSpeakingRef.current = false;
    setIsListeningEnabled(false);
    setSpeechError('');
    setIsCallActive(true);
    setTranscript([]);
    setSummary(null);
    const greeting = 'नमस्ते! Aura Skincare में आपका स्वागत है। मैं आरिया हूँ। बताइए, मैं आपकी क्या मदद कर सकती हूँ?';
    addTranscript('Aria', greeting);
    speakText(greeting);
  };

  const endCall = () => {
    isCallActiveRef.current = false;
    isListeningEnabledRef.current = false;
    isProcessingRef.current = false;
    isAssistantSpeakingRef.current = false;
    setIsListeningEnabled(false);
    setIsCallActive(false);
    if (recognitionRef.current && isRecognitionRunningRef.current) {
      recognitionRef.current.stop();
    }
    window.speechSynthesis?.cancel();
    browserUtteranceRef.current = null;
    setCallState('IDLE');
    generateFinalSummary();
  };

  const toggleListening = () => {
    if (!isCallActive) return;
    if (isListeningEnabledRef.current) {
      isListeningEnabledRef.current = false;
      setIsListeningEnabled(false);
      if (recognitionRef.current && isRecognitionRunningRef.current) {
        recognitionRef.current.stop();
      }
      setCallState('IDLE');
    } else {
      setSpeechError('');
      isListeningEnabledRef.current = true;
      setIsListeningEnabled(true);
      setCallState('LISTENING');
      startListening();
    }
  };

  const submitTextMessage = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = textInput.trim();
    if (!message || !isCallActive) return;

    isProcessingRef.current = true;
    if (recognitionRef.current && isRecognitionRunningRef.current) {
      recognitionRef.current.stop();
    }
    addTranscript('Customer', message);
    setTextInput('');
    setSpeechError('');
    void handleAgentReasoning(message);
  };

  const addTranscript = (speaker: 'Customer' | 'Aria', text: string) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setTranscript((prev) => [...prev, { speaker, text, time }]);
  };

  const speakWithBrowser = (text: string) => new Promise<void>((resolve, reject) => {
    if (!window.speechSynthesis) {
      reject(new Error('Browser speech synthesis is not available.'));
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'hi-IN';
    utterance.rate = 1;
    const voices = window.speechSynthesis.getVoices();
    const hindiVoice = voices.find((voice) => voice.lang.toLowerCase() === 'hi-in');
    if (hindiVoice) {
      utterance.voice = hindiVoice;
    }

    utterance.onend = () => {
      browserUtteranceRef.current = null;
      resolve();
    };
    utterance.onerror = (event) => {
      browserUtteranceRef.current = null;
      reject(new Error(`Browser speech failed: ${event.error}`));
    };

    browserUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  });

  const speakText = (text: string) => {
    isAssistantSpeakingRef.current = true;
    setCallState('SPEAKING');
    void speakWithBrowser(text)
      .catch((error: unknown) => {
        if (isCallActiveRef.current) {
          const message = error instanceof Error ? error.message : 'Browser speech failed.';
          setSpeechError(`Aria की आवाज़ नहीं चल पाई: ${message}`);
        }
      })
      .finally(() => {
      isAssistantSpeakingRef.current = false;
      isProcessingRef.current = false;
      if (isCallActiveRef.current && isListeningEnabledRef.current) {
        startListening();
      } else if (isCallActiveRef.current) {
        setCallState('IDLE');
      }
      });
  };

  const handleAgentReasoning = async (userInput: string) => {
    setCallState('THINKING');

    // Check for order ID pattern like ORD-101, ORD-102, ORD-103
    const orderMatch = userInput.match(/ORD(?:ER)?[\s-]*(\d+)|ऑर्डर\s*(\d+)/iu);
    let reply = "";
    let detectedOrderId = orderMatch ? `ORD-${orderMatch[1] || orderMatch[2]}` : null;
    let intent = "GENERAL_INQUIRY";

    const lowerInput = userInput.toLowerCase();

    if (detectedOrderId && MOCK_ORDERS[detectedOrderId]) {
      intent = "ORDER_TRACKING";
      const order = MOCK_ORDERS[detectedOrderId];
      const status = order.status === 'Processing' ? 'तैयार किया जा रहा है' : order.status === 'Shipped' ? 'भेज दिया गया है' : 'डिलीवरी के लिए निकल चुका है';
      reply = `आपका ऑर्डर ${order.order_id} मिल गया है। इसकी स्थिति है: ${status}। क्या मैं किसी और चीज़ में मदद करूँ?`;
    } else if (detectedOrderId) {
      intent = "ORDER_TRACKING";
      reply = `मुझे ${detectedOrderId} नंबर का ऑर्डर नहीं मिला। कृपया ऑर्डर नंबर दोबारा बताइए।`;
    } else if (/return|refund|रिटर्न|रिफंड|वापस|पैसे लौट/.test(lowerInput)) {
      intent = "RETURN_POLICY";
      reply = 'डिलीवरी के 7 दिनों के भीतर, बिना खुले और इस्तेमाल न किए गए उत्पाद उनकी मूल पैकेजिंग में लौटाए जा सकते हैं। क्या आपका उत्पाद हाल ही में डिलीवर हुआ है?';
    } else if (/cancel|रद्द|कैंसिल/.test(lowerInput)) {
      intent = "CANCELLATION";
      reply = 'ऑर्डर केवल तब रद्द किया जा सकता है जब उसकी स्थिति तैयार किया जा रहा हो। अगर ऑर्डर भेज दिया गया है, तो आप दरवाज़े पर डिलीवरी लेने से मना कर सकते हैं।';
    } else if (/shipping|delivery charge|डिलीवरी|शिपिंग|चार्ज/.test(lowerInput)) {
      intent = "SHIPPING_POLICY";
      reply = '₹499 से ज़्यादा के ऑर्डर पर डिलीवरी मुफ़्त है। इससे कम के ऑर्डर पर ₹50 डिलीवरी शुल्क है। आमतौर पर डिलीवरी में 3 से 5 कार्यदिवस लगते हैं।';
    } else if (/flight|weather|movie|फ्लाइट|मौसम|फ़िल्म|फिल्म/.test(lowerInput)) {
      intent = "OUT_OF_SCOPE";
      reply = 'माफ़ कीजिए, मैं केवल Aura Skincare के उत्पादों, ऑर्डर और नीतियों से जुड़े सवालों में मदद कर सकती हूँ।';
    } else {
      reply = 'मैं Aura Skincare के उत्पादों, ऑर्डर ट्रैकिंग, डिलीवरी और रिटर्न से जुड़े सवालों में मदद कर सकती हूँ। आप किस बारे में जानना चाहेंगे?';
    }

    setTimeout(() => {
      addTranscript('Aria', reply);
      speakText(reply);

      // Update running summary state
      setSummary({
        customer_intent: intent,
        order_id: detectedOrderId,
        resolution_status: "RESOLVED",
        call_summary: `Customer asked: "${userInput}". Aria responded according to Aura Skincare brand policy.`
      });
    }, 800);
  };

  const generateFinalSummary = () => {
    setSummary({
      customer_intent: "SUPPORT_SESSION_COMPLETED",
      order_id: "ORD-101",
      resolution_status: "RESOLVED",
      call_summary: "Customer successfully interacted with Aria, verified order details, and understood brand policies."
    });
    setActiveTab('summary');
  };

  return (
    <main className="app-shell">
      <div className="app-container">
        <header className="topbar">
          <div className="brand-lockup">
            <div className="brand-mark"><ShieldCheck size={23} strokeWidth={1.7} /></div>
            <div>
              <p className="brand-name">Aura <span>Skincare</span></p>
              <p className="brand-caption">Thoughtful care, made personal</p>
            </div>
          </div>
          <div className="topbar-actions">
            <div className="secure-note"><ShieldCheck size={15} /> Private &amp; secure</div>
            {!isCallActive ? (
              <button onClick={startCall} className="call-button">
                <PhoneCall size={17} /> Start a call
              </button>
            ) : (
              <button onClick={endCall} className="call-button is-ending">
                <PhoneOff size={17} /> End call
              </button>
            )}
          </div>
        </header>

        <section className="page-intro">
          <div>
            <p className="eyebrow"><span className="eyebrow-dot" /> Your personal care assistant</p>
            <h1 className="page-title">A warmer way to <em>feel cared for.</em></h1>
            <p className="page-subtitle">Talk to Aria about your Aura Skincare orders, products, and policies.</p>
          </div>
          <div className="free-badge"><Sparkles size={14} /> Free browser voice</div>
        </section>

        <div className="dashboard-grid">
          <aside className="left-stack">
            <section className="surface-card voice-card">
              <div className="voice-card-head">
                <p className="card-kicker">Your voice assistant</p>
                <span className={`connection-pill ${isCallActive ? '' : 'is-offline'}`}>
                  <span className="live-dot" /> {isCallActive ? 'Call active' : 'Ready when you are'}
                </span>
              </div>

              <div className={`voice-orb-wrap state-${callState.toLowerCase()}`} aria-label={`Aria is ${callState.toLowerCase()}`}>
                <span className="voice-ring" />
                <span className="voice-ring voice-ring-two" />
                <div className="voice-orb">
                  {callState === 'LISTENING' ? <Mic size={34} strokeWidth={1.6} /> :
                    callState === 'THINKING' ? <Sparkles size={35} strokeWidth={1.6} /> :
                      callState === 'SPEAKING' ? <Volume2 size={35} strokeWidth={1.6} /> :
                        <Sparkles size={35} strokeWidth={1.6} />}
                  <div className="wave-bars" aria-hidden="true">
                    {Array.from({ length: 11 }, (_, index) => <span key={index} />)}
                  </div>
                </div>
              </div>

              <p className="voice-state-label">
                {callState === 'LISTENING' ? 'I’m listening' :
                  callState === 'THINKING' ? 'One moment' :
                    callState === 'SPEAKING' ? 'Aria is speaking' :
                      isCallActive ? 'Ready for you' : 'Meet Aria'}
              </p>
              <p className="voice-state-copy">
                {!isCallActive ? 'Start a call, then turn on your mic to chat hands-free.' :
                  callState === 'LISTENING' ? 'Go ahead, tell me what you need help with.' :
                    callState === 'THINKING' ? 'Aria is finding the right answer for you.' :
                      callState === 'SPEAKING' ? 'Listen to Aria’s response.' : 'Your call is open. Whenever you’re ready.'}
              </p>

              {isCallActive && (
                <>
                  <button
                    onClick={toggleListening}
                    className={`mic-button ${isListeningEnabled ? 'is-on' : ''}`}
                    aria-pressed={isListeningEnabled}
                  >
                    {isListeningEnabled ? <Mic size={18} /> : <MicOff size={18} />}
                    {isListeningEnabled ? 'Mic on · click to pause' : 'Turn on microphone'}
                  </button>
                  {speechError && <p role="status" className="speech-error">{speechError}</p>}
                  <form onSubmit={submitTextMessage} className="composer">
                    <input
                      type="text"
                      value={textInput}
                      onChange={(event) => setTextInput(event.target.value)}
                      placeholder="Or type a message..."
                      aria-label="Type a message to Aria"
                    />
                    <button type="submit" disabled={!textInput.trim()} className="send-button" aria-label="Send message">
                      <Send size={15} />
                    </button>
                  </form>
                </>
              )}
            </section>

            <section className="surface-card orders-card">
              <div className="section-heading">
                <div className="panel-title-group">
                  <span className="heading-icon"><ShoppingBag size={16} /></span>
                  <h2 className="section-title">Sample orders</h2>
                </div>
                <span className="helper-link">Try an order ID</span>
              </div>
              <p className="section-description">Ask Aria about one of these example orders.</p>
              <div className="orders-list">
                {Object.values(MOCK_ORDERS).map((ord, index) => (
                  <article key={ord.order_id} className="order-item" style={{ animationDelay: `${index * 70}ms` }}>
                    <div className="order-topline">
                      <span className="order-id">{ord.order_id}</span>
                      <span className="order-status">{ord.status}</span>
                    </div>
                    <p className="order-product">{ord.product} <span>· ₹{ord.value}</span></p>
                    <p className="order-notes">{ord.notes}</p>
                  </article>
                ))}
              </div>
            </section>
          </aside>

          <section className="surface-card conversation-card">
            <div className="panel-heading">
              <div className="panel-title-group">
                <span className="conversation-icon"><MessageCircle size={18} /></span>
                <div>
                  <h2 className="panel-title">Conversation</h2>
                  <p className="panel-subtitle">A little help, whenever you need it</p>
                </div>
              </div>
              <span className="transcript-pill"><Activity size={13} /> {transcript.length} messages</span>
            </div>

            <div className="panel-tabs" role="tablist" aria-label="Conversation details">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'orders'}
                onClick={() => setActiveTab('orders')}
                className={`tab-button ${activeTab === 'orders' ? 'is-active' : ''}`}
              >
                Live transcript
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'summary'}
                onClick={() => setActiveTab('summary')}
                className={`tab-button ${activeTab === 'summary' ? 'is-active' : ''}`}
              >
                Call summary
              </button>
            </div>

            <div className="panel-body">
              {activeTab === 'orders' ? (
                transcript.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon"><MessageCircle size={28} strokeWidth={1.5} /></div>
                    <p className="empty-title">Your conversation starts here</p>
                    <p className="empty-copy">Start a call with Aria. Your conversation will appear here as you chat.</p>
                  </div>
                ) : (
                  <div className="transcript-list" aria-live="polite">
                    {transcript.map((item, index) => (
                      <article key={`${item.time}-${index}`} className={`transcript-message ${item.speaker === 'Customer' ? 'is-customer' : ''}`}>
                        <div className="speaker-line">
                          <span className="speaker-avatar">
                            {item.speaker === 'Customer' ? <MessageCircle size={12} /> : <Sparkles size={12} />}
                          </span>
                          <span className="speaker-name">{item.speaker === 'Customer' ? 'You' : 'Aria'}</span>
                          <span className="message-time">{item.time}</span>
                        </div>
                        <div className="message-bubble">{item.text}</div>
                      </article>
                    ))}
                  </div>
                )
              ) : (
                <div className="summary-panel">
                  <div className="summary-intro">
                    <CheckCircle2 size={16} />
                    <span>A concise overview of your support conversation.</span>
                  </div>
                  <pre className="summary-code">{JSON.stringify(summary || {
                    customer_intent: 'PENDING',
                    order_id: null,
                    resolution_status: 'IN_PROGRESS',
                    call_summary: 'Your call summary will appear here.'
                  }, null, 2)}</pre>
                </div>
              )}
              <footer className="panel-footer">
                <span className="footer-status"><CheckCircle2 size={13} /> Your conversation stays on this device</span>
                <span className="panel-footer-hint">Aria is here to help with Aura Skincare</span>
              </footer>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}