import { GoogleGenAI } from "@google/genai";

// Prefer Vite env var for frontend testing, fall back to process.env for Node environments.
const API_KEY = (import.meta as any)?.env?.VITE_GEMINI_API_KEY || (process.env as any)?.GEMINI_API_KEY;

const GEMINI_MODEL = (import.meta as any)?.env?.VITE_GEMINI_MODEL || (process.env as any)?.GEMINI_MODEL;

let ai: any = null;
if (API_KEY) {
  ai = new GoogleGenAI({ apiKey: API_KEY });
} else {
  // Don't construct the client without a key — provide a clearer warning for developers.
  console.warn(
    "GEMINI API key missing. Set VITE_GEMINI_API_KEY for frontend testing or move API calls to a secure backend."
  );
}

function systemInstructionForPersona(persona: "krishna" | "scholar", language: string): string {
  return `You are Lord Krishna from the Bhagavad Gita, guiding a seeker through daily life doubts (family, health, maya, duty) with wisdom, compassion, and steadiness.

FORMATTING RULES:

1. SHORT / SIMPLE INPUTS (Greetings, quick follow-ups, or brief questions):
- DO NOT use the structured template.
- Respond in 1–2 concise, compassionate paragraphs (~50–95 words) in "${language}".

2. DEEP / NEW INPUTS (Substantive queries or requests for detailed advice):
- Respond ENTIRELY in "${language}" using EXACTLY this format:

### Krishna’s direct guidance
[1 line of compassionate, steady divine guidance]

### Relevant Gita verse
[Sanskrit verse with reference in bold, e.g., **BG 2.47**]

### Explanation
[1 clear line applying the verse to their doubt]

### Practical steps
1. [Actionable step 1]
2. [Actionable step 2]

### Closing insight
[1 reassuring line of closing wisdom ending with 1 direct reflective question to check their understanding.]`;
}

export interface Message {
  role: "user" | "model";
  content: string;
}

export interface Chunk {
  text: string;
  embedding: number[];
}

export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  if (!texts || texts.length === 0) return [];
  if (!ai) {
    throw new Error(
      "Gemini client not configured: missing API key. Set VITE_GEMINI_API_KEY or call the API from a secure backend."
    );
  }
  try {
    const response = await ai.models.embedContent({
      model: "gemini-embedding-2-preview",
      contents: texts.map((text) => ({ parts: [{ text }] })),
    });
    if (!response.embeddings) {
      throw new Error("No embeddings returned from Gemini API");
    }
    return response.embeddings.map((e: any[]) => e.values ?? []);
  } catch (error) {
    console.warn("Batch API embedding failed, falling back to concurrent individual calls. Detail:", error);
    try {
      const results = await Promise.all(
        texts.map((text) =>
          ai.models.embedContent({
            model: "gemini-embedding-2-preview",
            contents: text,
          })
        )
      );
      return results.map((r) => r?.embeddings?.[0]?.values ?? []);
    } catch (fallbackError) {
      console.error("Failed both batch and fallback individual embeddings:", fallbackError);
      throw fallbackError;
    }
  }
}

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (magA * magB);
}

function formatHistoryForGemini(
  history: Message[],
  maxConversations: number = 3
): { role: "user" | "model"; parts: { text: string }[] }[] {
  if (!history || history.length === 0) return [];
  
  // Keep only the last maxConversations turn pairs (up to maxConversations * 2 messages, default 3 conversations = 6 messages)
  const maxMessages = maxConversations * 2;
  const prunedHistory = history.length > maxMessages ? history.slice(-maxMessages) : history;

  // Find the first user message index to skip any initial greeting or orphaned model response
  const firstUserIndex = prunedHistory.findIndex(msg => msg.role === "user");
  if (firstUserIndex === -1) {
    return [];
  }
  
  const relevantHistory = prunedHistory.slice(firstUserIndex);
  const formatted: { role: "user" | "model"; parts: { text: string }[] }[] = [];
  
  for (const msg of relevantHistory) {
    if (formatted.length === 0) {
      if (msg.role === "user") {
        formatted.push({
          role: "user",
          parts: [{ text: msg.content }]
        });
      }
    } else {
      const last = formatted[formatted.length - 1];
      if (last.role === msg.role) {
        last.parts[0].text += "\n\n" + msg.content;
      } else {
        formatted.push({
          role: msg.role,
          parts: [{ text: msg.content }]
        });
      }
    }
  }
  
  return formatted;
}

export async function chatWithContext(
  history: Message[],
  userPrompt: string,
  contextChunks: string[],
  persona: "krishna" | "scholar" = "krishna",
  language: string = "English"
) {
  const contextStr = contextChunks.join("\n\n---\n\n");
  
  const contents = [
    ...history.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.content }]
    })),
    {
      role: "user",
      parts: [
        { text: `Context from the Gita document:\n\n${contextStr}\n\nUser Question: ${userPrompt}` }
      ]
    }
  ];

  let systemInstruction = "";
  if (persona === "krishna") {
    systemInstruction = systemInstructionForPersona(persona, language);   
  } else {
    systemInstruction = "You are the 'Gita scholar' assistant. Answer questions objectively and comprehensively by referring to the provided Gita document context. Be spiritual, wisdom-focused, yet practical. If the answer isn't in the context, use your general knowledge of the Bhagavad Gita to answer faithfully.";
  }

  try {
    if (!ai) {
      throw new Error(
        "Gemini client not configured: missing API key. Set VITE_GEMINI_API_KEY or call the API from a secure backend."
      );
    }
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      // @ts-ignore
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        temperature: persona === "krishna" ? 0.45 : 0.2,
      }
    });

    return response.text || "I'm sorry, I couldn't process that.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
}

export async function chatWithPdf(
  pdfBase64: string | null,
  history: Message[],
  userPrompt: string,
  extractedText?: string,
  persona: "krishna" | "scholar" = "krishna",
  language: string = "English",
  isFollowUpParam?: boolean
) {
  const formattedHistory = formatHistoryForGemini(history);

  const contents = [
    ...formattedHistory,
    {
      role: "user",
      parts: [
        ...(pdfBase64 ? [{
          inlineData: {
            mimeType: "application/pdf",
            data: pdfBase64
          }
        }] : []),
        ...(extractedText ? [{ text: `Here is the text content extracted from the document:\n\n${extractedText}\n\n` }] : []),
        { text: userPrompt }
      ]
    }
  ];

  const isFollowUp = isFollowUpParam !== undefined ? isFollowUpParam : history.some(msg => msg.role === "user");

  let systemInstruction = "";
  if (persona === "krishna") {
    systemInstruction = systemInstruction = systemInstructionForPersona(persona, language);    
  } else {
    systemInstruction = "You are a helpful AI assistant that answers questions based on the provided PDF document. Be precise, concise, and professional. If the information is not in the PDF, state that clearly.";
  }

  try {
    if (!ai) {
      throw new Error(
        "Gemini client not configured: missing API key. Set VITE_GEMINI_API_KEY or call the API from a secure backend."
      );
    }
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      // @ts-ignore - The SDK might have slightly different types for history in contents
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        temperature: persona === "krishna" ? 0.45 : 0.1,
      }
    });

    return response.text || "I'm sorry, I couldn't process that.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
}

/**
 * Retrieve relevant context from past conversations using RAG
 * @param queryEmbedding - Embedding of the current user query
 * @param pastMessageContexts - Array of past message contents to search through
 * @param topK - Number of relevant messages to retrieve
 * @returns Array of relevant message contents
 */
export function retrieveRagContextFromPastMessages(
  queryEmbedding: number[],
  pastMessageContexts: Array<{ content: string; embedding: number[] }>,
  topK: number = 3,
  threshold: number = 0.65
): string[] {
  if (!queryEmbedding || queryEmbedding.length === 0 || pastMessageContexts.length === 0) {
    return [];
  }

  // Score all past messages by similarity to query
  const scored = pastMessageContexts
    .filter(msg => msg.embedding && msg.embedding.length > 0)
    .map(msg => ({
      content: msg.content,
      score: cosineSimilarity(queryEmbedding, msg.embedding),
    }))
    .filter(item => item.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored.map(item => item.content);
}
export async function translateText(text: string, targetLanguage: string): Promise<string> {
  if (!text || !targetLanguage || targetLanguage.toLowerCase() === "english") return text;
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `Translate the following text into the language "${targetLanguage}". Maintain all markdown structure, headings, bold text, numbered lists, blockquotes, and spacing exactly. Do not add any introductory or closing remarks, conversations, explanations, or labels - return ONLY the translated content:

${text}`,
      config: {
        temperature: 0.1,
      }
    });
    return response.text?.trim() || text;
  } catch (error) {
    console.warn("Translation failed, returning original text:", error);
    return text;
  }
}
