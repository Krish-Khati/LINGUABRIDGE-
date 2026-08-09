import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { VoiceVisualizer } from "./components/VoiceVisualizer";
import { 
  Globe, 
  Mic,
  Square,
  Copy, 
  Check, 
  Trash2, 
  Languages, 
  History, 
  AlertCircle,
  MessageCircle,
  Play,
  ArrowRightLeft,
  Sun,
  Moon,
  ArrowDown
} from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
  audio?: string; // base64
}

const VOICE_LANGUAGES = [
  { code: "English", name: "English" },
  { code: "Spanish", name: "Spanish (Español)" },
  { code: "French", name: "French (Français)" },
  { code: "German", name: "German (Deutsch)" },
  { code: "Italian", name: "Italian (Italiano)" },
  { code: "Hindi", name: "Hindi (हिन्दी)" },
  { code: "Japanese", name: "Japanese (日本語)" },
  { code: "Chinese", name: "Chinese (中文)" },
  { code: "Arabic", name: "Arabic (العربية)" },
  { code: "Russian", name: "Russian (Русский)" },
];

const LANGUAGES = [
  { code: "", name: "Auto-detect / English Default" },
  ...VOICE_LANGUAGES
];

export default function App() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [activeTab, setActiveTab] = useState<"text" | "voice">("text");

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  // Text Mode State
  const [sourceText, setSourceText] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("");
  const [textResult, setTextResult] = useState("");
  const [isLoadingText, setIsLoadingText] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);

  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      const isScrolledUp = scrollHeight - scrollTop - clientHeight > 100;
      setShowScrollBottom(isScrolledUp);
    }
  };

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };


  useEffect(() => {
    const handler = setTimeout(() => {
      if (sourceText.trim().length > 2) {
        setIsDetecting(true);
        fetch("/api/detect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: sourceText }),
        })
          .then(res => res.json())
          .then(data => {
            setDetectedLanguage(data.language);
          })
          .catch(() => setDetectedLanguage(null))
          .finally(() => setIsDetecting(false));
      } else {
        setDetectedLanguage(null);
      }
    }, 800);
    return () => clearTimeout(handler);
  }, [sourceText]);

  // Voice Mode State
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isLoadingVoice, setIsLoadingVoice] = useState(false);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (activeTab === "voice") {
      scrollToBottom();
    }
  }, [chatHistory, isLoadingVoice, activeTab]);



  const handleTranslateText = async () => {
    if (!sourceText.trim()) return;
    
    setIsLoadingText(true);
    setTextResult("");

    try {
      const response = await fetch("/api/interact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "text",
          text: sourceText,
          targetLanguage: targetLanguage,
        }),
      });

      const data = await response.json();
      if (data.text) {
        setTextResult(data.text);
      } else {
        setTextResult("⚠️ Sorry, something went wrong.");
      }
    } catch (err: any) {
      console.error(err);
      setTextResult("⚠️ Sorry, something went wrong. Please try again.");
    } finally {
      setIsLoadingText(false);
    }
  };

  const copyToClipboard = async (textToCopy: string, setCopied: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setActiveStream(stream);
      
      let mimeType = 'audio/webm';
      const types = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav'];
      for (const t of types) {
        if (MediaRecorder.isTypeSupported(t)) {
          mimeType = t;
          break;
        }
      }

      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || mimeType });
        await handleVoiceSubmit(audioBlob);
        stream.getTracks().forEach(track => track.stop());
        setActiveStream(null);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Microphone access is required or not supported properly on this browser.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setActiveStream(null);
    }
  };

  const handleVoiceSubmit = async (audioBlob: Blob) => {
    setIsLoadingVoice(true);

    // Convert blob to base64
    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    reader.onloadend = async () => {
      const base64String = (reader.result as string).split(',')[1];

      // Add a temporary user message
      const userMsgId = Math.random().toString(36).substring(7);
      setChatHistory(prev => [...prev, { id: userMsgId, role: "user", text: "🎙️ (Audio sent)" }]);

      try {
        const response = await fetch("/api/interact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "voice",
            audio: { data: base64String, mimeType: audioBlob.type || "audio/webm" },
            history: chatHistory.map(msg => ({ role: msg.role, text: msg.text }))
          }),
        });

        const data = await response.json();
        
        // Add model reply
        if (data.text) {
          setChatHistory(prev => [...prev, { 
            id: Math.random().toString(36).substring(7), 
            role: "model", 
            text: data.text,
            audio: data.audio 
          }]);

          if (data.audio) {
            playAudio(data.audio);
          }
        }
      } catch (err) {
        console.error(err);
        setChatHistory(prev => [...prev, { 
          id: Math.random().toString(36).substring(7), 
          role: "model", 
          text: "Something went wrong. Please try again." 
        }]);
      } finally {
        setIsLoadingVoice(false);
      }
    };
  };

  const playAudio = (base64Audio: string) => {
    try {
      const audio = new Audio("data:audio/wav;base64," + base64Audio);
      audio.play().catch(e => console.error("Audio playback error:", e));
    } catch(err) {
      console.error("Failed to play audio:", err);
    }
  };

  const clearChat = () => setChatHistory([]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 flex flex-col font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 shadow-sm dark:shadow-none">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl text-white">
              <Languages className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">LinguaBridge</h1>
              <p className="text-xs text-slate-500 dark:text-slate-300 font-medium">Text Translation & Voice Interpreter</p>
            </div>
          </div>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            title="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-4xl w-full mx-auto p-4 md:p-6 space-y-6">
        
        {/* Tabs */}
        <div className="flex bg-slate-200/60 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab("text")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold rounded-lg transition-all ${
              activeTab === "text" 
                ? "bg-white dark:bg-slate-800 text-indigo-700 shadow-sm dark:shadow-none" 
                : "text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:text-slate-300"
            }`}
          >
            <Globe className="w-4 h-4" />
            Text Translation
          </button>
          <button 
            onClick={() => setActiveTab("voice")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold rounded-lg transition-all ${
              activeTab === "voice" 
                ? "bg-white dark:bg-slate-800 text-indigo-700 shadow-sm dark:shadow-none" 
                : "text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:text-slate-300"
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            Voice Interpreter
          </button>
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === "text" && (
            <motion.section
              key="text-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none p-4 md:p-6 space-y-5"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider">Input Text</label>
                  <AnimatePresence>
                    {(isDetecting || detectedLanguage) && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full flex items-center gap-1.5"
                      >
                        {isDetecting ? (
                          <>
                            <div className="w-2.5 h-2.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-300">Detecting...</span>
                          </>
                        ) : detectedLanguage && detectedLanguage !== "Unknown" ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span className="text-[10px] font-semibold text-slate-600">Detected: {detectedLanguage}</span>
                          </>
                        ) : (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-300">Unknown Language</span>
                          </>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <textarea
                  className="w-full min-h-[140px] p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-slate-800 transition-all resize-y text-base"
                  placeholder="Type text here..."
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-end border-t border-slate-100 dark:border-slate-800 pt-5">
                <div className="flex-1 space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider">Target Language (Optional)</label>
                  <select
                    value={targetLanguage}
                    onChange={(e) => setTargetLanguage(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-indigo-500/20"
                  >
                    {LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code}>{lang.name}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleTranslateText}
                  disabled={isLoadingText || !sourceText.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-700 text-white font-semibold text-sm px-6 py-2.5 rounded-xl transition-all shadow-sm dark:shadow-none flex justify-center items-center gap-2 cursor-pointer"
                >
                  {isLoadingText ? "Translating..." : "Translate"}
                </button>
              </div>

              {/* Text Result */}
              {textResult && (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }}
                  className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <SparklesIcon /> Result
                    </h3>
                    <button
                      onClick={() => copyToClipboard(textResult, setCopiedText)}
                      className="text-xs flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 font-semibold transition-colors"
                    >
                      {copiedText ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedText ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <div className="bg-slate-900 text-slate-200 p-4 rounded-xl font-mono text-sm whitespace-pre-wrap leading-relaxed">
                    {textResult}
                  </div>
                </motion.div>
              )}
            </motion.section>
          )}

          {activeTab === "voice" && (
            <motion.section
              key="voice-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none overflow-hidden flex flex-col h-[500px] relative"
            >
              {/* Chat History Area */}
              <div 
                ref={chatContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-slate-50 dark:bg-slate-900">
                {chatHistory.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-400 space-y-3">
                    <Mic className="w-10 h-10 text-slate-300 dark:text-slate-500" />
                    <p className="text-sm font-medium">Tap the microphone and start speaking.</p>
                  </div>
                ) : (
                  chatHistory.map((msg) => (
                    <div 
                      key={msg.id} 
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                        msg.role === "user" 
                          ? "bg-indigo-600 text-white rounded-br-none shadow-sm dark:shadow-none" 
                          : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-none shadow-sm dark:shadow-none"
                      }`}>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap font-medium">{msg.text}</p>
                        {msg.audio && (
                          <button 
                            onClick={() => playAudio(msg.audio!)}
                            className="mt-2 text-xs flex items-center gap-1.5 text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 px-2.5 py-1 rounded-full font-bold transition-colors w-fit"
                          >
                            <Play className="w-3 h-3 fill-current" /> Play audio
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
                {isLoadingVoice && (
                  <div className="flex justify-start">
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm dark:shadow-none flex gap-1 items-center">
                      <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                      <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Floating Scroll to Bottom Button */}
              <AnimatePresence>
                {showScrollBottom && (
                  <motion.button
                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.9 }}
                    onClick={scrollToBottom}
                    className="absolute bottom-24 right-6 w-10 h-10 bg-slate-800 dark:bg-slate-700 text-white rounded-full flex items-center justify-center shadow-lg transition-all hover:bg-slate-700 dark:hover:bg-slate-600 z-10"
                  >
                    <ArrowDown className="w-5 h-5" />
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Voice Controls */}
              <div className="border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800 p-4 flex items-center justify-center gap-4 relative">
                {chatHistory.length > 0 && (
                  <button 
                    onClick={clearChat}
                    className="absolute left-4 text-xs font-semibold text-slate-400 dark:text-slate-400 hover:text-rose-500 transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Clear
                  </button>
                )}

                {!isRecording ? (
                  <button
                    onClick={startRecording}
                    disabled={isLoadingVoice}
                    className="w-14 h-14 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-full flex items-center justify-center shadow-lg shadow-indigo-600/30 transition-all cursor-pointer hover:scale-105 active:scale-95"
                  >
                    <Mic className="w-6 h-6" />
                  </button>
                ) : (
                  <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900 pl-6 pr-2 py-2 rounded-full border border-slate-200 dark:border-slate-700 shadow-inner dark:shadow-none">
                    <VoiceVisualizer stream={activeStream} />
                    <button
                      onClick={stopRecording}
                      className="w-10 h-10 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center shadow-md transition-all cursor-pointer hover:scale-105 active:scale-95"
                    >
                      <Square className="w-4 h-4 fill-current" />
                    </button>
                  </div>
                )}
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-slate-500 dark:text-slate-300 font-medium">
        Developed by <span className="font-bold text-indigo-600">KRRISH</span>
      </footer>
    </div>
  );
}

function SparklesIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
    </svg>
  );
}
