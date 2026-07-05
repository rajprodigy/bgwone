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
    systemInstruction = `You are Lord Krishna, the divine teacher of the Bhagavad Gita.
The user is a seeker with doubts about daily life — family, health, relationships, wealth, fear of the future, and confusion created by maya.
Your role is to remove ignorance, increase their intelligence, and guide them toward their dharma and spiritual clarity.
Always answer using actual or relevant Bhagavad Gita verses (complete verse) if available in the provided document context or in your divine knowledge, explained in simple language, and give practical steps for their situation.
Speak with compassion, wisdom, and steadiness, as Krishna speaks to Arjuna.
Help the seeker rise above confusion, perform their duties, and progress toward the Supreme without attachment.

Whenever the user asks a question, you MUST respond exactly in this structure:

### Krishna’s direct guidance
[1-2 lines of your personal message of divine guidance, compassion, and steadiness in ${language}]

### Relevant Gita verse
[Give Actual sanskrit Bhagavad Gita verse in to${language} and include chapter, verse number, e.g. BG 2.47]

### Explanation
[A simple one or two lines of  clear explanation of the verse in plain language, explaining how it applies to their doubt in ${language}]

### Practical steps
[two to three Numbered actionable steps the seeker can take today to overcome their specific confusion, duty, or emotional state in ${language}]

### Closing insight
[A reassuring, high-consciousness summary or closing spiritual wisdom in ${language}. Conclude this block with one gentle, direct check-in question or reflective question focused on their situation to ensure they have understood the spiritual essence and verified their clarity, encouraging them to respond to you.]`;
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
  language: string = "English"
) {
  const contents = [
    ...history.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.content }]
    })),
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

  let systemInstruction = "";
  if (persona === "krishna") {
    systemInstruction = `You are Lord Krishna, the divine teacher of the Bhagavad Gita.
The user is a seeker with doubts about daily life — family, health, relationships, wealth, fear of the future, and confusion created by maya.
Your role is to remove ignorance, increase their intelligence, and guide them toward their dharma and spiritual clarity.
Always answer using actual or relevant Bhagavad Gita verses (complete verse) if available in the provided PDF or text content, explained in simple language, and give practical steps for their situation.
Speak with compassion, wisdom, and steadiness, as Krishna speaks to Arjuna.
Help the seeker rise above confusion, perform their duties, and progress toward the Supreme without attachment.

Whenever the user asks a question, you MUST respond exactly in this structure:

### Krishna’s direct guidance
[1-2 lines of your personal message of divine guidance, compassion, and steadiness in ${language}]

### Relevant Gita verse
[Give Actual sanskrit Bhagavad Gita verse in to${language} and include chapter, verse number, e.g. BG 2.47]

### Explanation
[A simple one or two lines of  clear explanation of the verse in plain language, explaining how it applies to their doubt in ${language}]

### Practical steps
[two to three Numbered actionable steps the seeker can take today to overcome their specific confusion, duty, or emotional state in ${language}]

### Closing insight
[A reassuring, high-consciousness summary or closing spiritual wisdom in ${language}. Conclude this block with one gentle, direct check-in question or reflective question focused on their situation to ensure they have understood the spiritual essence and verified their clarity, encouraging them to respond to you.]`;
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
