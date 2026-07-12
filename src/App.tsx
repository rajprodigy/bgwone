/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { 
  FileText, 
  Send, 
  Upload, 
  Trash2, 
  Bot, 
  User, 
  ChevronRight, 
  Loader2,
  X,
  MessageSquare,
  Sparkles,
  Plus,  
  Menu,
  Globe,
  LogOut,
  Mic,
  MicOff,
  Volume2,
  VolumeX
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { 
  chatWithPdf, 
  chatWithContext, 
  getEmbeddings, 
  cosineSimilarity, 
  translateText,
  type Message, 
  type Chunk,
  retrieveRagContextFromPastMessages
} from "./lib/gemini";
import { extractTextFromPdf, chunkText } from "./lib/pdfUtils";
import { auth, loginWithGoogle, logout, isAdmin as checkAdmin, saveGitaData, loadGitaData } from "./lib/firebase";
import { saveMessageToRag, searchRagStorage, type StoredMessage } from "./lib/ragStorage";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: string;
}

const loadSessionsFromLocalStorage = (): ChatSession[] => {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const data = window.localStorage.getItem("_gita_chat_sessions_v1");
      if (data) return JSON.parse(data);
    }
  } catch (e) {
    console.warn("localStorage read failed:", e);
  }
  return [];
};

const saveSessionsToLocalStorage = (sessions: ChatSession[]) => {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem("_gita_chat_sessions_v1", JSON.stringify(sessions));
    }
  } catch (e) {
    console.warn("localStorage write failed:", e);
  }
};

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [file, setFile] = useState<{ name: string; base64: string; extractedText?: string; pdfUrl?: string; pdfSize?: number } | null>(null);
  const [vectorStore, setVectorStore] = useState<Chunk[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAdminUser, setIsAdminUser] = useState(false);
  
  // Chat Session states
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>("");
  const [language, setLanguage] = useState<string>("English");

  const languageRef = useRef(language);
  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  const [messageTranslations, setMessageTranslations] = useState<Record<number, { text: string; lang: string }>>({});
  const [translatingIndex, setTranslatingIndex] = useState<number | null>(null);
  
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;

      rec.onresult = async (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          const currentLang = languageRef.current;
          let textToInsert = transcript;

          if (currentLang && currentLang !== "English") {
            try {
              setStatus(`Translating speech to ${currentLang}...`);
              textToInsert = await translateText(transcript, currentLang);
            } catch (err) {
              console.error("Speech translation error:", err);
            } finally {
              setStatus(null);
            }
          }

          setInputText(prev => {
            const base = prev.trim();
            return base ? `${base} ${textToInsert.trim()}` : textToInsert.trim();
          });
        }
      };

      rec.onerror = (event: any) => {
        if (event.error === "no-speech") {
          console.warn("Speech recognition ended: no speech was detected.");
          setIsListening(false);
          return;
        }
        console.error("Speech recognition error:", event.error);
        
        // Handle browser limitations for unsupported locales (like sa-IN, ml-IN, etc.) gracefully.
        // Fallback to English and restart so the user can speak in English and get it translated.
        if (event.error === "language-not-supported" || event.error === "not-allowed" || event.error === "service-not-allowed") {
          if (rec.lang !== "en-US") {
            console.log("Selected speech language not supported by browser. Falling back to English with translation...");
            rec.lang = "en-US";
            try {
              rec.start();
              setIsListening(true);
              return;
            } catch (retryErr) {
              console.error("Speech recognition retry failed:", retryErr);
            }
          }
        }
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      setRecognition(rec);
    }
  }, []);

  const toggleListening = () => {
    if (!recognition) {
      setError("Speech recognition is not supported in this browser. Try Chrome or Safari.");
      setTimeout(() => setError(null), 4000);
      return;
    }

    if (isListening) {
      recognition.stop();
    } else {
      const langMap: Record<string, string> = {
        "English": "en-US",
        "Hindi": "hi-IN",
        "Spanish": "es-ES",
        "Sanskrit": "en-US", // Map Sanskrit input directly to English since sa-IN is unsupported on browsers, enabling auto-translation!
        "French": "fr-FR",
        "German": "de-DE",
        "Telugu": "te-IN",
        "Tamil": "ta-IN",
        "Bengali": "bn-IN",
        "Marathi": "mr-IN",
        "Gujarati": "gu-IN",
        "Kannada": "kn-IN",
        "Malayalam": "ml-IN"
      };
      recognition.lang = langMap[language] || "en-US";
      
      try {
        recognition.start();
        setIsListening(true);
      } catch (err) {
        console.error("Failed to start speech recognition:", err);
        setIsListening(false);
      }
    }
  };


  const handleTranslateMessage = async (msgIndex: number, text: string, targetLang: string) => {
    if (targetLang === "Original") {
      const updated = { ...messageTranslations };
      delete updated[msgIndex];
      setMessageTranslations(updated);
      return;
    }

    setTranslatingIndex(msgIndex);
    try {
      const translated = await translateText(text, targetLang);
      setMessageTranslations(prev => ({
        ...prev,
        [msgIndex]: { text: translated, lang: targetLang }
      }));
    } catch (err) {
      console.error("Translation fail:", err);
    } finally {
      setTranslatingIndex(null);
    }
  };

  const handleGlobalLanguageChange = async (targetLang: string) => {
    setLanguage(targetLang);
    if (!messages || messages.length === 0) return;

    if (targetLang === "English") {
      setMessageTranslations({});
      return;
    }

    // Translate all model messages in the current conversation to the new target language
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.role === "model") {
        if (messageTranslations[i]?.lang === targetLang) {
          continue;
        }

        setTranslatingIndex(i);
        try {
          const translated = await translateText(msg.content, targetLang);
          setMessageTranslations(prev => ({
            ...prev,
            [i]: { text: translated, lang: targetLang }
          }));
        } catch (err) {
          console.error("Global translation error:", err);
        } finally {
          setTranslatingIndex(null);
        }
      }
    }
  };

  // Reset translations on session switches
  useEffect(() => {
    setMessageTranslations({});
  }, [currentSessionId]);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [persona, setPersona] = useState<"krishna" | "scholar">("krishna");

  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);

  // Stop any playing speech when session switches or component unmounts
  useEffect(() => {
    window.speechSynthesis?.cancel();
    setSpeakingIndex(null);
  }, [currentSessionId]);

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  const speakMessage = (index: number, text: string, langName: string, isRetry = false) => {
    if (!window.speechSynthesis) {
      setError("Speech synthesis is not supported in this browser.");
      setTimeout(() => setError(null), 3000);
      return;
    }

    if (speakingIndex === index  && !isRetry) {
      window.speechSynthesis.cancel();
      setSpeakingIndex(null);
      return;
    }

    window.speechSynthesis.cancel();

    // Clean markdown characters for smoother, clean spoken audio
    const cleanText = text
      .replace(/[*#`_\-]/g, "") // remove basic markdown formatting characters
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // clean links
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);

    if (!isRetry) {
    // Meditative, spiritual voice properties for Lord Krishna / spiritual guide persona
    // Slightly lower pitch and slower speed to sound steady, calm, wise and spiritual
    utterance.pitch = 0.88; // Deeper, warmer, more resonant tone
    utterance.rate = 0.82;  // Meditative, calm and steady pace
    } else {
      // Safe standard values for browser/system fallback when custom parameters trigger synthesis-failed
      utterance.pitch = 1.0;
      utterance.rate = 1.0;
    }


    const langMap: Record<string, string> = {
      "English": "en-US",
      "Hindi": "hi-IN",
      "Spanish": "es-ES",
      "Sanskrit": "hi-IN", // Map Sanskrit to Hindi (hi-IN) as Hindi voices read Sanskrit Devanagari beautifully!
      "French": "fr-FR",
      "German": "de-DE",
      "Telugu": "te-IN",
      "Tamil": "ta-IN",
      "Bengali": "bn-IN",
      "Marathi": "mr-IN",
      "Gujarati": "gu-IN",
      "Kannada": "kn-IN",
      "Malayalam": "ml-IN"
    };

    const bcpLang = langMap[langName] || "en-US";
    utterance.lang = bcpLang;

    if (!isRetry) {

    // Get all available system voices
    const voices = window.speechSynthesis.getVoices();
    let spiritualVoice = null;

    if (langName === "Sanskrit") {
      // Prioritize Hindi or Indian English voices for reading Sanskrit
      spiritualVoice = voices.find(v => v.lang.startsWith("hi-IN")) || 
                       voices.find(v => v.lang.startsWith("en-IN")) ||
                       voices.find(v => v.name.toLowerCase().includes("india") || v.name.toLowerCase().includes("rishi") || v.name.toLowerCase().includes("veena"));
    } else if (langName === "Hindi") {
      // Hindi spiritual voice matching
      spiritualVoice = voices.find(v => v.lang.startsWith("hi-IN")) ||
                       voices.find(v => v.lang.startsWith("en-IN"));
    } else if (bcpLang.startsWith("en")) {
      // For English spiritual reads, prioritize Indian-accented English if available for authenticity
      spiritualVoice = voices.find(v => v.lang.startsWith("en-IN")) ||
                       voices.find(v => v.name.toLowerCase().includes("india") || v.name.toLowerCase().includes("rishi") || v.name.toLowerCase().includes("veena") || v.name.toLowerCase().includes("priya"));
    }

    // Default fallback to any matching voice for the target language
    if (!spiritualVoice) {
      spiritualVoice = voices.find(v => v.lang.startsWith(bcpLang));
    }

    // Secondary fallback to any Indian-accented voice if Sanskrit/Hindi needs a reader
    if (!spiritualVoice && (langName === "Sanskrit" || langName === "Hindi")) {
      spiritualVoice = voices.find(v => v.lang.startsWith("hi") || v.lang.startsWith("en-IN"));
    }

    if (spiritualVoice) {
      utterance.voice = spiritualVoice;
      utterance.lang = spiritualVoice.lang; // Override lang to match the chosen voice's actual language
    }
  }

    utterance.onend = () => {
      setSpeakingIndex(null);
    };

    utterance.onerror = (err) => {
      // "interrupted" is a standard event triggered when we manually cancel or stop speech.
      // We should ignore it and not report it as an actual failure.
      if (err.error === "interrupted") {
        setSpeakingIndex(null);
        return;
      }
      
      console.warn("Speech synthesis notice/error:", err.error || err);

      // If we haven't retried yet and got "synthesis-failed" (or any other failure),
      // attempt safe default system fallback
      if (!isRetry) {
        console.log("Speech synthesis failed with custom settings. Retrying with default system voice and standard pitch/rate...");
        window.speechSynthesis.cancel();
        setTimeout(() => {
          speakMessage(index, text, langName, true);
        }, 100);
        return;
      }
      setSpeakingIndex(null);
      
      // If voice is completely unavailable, provide a gentle friendly banner
      if (err.error === "language-unavailable") {
        setError(`The voice for ${langName} is not currently installed or available on this system/browser.`);
        setTimeout(() => setError(null), 4000);
      }
    };

    setSpeakingIndex(index);
    window.speechSynthesis.speak(utterance);
  };
  
  
  const scrollRef = useRef<HTMLDivElement>(null);

  const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB limit
  const GEMINI_INLINE_LIMIT = 50 * 1024 * 1024; // 50MB Gemini API limit for inline data

  // Handle auto-collapsing sidebar on smaller screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    handleResize(); // initialized
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const setDefaultGitaReference = () => {
    const defaultFile = { 
      name: "Bhagavad Gita (Divine Wisdom Guide)", 
      base64: "", 
      extractedText: "The Bhagavad Gita is a 700-verse Hindu scripture that is part of the epic Mahabharata. It features a dialog between Pandava prince Arjuna and his guide and charioteer Lord Krishna, imparting teachings on selfless duty (Karma Yoga), devotion (Bhakti Yoga), knowledge (Jnana Yoga), and attaining absolute inner peace.",
      pdfUrl: "",
      pdfSize: 0
    };
    setFile(defaultFile);
    setVectorStore([]);

    const cachedSessions = loadSessionsFromLocalStorage();
    if (cachedSessions && cachedSessions.length > 0) {
      setSessions(cachedSessions);
      setCurrentSessionId(cachedSessions[0].id);
      setMessages(cachedSessions[0].messages);
    } else {
      const defaultSess: ChatSession = {
        id: 'initial',
        title: 'First Consult',
        messages: [{ 
          role: "model", 
          content: "Peace be with you. The Gita wisdom system is active and ready to guide you. How can I help you navigate the battles of your life today?" 
        }],
        updatedAt: new Date().toISOString()
      };
      setSessions([defaultSess]);
      setCurrentSessionId('initial');
      setMessages(defaultSess.messages);
      saveSessionsToLocalStorage([defaultSess]);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const isAdm = await checkAdmin(u.uid);
        setIsAdminUser(isAdm);
      } else {
        setIsAdminUser(false);
      }
    });

    // Initial data load
    const initData = async () => {
      setIsLoading(true);
      setStatus("Awakening Gita wisdom...");
      try {
        const data = await loadGitaData();
        let loadedFile = null;
        if (data) {
          setVectorStore(data.chunks);
          loadedFile = { 
            name: data.metadata.name, 
            base64: "", 
            extractedText: "",
            pdfUrl: data.metadata.pdfUrl || "",
            pdfSize: data.metadata.pdfSize || 0
          };
          setFile(loadedFile);
        } else {
          loadedFile = { 
            name: "Bhagavad Gita (Divine Wisdom Guide)", 
            base64: "", 
            extractedText: "The Bhagavad Gita is a 700-verse Hindu scripture that is part of the epic Mahabharata. It features a dialog between Pandava prince Arjuna and his guide and charioteer Lord Krishna, imparting teachings on selfless duty (Karma Yoga), devotion (Bhakti Yoga), knowledge (Jnana Yoga), and attaining absolute inner peace.",
            pdfUrl: "",
            pdfSize: 0
          };
          setFile(loadedFile);
          setVectorStore([]);
        }

        const cachedSessions = loadSessionsFromLocalStorage();
        if (cachedSessions && cachedSessions.length > 0) {
          setSessions(cachedSessions);
          setCurrentSessionId(cachedSessions[0].id);
          setMessages(cachedSessions[0].messages);
        } else {
          const greetingText = loadedFile 
            ? `Peace be with you. The Gita wisdom is active. How can I guide you today?`
            : "Peace be with you. The Gita wisdom system is active and ready to guide you. How can I help you navigate the battles of your life today?";
          
          const defaultSess: ChatSession = {
            id: 'initial',
            title: 'First Consult',
            messages: [{ role: "model", content: greetingText }],
            updatedAt: new Date().toISOString()
          };
          setSessions([defaultSess]);
          setCurrentSessionId('initial');
          setMessages(defaultSess.messages);
          saveSessionsToLocalStorage([defaultSess]);
        }
      } catch (e) {
        console.error("Failed to load initial data", e);
        setDefaultGitaReference();
      } finally {
        setIsLoading(false);
        setStatus(null);
      }
    };

    initData();
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const onDrop = React.useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file && file.type === "application/pdf") {
      if (file.size > MAX_FILE_SIZE) {
        setError(`File is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum allowed is 100MB.`);
        setTimeout(() => setError(null), 5000);
        return;
      }
      
      const isLargeFile = file.size > GEMINI_INLINE_LIMIT;
      setError(null);
      setIsLoading(true);
      setStatus("Processing document...");
      
      (async () => {
        try {
          // 1. Get the ArrayBuffer of the uploaded file instantly, avoiding base64 overhead
          const arrayBuffer = await file.arrayBuffer();
          
          // 2. Extract text directly using the fast ArrayBuffer representation
          // Limit extracted text to 100k characters since we only chunk 50 chunks (approx 40k chars)
          const extractedText = await extractTextFromPdf(arrayBuffer, 100000);
          setStatus("Generating spiritual embeddings...");
          
          // Limit actual chunk allocations to 50 directly in chunkText
          // This prevents heavy CPU iterations on massive texts from 65MB PDFs
          const limitedChunks = chunkText(extractedText, 1000, 200, 50); 
          const embeddings = await getEmbeddings(limitedChunks);
          
          const store: Chunk[] = limitedChunks.map((text, i) => ({
            text,
            embedding: embeddings[i]
          }));
          
          // 3. Extract base64 ONLY if the file is not large (since Gemini doesn't take >50MB inline anyway)
          let base64 = "";
          if (!isLargeFile) {
            setStatus("Preparing document payload...");
            base64 = await new Promise<string>((resolve, reject) => {
              const r = new FileReader();
              r.onload = () => {
                const b64 = (r.result as string).split(",")[1];
                resolve(b64);
              };
              r.onerror = reject;
              r.readAsDataURL(file);
            });
          }

          setVectorStore(store);
          setFile({ 
            name: file.name, 
            base64, 
            extractedText,
            pdfUrl: "",
            pdfSize: file.size
          });

          if (isAdminUser) {
            // Trigger saving to Cloud Firestore and Firebase Storage in the background
            // This prevents network upload time (over 1 min for a 65MB PDF) from blocking the index flow!
            // The active user can consult the scriptures immediately.
            console.log("Starting cloud database serialization in the background...");
            saveGitaData(file.name, store, file, file.size)
              .then((savedData) => {
                if (savedData && savedData.pdfUrl) {
                  setFile((prev) => 
                    prev && prev.name === file.name 
                      ? { ...prev, pdfUrl: savedData.pdfUrl } 
                      : prev
                  );
                }
                console.log("Gita cloud serialization synchronized successfully in background.");
              })
              .catch((err) => {
                console.error("Delayed cloud synchronization failed, but local index is fully active:", err);
              });
          }
          
          const welcomeMsg = `Peace be with you. I have indexed **${file.name}** into my Gita wisdom store. How can I guide you today?`;
          const newMsg: Message = { 
            role: "model", 
            content: welcomeMsg 
          };
          setMessages([newMsg]);

          setSessions(prev => {
            const next = prev.map(s => {
              if (s.id === currentSessionId) {
                return {
                  ...s,
                  title: `Consult: ${file.name.slice(0, 15)}...`,
                  messages: [newMsg],
                  updatedAt: new Date().toISOString()
                };
              }
              return s;
            });
            saveSessionsToLocalStorage(next);
            return next;
          });
        } catch (e) {
          console.error("RAG pre-processing failed:", e);
          setError("Failed to index the document. Using basic analysis instead.");
          setFile({ name: file.name, base64: "" });
          
          const fallbackMsg: Message = { role: "model", content: `I've received **${file.name}**. I'll try my best to help!` };
          setMessages([fallbackMsg]);

          setSessions(prev => {
            const next = prev.map(s => {
              if (s.id === currentSessionId) {
                return {
                  ...s,
                  title: `Consult: ${file.name.slice(0, 15)}...`,
                  messages: [fallbackMsg],
                  updatedAt: new Date().toISOString()
                };
              }
              return s;
            });
            saveSessionsToLocalStorage(next);
            return next;
          });
        } finally {
          setIsLoading(false);
          setStatus(null);
        }
      })();
    }
  }, [isAdminUser, currentSessionId]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    multiple: false,
  });

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !file || isLoading) return;

    const userMessage = inputText.trim();
    setInputText("");
    
    const updatedMessages: Message[] = [...messages, { role: "user", content: userMessage }];
    setMessages(updatedMessages);

    // Update sessions state immediately with user message and compute dynamic title
    setSessions(prev => {
      const next = prev.map(s => {
        if (s.id === currentSessionId) {
          const isNewChat = s.title === "New Guidance" || s.title === "First Consult";
          const newTitle = isNewChat 
            ? (userMessage.length > 25 ? userMessage.substring(0, 25).trim() + "..." : userMessage)
            : s.title;
          return {
            ...s,
            title: newTitle,
            messages: updatedMessages,
            updatedAt: new Date().toISOString()
          };
        }
        return s;
      });
      saveSessionsToLocalStorage(next);
      return next;
    });

    setIsLoading(true);
    setStatus("Lord Krishna is contemplating your question...");

    try {
      let response = "";
      
      // Get embedding for user message for RAG search
      const [userMessageEmbedding] = await getEmbeddings([userMessage]);
      
      // Search for relevant past conversations (RAG)
      const relevantPastMessages = searchRagStorage(userMessageEmbedding, {
        topK: 3,
        similarityThreshold: 0.65,
        excludeSessionId: currentSessionId,
      });

      // Extract context from relevant past messages
      const pastContextStrings = relevantPastMessages
        .filter(msg => msg.role === "model") // Focus on model responses which have guidance
        .map(msg => msg.content);

      if (vectorStore.length > 0) {
        // RAG Flow with both PDF and past conversation context
        const similarities = vectorStore.map(chunk => ({
          text: chunk.text,
          score: cosineSimilarity(userMessageEmbedding, chunk.embedding)
        }));
        
        const topChunks = similarities
          .sort((a, b) => b.score - a.score)
          .slice(0, 3)
          .map(c => c.text);
        
        // Combine PDF context with past conversation context
        const combinedContext = [...topChunks, ...pastContextStrings];
        
        setStatus("Lord Krishna is preparing response...");
        response = await chatWithContext(messages, userMessage, combinedContext, persona, language);
      } else {
        // Fallback to basic chat
        const isLargeFile = file.base64.length * 0.75 > GEMINI_INLINE_LIMIT;
        const pdfDataToSend = isLargeFile ? null : file.base64;
        response = await chatWithPdf(pdfDataToSend, messages, userMessage, file.extractedText, persona,language);
      }
      
      // Get embedding for model response
      const [responseEmbedding] = await getEmbeddings([response]);
      
      const finalMessages: Message[] = [...updatedMessages, { role: "model", content: response }];
      setMessages(finalMessages);

      // Save both messages to RAG storage for future retrieval
      saveMessageToRag(currentSessionId, "user", userMessage, userMessageEmbedding);
      saveMessageToRag(currentSessionId, "model", response, responseEmbedding);

      setSessions(prev => {
        const next = prev.map(s => {
          if (s.id === currentSessionId) {
            return {
              ...s,
              messages: finalMessages,
              updatedAt: new Date().toISOString()
            };
          }
          return s;
        });
        saveSessionsToLocalStorage(next);
        return next;
      });
    } catch (error) {
      console.error("Chat process failed:", error);
      const errorMsg: Message = { role: "model", content: "Apologies, I encountered a disturbance in the wisdom field. Please try again." };
      const failedMessages = [...updatedMessages, errorMsg];
      setMessages(failedMessages);

      // Save error message to RAG storage
      try {
        const [errorEmbedding] = await getEmbeddings([errorMsg.content]);
        saveMessageToRag(currentSessionId, "model", errorMsg.content, errorEmbedding);
      } catch (e) {
        console.warn("Failed to save error message to RAG storage:", e);
      }

      setSessions(prev => {
        const next = prev.map(s => {
          if (s.id === currentSessionId) {
            return {
              ...s,
              messages: failedMessages,
              updatedAt: new Date().toISOString()
            };
          }
          return s;
        });
        saveSessionsToLocalStorage(next);
        return next;
      });
    } finally {
      setIsLoading(false);
      setStatus(null);
    }
  };

  const handleNewChat = () => {
    const greeting = file 
      ? `Peace be with you. The Bhagavad Gita is active. How can I guide you today?`
      : "Peace be with you. The Bhagavad Gita scripture is active and ready to guide you. How can I help you navigate the battles of your life today?";
    
    const newSession: ChatSession = {
      id: Math.random().toString(36).substring(2, 9),
      title: "New Guidance",
      messages: [{ role: "model", content: greeting }],
      updatedAt: new Date().toISOString()
    };
    
    const updatedSessions = [newSession, ...sessions];
    setSessions(updatedSessions);
    setCurrentSessionId(newSession.id);
    setMessages(newSession.messages);
    saveSessionsToLocalStorage(updatedSessions);
  };

  const handleSelectSession = (id: string) => {
    // Save current active messages back to sessions before switching
    const updatedSessions = sessions.map(s => {
      if (s.id === currentSessionId) {
        return { ...s, messages, updatedAt: new Date().toISOString() };
      }
      return s;
    });
    setSessions(updatedSessions);
    saveSessionsToLocalStorage(updatedSessions);

    const selected = sessions.find(s => s.id === id);
    if (selected) {
      setCurrentSessionId(id);
      setMessages(selected.messages);
    }
  };

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const updatedSessions = sessions.filter(s => s.id !== id);
    setSessions(updatedSessions);
    saveSessionsToLocalStorage(updatedSessions);

    if (currentSessionId === id) {
      if (updatedSessions.length > 0) {
        setCurrentSessionId(updatedSessions[0].id);
        setMessages(updatedSessions[0].messages);
      } else {
        const greeting = file 
          ? `Peace be with you. The Gita wisdom store (**${file.name}**) is active. How can I guide you today?`
          : "Peace be with you. The Gita wisdom system is active and ready to guide you. How can I help you navigate the battles of your life today?";
        const newSession: ChatSession = {
          id: Math.random().toString(36).substring(2, 9),
          title: "New Guidance",
          messages: [{ role: "model", content: greeting }],
          updatedAt: new Date().toISOString()
        };
        setSessions([newSession]);
        setCurrentSessionId(newSession.id);
        setMessages(newSession.messages);
        saveSessionsToLocalStorage([newSession]);
      }
    }
  };

  const clearSession = () => {
    setFile(null);
    setInputText("");
  };

const KrishnaIcon = ({ circular = false }: { circular?: boolean }) => (
    <div className={cn(
      "overflow-hidden flex items-center justify-center bg-indigo-50",
      circular ? "w-full h-full rounded-full" : "w-full h-full rounded-lg"
    )}>
      <img 
        src="krishna.jpg" 
        alt="Krishna"
        className="w-full h-full object-cover scale-[1.8] object-top translate-y-1"
        referrerPolicy="no-referrer"
      />
    </div>
  );

  return (
    <div className="relative bg-[#F9FAFB] flex h-screen text-slate-900 font-sans overflow-hidden">

      {/* Full-screen fixed backdrop */}
      <div className="backdrop-fixed" aria-hidden="true" />
    
      {/* Error Notification */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 20, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-0 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 text-sm font-medium"
          >
            <X className="w-4 h-4 cursor-pointer" onClick={() => setError(null)} />
            {error}
          </motion.div>
        )}
      </AnimatePresence>
      

      {/* Sidebar Overlay for Mobile */}
      <AnimatePresence>
        {file && isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/40 z-30 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      {file && (
        <motion.aside
          initial={false}
          animate={{ 
            width: isSidebarOpen ? 288 : 0,
            opacity: isSidebarOpen ? 1 : 0
          }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className={cn(
            "h-full bg-white border-r border-slate-200 flex flex-col shrink-0 overflow-hidden z-40",
            isSidebarOpen && "shadow-xl md:shadow-none w-72",
            "fixed md:static inset-y-0 left-0"
          )}
        >
          {/* Sidebar Header */}
          <div className="h-16 border-b border-slate-200 px-4 flex items-center justify-between shrink-0 bg-slate-50/50">
            <div className="flex items-center gap-2 font-bold text-slate-800 text-xs tracking-wider uppercase font-sans">
              <MessageSquare className="w-4 h-4 text-indigo-500" />
              <span>Consultations</span>
            </div>
            <button
              onClick={handleNewChat}
              className="p-1.5 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 hover:border-indigo-100 rounded-xl transition-all cursor-pointer text-slate-500 bg-white"
              title="Start a new consulting session with Gita wisdom"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Sidebar Sessions List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1 bg-slate-50/10">
            {sessions.length === 0 ? (
              <div className="py-8 px-4 text-center">
                <span className="text-xs text-slate-400">No session history yet. Ask a question to begin!</span>
              </div>
            ) : (
              sessions.map((sess) => {
                const isActive = sess.id === currentSessionId;
                return (
                  <div
                    key={sess.id}
                    onClick={() => handleSelectSession(sess.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        handleSelectSession(sess.id);
                      }
                    }}
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded-xl text-left text-xs transition-all group font-medium cursor-pointer relative",
                      isActive
                        ? "bg-indigo-50/80 text-indigo-950 border border-indigo-100 shadow-sm"
                        : "text-slate-600 hover:bg-slate-100/70 border border-transparent"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-4">
                      <MessageSquare className={cn(
                        "w-4 h-4 shrink-0",
                        isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-indigo-500 transition-colors"
                      )} />
                      <span className="truncate text-slate-700 font-sans">{sess.title}</span>
                    </div>
                    <button
                      onClick={(e) => handleDeleteSession(sess.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-200 hover:text-red-650 rounded-md transition-all text-slate-400 cursor-pointer"
                      title="Delete session"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex flex-col gap-2 shrink-0">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-sans">
              <span>Conversations</span>
              <span>{sessions.length} sessions</span>
            </div>
            {sessions.length > 1 && (
              <button
                onClick={() => {
                  if (confirm("Are you sure you want to clear your consultation history?")) {
                    const greeting = file 
                      ? `Peace be with you. The Gita wisdom store (**${file.name}**) is active. How can I guide you today?`
                      : "Peace be with you. The Gita wisdom system is active and ready to guide you. How can I help you navigate the battles of your life today?";
                    const newSession: ChatSession = {
                      id: Math.random().toString(36).substring(2, 9),
                      title: "New Guidance",
                      messages: [{ role: "model", content: greeting }],
                      updatedAt: new Date().toISOString()
                    };
                    setSessions([newSession]);
                    setCurrentSessionId(newSession.id);
                    setMessages(newSession.messages);
                    saveSessionsToLocalStorage([newSession]);
                  }
                }}
                className="w-full text-center py-2 border border-dashed border-red-200 hover:border-red-500 hover:bg-red-50 text-red-500 rounded-xl transition-all font-medium text-[11px] cursor-pointer active:scale-95"
              >
                Clear All History
              </button>
            )}
          </div>
        </motion.aside>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 relative">
       <header id="main-nav" className="h-16 bg-white border-b border-slate-200 px-3 sm:px-6 flex items-center justify-between z-20 sticky top-0">
          <div className="flex items-center gap-2 font-bold text-lg sm:text-xl text-indigo-600 shrink-0">
            {file && (
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer mr-1"
                title="Toggle sidebar"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden border border-indigo-100 p-0.5 shrink-0">
              <KrishnaIcon circular />
            </div>
            <span>Bhagavad Gita </span>
          </div>
          
          <div className="flex items-center gap-1 sm:gap-2.5 min-w-0">
            {/* Guidance Mode Selection Dropdown */}
            <div className="flex items-center bg-slate-100/80 hover:bg-slate-100 px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl border border-slate-200 transition-all shadow-inner gap-0.5 sm:gap-1.5 shrink-0" id="persona-selector">
              {persona === "krishna" ? (
                <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-600/70 shrink-0" />
              ) : (
                <Bot className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500 shrink-0" />
              )}
              <select
                value={persona}
                onChange={(e) => setPersona(e.target.value as "krishna" | "scholar")}
                className="bg-transparent border-none text-[11px] sm:text-xs font-bold text-slate-600 focus:outline-none focus:ring-0 cursor-pointer pr-1 py-0"
                title="Select Guidance Mode"
              >
                <option value="krishna">Krishna</option>
                <option value="scholar">Scholar</option>
              </select>
            </div>

            {/* Guidance Language Selection */}
            <div className="flex items-center bg-slate-100/80 hover:bg-slate-100 px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl border border-slate-200 transition-all shadow-inner gap-0.5 sm:gap-1.5 shrink-0" id="language-selector">
              <Globe className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-600/70 shrink-0" />
              <select
                value={language}
                onChange={(e) => handleGlobalLanguageChange(e.target.value)}
                className="bg-transparent border-none text-[11px] sm:text-xs font-bold text-slate-600 focus:outline-none focus:ring-0 cursor-pointer pr-1 py-0"
                title="Select language for responses"
              >
                        <option value="English">English</option>
                        <option value="Hindi">हिन्दी (Hindi)</option>
                        <option value="Spanish">Español (Spanish)</option>
                        <option value="Sanskrit">संस्कृतम् (Sanskrit)</option>
                        <option value="French">Français (French)</option>
                        <option value="German">Deutsch (German)</option>
                        <option value="Telugu">తెలుగు (Telugu)</option>
                        <option value="Tamil">தமிழ் (Tamil)</option>
                        <option value="Bengali">বাংলা (Bengali)</option>
                        <option value="Marathi">मराठी (Marathi)</option>
                        <option value="Gujarati">ગુજરાતી (Gujarati)</option>
                        <option value="Kannada">ಕನ್ನಡ (Kannada)</option>
                        <option value="Malayalam">മലയാളం (Malayalam)</option>
              </select>
            </div>
            
            {file && isAdminUser && (
              <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg max-w-xs">
                <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                <span className="text-xs font-medium text-slate-600 truncate">{file.name}</span>
              </div>
            )}
            
            {user ? (
              <button 
                onClick={logout}
                className="text-xs font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors flex items-center gap-2 cursor-pointer" title="Logout"
              >
                 {isAdminUser && <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />}
                <span className="hidden sm:inline">Logout</span>
                <LogOut className="w-4 h-4 sm:hidden text-slate-400" />
              </button>
            ) : (
              <div className="flex items-center gap-1.5 shrink-0">
                <button 
                  onClick={loginWithGoogle}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-widest transition-colors cursor-pointer"
                >
                  <span className="hidden sm:inline">Admin Login</span>
                  <span className="sm:hidden">Admin</span>
                </button>
                {(import.meta as any).env?.DEV && (
                  <button
                    onClick={() => {
                      setIsAdminUser(true);
                      // Set an elegant simulated admin status
                      setError("Dev Admin Mode activated locally!");
                      setTimeout(() => setError(null), 3000);
                    }}
                    className="text-[10px] text-amber-600 hover:text-amber-700 font-bold border border-amber-200 bg-amber-50 px-2 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer active:scale-95 animate-pulse"
                  >
                    <Sparkles className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                    <span className="hidden sm:inline">Dev Admin</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </header>

        {isLoading && !file ? (
          <div className="flex-1 flex items-center justify-center p-6 text-center">
            <div className="max-w-md bg-white p-12 rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center">
              <div className="w-20 h-20 bg-indigo-50/50 rounded-full flex items-center justify-center mb-6">
                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">Awakening Gita Wisdom</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                Seeking connection to the wisdom store...
              </p>
            </div>
          </div>
        ) : !file ? (
          <div className="flex-1 flex items-center justify-center p-6 text-center">
            {isAdminUser ? (
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="max-w-xl w-full"
              >
                <div 
                  {...getRootProps()} 
                  className={cn(
                    "relative group cursor-pointer p-12 border-2 border-dashed rounded-3xl transition-all duration-300 flex flex-col items-center gap-6",
                    isDragActive 
                      ? "border-indigo-500 bg-indigo-50/50 scale-[1.02]" 
                      : "border-slate-200 bg-white hover:border-indigo-400 hover:bg-slate-50/20"
                  )}
                >
                  <input {...getInputProps()} />
                  <div className="w-40 h-32 bg-indigo-50 rounded-2xl flex items-center justify-center overflow-hidden border-4 border-white shadow-xl group-hover:scale-110 transition-transform duration-300">
                    <img 
                      src="images/krishna.jpg"
                      alt="Upload Gita"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="text-center">
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Upload Gita Document</h2>
                    <p className="text-slate-500 max-w-xs mx-auto text-sm">
                      As an admin, you can upload and index the Gita PDF for all users.
                    </p>
                  </div>
                  <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-[calc(1.5rem-2px)]" />
                </div>
              </motion.div>
            ) : (
              <div className="max-w-md bg-white p-12 rounded-3xl border border-slate-100 shadow-sm">
                <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Sparkles className="w-10 h-10 text-indigo-600 animate-pulse" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-3">Service Initializing</h2>
                <p className="text-slate-500 text-sm leading-relaxed">
                  The admin has not yet uploaded the Gita document. Please check back soon for spiritual guidance.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col h-full bg-transparent">
            {/* Header */}
            <header id="chat-header" className="h-12 bg-white border-b border-slate-100 px-6 flex items-center justify-between z-10 shrink-0">
              <div className="flex items-center gap-2 md:gap-4 truncate">
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Wisdom Mode</span>
                </div>
                {file.pdfUrl && (
                  <a 
                    href={file.pdfUrl}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 font-medium rounded-full border border-indigo-100 bg-indigo-50/30 transition-all cursor-pointer truncate"
                  >
                    <FileText className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span>View original PDF</span>
                    {file.pdfSize ? (
                      <span className="text-[10px] text-indigo-400 font-mono">({(file.pdfSize / 1024 / 1024).toFixed(1)}MB)</span>
                    ) : null}
                  </a>
                )}
              </div>
              {isAdminUser && (
                <button 
                  id="close-file-btn"
                  onClick={clearSession}
                  className="flex items-center gap-2 px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-indigo-600 hover:bg-slate-50 transition-colors uppercase tracking-wider cursor-pointer font-sans shrink-0 rounded-md"
                  title="Click to go back to upload screen and upload a new version"
                >
                  <Upload className="w-3.5 h-3.5 text-slate-400" />
                  Upload new version
                </button>
              )}
            </header>

            {/* Chat Area */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 pb-6 md:pb-12"
            >
              <div className="max-w-3xl mx-auto space-y-6 mb-6 md:mb-12">
                {messages.map((message, index) => (
                  <motion.div
                    key={index}
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className={cn(
                      "flex gap-4 w-full",
                      message.role === "user" ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-1 shadow-sm overflow-hidden",
                      message.role === "user" ? "bg-indigo-600" : "bg-white border border-slate-200"
                    )}>
                      {message.role === "user" ? (
                        <User className="w-4 h-4 text-white" />
                      ) : (
                        <KrishnaIcon circular />
                      )}
                    </div>
                    <div className={cn(
                      "max-w-[85%] rounded-2xl p-4 shadow-sm",
                      message.role === "user" 
                        ? "bg-slate-800 text-white rounded-tr-none" 
                        : "bg-white border border-slate-200 rounded-tl-none"
                    )}>
                      <div className={cn(
                        "markdown-body text-sm leading-relaxed",
                        message.role === "user" ? "text-slate-100" : "text-slate-700"
                      )}>
                         <Markdown remarkPlugins={[remarkGfm]}>
                          {messageTranslations[index]?.text || message.content}
                        </Markdown>
                      </div>
                       {message.role === "model" && (
                        <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between gap-4">
                          <span className="text-[10px] text-slate-400 font-medium font-sans">
                            {messageTranslations[index] 
                              ? `Translated to ${messageTranslations[index].lang}` 
                              : "Original response"}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {translatingIndex === index ? (
                              <div className="flex items-center gap-1 text-[10px] text-indigo-500 font-medium">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>Translating...</span>
                              </div>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => speakMessage(
                                    index, 
                                    messageTranslations[index]?.text || message.content, 
                                    messageTranslations[index]?.lang || language
                                  )}
                                  className={cn(
                                    "p-1.5 rounded-lg border transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer",
                                    speakingIndex === index 
                                      ? "bg-red-50 hover:bg-red-100 text-red-600 border-red-200" 
                                      : "bg-slate-50 hover:bg-slate-100 text-slate-500 border-slate-200"
                                  )}
                                  title={speakingIndex === index ? "Stop speaking" : "Speak response aloud"}
                                >
                                  {speakingIndex === index ? (
                                    <>
                                      <VolumeX className="w-3.5 h-3.5 text-red-500" />
                                      <span className="text-[10px] font-bold">Stop</span>
                                    </>
                                  ) : (
                                    <>
                                      <Volume2 className="w-3.5 h-3.5" />
                                      <span className="text-[10px] font-bold">Listen</span>
                                    </>
                                  )}
                                </button>
                              <select
                                onChange={(e) => handleTranslateMessage(index, message.content, e.target.value)}
                                value={messageTranslations[index]?.lang || "Original"}
                                className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-[10px] text-slate-500 font-bold py-1 px-2 cursor-pointer transition-all focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
                              >
                                <option value="Original">Translate response...</option>
                                <option value="English">English</option>
                                <option value="Hindi">हिन्दी (Hindi)</option>
                                <option value="Spanish">Español (Spanish)</option>
                                <option value="Sanskrit">संस्कृतम् (Sanskrit)</option>
                                <option value="French">Français (French)</option>
                                <option value="German">Deutsch (German)</option>
                                <option value="Telugu">తెలుగు (Telugu)</option>
                                <option value="Tamil">தமிழ் (Tamil)</option>
                                <option value="Bengali">বাংলা (Bengali)</option>
                                <option value="Marathi">मराठी (Marathi)</option>
                                <option value="Gujarati">ગુજરાતી (Gujarati)</option>
                                <option value="Kannada">ಕನ್ನಡ (Kannada)</option>
                                <option value="Malayalam">മലയാളం (Malayalam)</option>
                              </select>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
                
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex gap-4"
                  >
                    <div className="w-8 h-8 rounded-lg outline outline-1 outline-slate-200 bg-white flex items-center justify-center shrink-0 shadow-sm overflow-hidden animate-pulse">
                      <KrishnaIcon circular />
                    </div>
                    <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none p-4 shadow-sm flex items-center gap-3">
                      <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                      <span className="text-sm text-slate-400 font-medium">{status || "Analysing document..."}</span>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Input Container - iOS Safari Optimized */}
            <div id="input-area" className="px-3 md:px-6 pt-3 md:pt-4 pb-6 md:pb-8 bg-white border-t border-slate-200 safe-area-inset-bottom" style={{ paddingBottom: "calc(max(1.5rem, env(safe-area-inset-bottom)) + 1rem)" }}>
              <form 
                id="chat-form"
                onSubmit={handleSendMessage}
                className="max-w-3xl mx-auto flex items-center gap-2 p-2 pl-4 bg-slate-50 border border-slate-200 rounded-2xl focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-300 transition-all shadow-sm"
              >
                <input
                  id="chat-input-field"
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Ask for spiritual guidance from the document..."
                  className="flex-1 bg-transparent border-none py-2.5 md:py-3 px-1 text-sm focus:ring-0 focus:outline-none placeholder:text-slate-400 min-h-[44px] md:min-h-auto"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck="false"
                />
                <button
                  type="button"
                  onClick={toggleListening}
                  className={cn(
                    "p-2.5 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center border",
                    isListening 
                      ? "bg-red-500 hover:bg-red-600 text-white border-red-600 animate-pulse" 
                      : "bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200"
                  )}
                  title={isListening ? "Listening... Click to stop" : "Start Voice Input"}
                >
                  {isListening ? (
                    <MicOff className="w-4 h-4" />
                  ) : (
                    <Mic className="w-4 h-4" />
                  )}
                </button>
                <button
                  id="send-message-btn"
                  type="submit"
                  disabled={isLoading || !inputText.trim()}
                  className="p-2 md:p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 shadow-md transition-all active:scale-95 shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
              <div id="input-suggestions" className="max-w-3xl mx-auto mt-2 md:mt-3 flex flex-wrap md:flex-nowrap items-center gap-2 md:gap-6 px-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest whitespace-nowrap">Wisdom Seeds</span>
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                  {["Summarize the main message", "Finding peace in chaos?", "What is Dharma?"].map((text) => (
                    <button
                      key={text}
                      onClick={() => setInputText(text)}
                      className="text-[10px] md:text-[11px] text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded-md transition-colors whitespace-nowrap flex-shrink-0"
                    >
                      {text}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
