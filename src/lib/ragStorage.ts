/**
 * RAG Storage - Local storage based retrieval-augmented generation
 * Stores messages with embeddings and enables semantic search across all sessions
 */

export interface StoredMessage {
  id: string;
  sessionId: string;
  role: "user" | "model";
  content: string;
  embedding: number[];
  timestamp: number;
}

const RAG_STORAGE_KEY = "_gita_rag_messages_v1";
const MAX_STORED_MESSAGES = 500; // Limit to prevent localStorage bloat

/**
 * Save a message with its embedding to RAG storage
 */
export function saveMessageToRag(
  sessionId: string,
  role: "user" | "model",
  content: string,
  embedding: number[]
): void {
  try {
    const stored = getAllStoredMessages();
    
    const newMessage: StoredMessage = {
      id: `${sessionId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sessionId,
      role,
      content,
      embedding,
      timestamp: Date.now(),
    };

    stored.push(newMessage);

    // Keep only recent messages to avoid localStorage bloat
    if (stored.length > MAX_STORED_MESSAGES) {
      stored.sort((a, b) => b.timestamp - a.timestamp);
      stored.splice(MAX_STORED_MESSAGES);
    }

    localStorage.setItem(RAG_STORAGE_KEY, JSON.stringify(stored));
  } catch (e) {
    console.warn("RAG storage save failed:", e);
  }
}

/**
 * Get all stored messages with embeddings
 */
export function getAllStoredMessages(): StoredMessage[] {
  try {
    const data = localStorage.getItem(RAG_STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.warn("RAG storage read failed:", e);
  }
  return [];
}

/**
 * Get messages from a specific session
 */
export function getSessionMessagesFromRag(sessionId: string): StoredMessage[] {
  return getAllStoredMessages().filter(msg => msg.sessionId === sessionId);
}

/**
 * Search for semantically similar messages across all sessions using cosine similarity
 * Returns messages sorted by relevance, excluding messages from the current session
 */
export function searchRagStorage(
  queryEmbedding: number[],
  options: {
    topK?: number;
    similarityThreshold?: number;
    excludeSessionId?: string;
    excludeRole?: "user" | "model";
  } = {}
): StoredMessage[] {
  const {
    topK = 5,
    similarityThreshold = 0.6,
    excludeSessionId,
    excludeRole,
  } = options;

  const allMessages = getAllStoredMessages();

  if (allMessages.length === 0 || queryEmbedding.length === 0) {
    return [];
  }

  // Calculate similarity scores
  const scored = allMessages
    .filter(msg => {
      if (excludeSessionId && msg.sessionId === excludeSessionId) return false;
      if (excludeRole && msg.role === excludeRole) return false;
      return msg.embedding && msg.embedding.length > 0;
    })
    .map(msg => ({
      message: msg,
      score: cosineSimilarity(queryEmbedding, msg.embedding),
    }))
    .filter(item => item.score >= similarityThreshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored.map(item => item.message);
}

/**
 * Cosine similarity between two vectors
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) {
    return 0;
  }

  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));

  if (magA === 0 || magB === 0) {
    return 0;
  }

  return dotProduct / (magA * magB);
}

/**
 * Clear all RAG storage (useful for debugging or user request)
 */
export function clearRagStorage(): void {
  try {
    localStorage.removeItem(RAG_STORAGE_KEY);
  } catch (e) {
    console.warn("RAG storage clear failed:", e);
  }
}

/**
 * Get RAG storage stats
 */
export function getRagStorageStats() {
  const messages = getAllStoredMessages();
  const bySession: Record<string, number> = {};
  
  messages.forEach(msg => {
    bySession[msg.sessionId] = (bySession[msg.sessionId] || 0) + 1;
  });

  return {
    totalMessages: messages.length,
    messagesBySession: bySession,
    storageSize: new Blob([JSON.stringify(messages)]).size,
  };
}
