import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { 
  initializeFirestore,
  getFirestore,
  doc, 
  getDoc, 
  collection, 
  writeBatch, 
  getDocs, 
  serverTimestamp, 
  getDocFromServer 
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

// Safe LocalStorage wrapper to bypass browser security policies in restricted iframe previews
const safeLocalStorage = {
  getItem(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && 'localStorage' in window && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch (e) {
      console.warn("localStorage.getItem blocked by security/iframe restriction policies:", e);
    }
    return null;
  },
  setItem(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined' && 'localStorage' in window && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch (e) {
      console.warn("localStorage.setItem blocked by security/iframe restriction policies:", e);
    }
  }
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

let dbInstance: any = null;
try {
  // Try to force long polling to bypass WebSocket restrictions in cloud container environments
  dbInstance = initializeFirestore(app, {
    experimentalForceLongPolling: true,
  }, firebaseConfig.firestoreDatabaseId || '(default)');
} catch (err) {
  console.warn("First initializeFirestore attempt failed, trying default Firestore initialization:", err);
  try {
    dbInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  } catch (err2) {
    console.error("All Firestore initialization attempts failed. The application will function in local/cached mode:", err2);
    dbInstance = null;
  }
}

export const db = dbInstance;
export const auth = getAuth();
export const googleProvider = new GoogleAuthProvider();
export const storage = getStorage(app);

// Error Handling Pattern from Guidelines
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Critical Connection Test from Guidelines
async function testConnection() {
  if (!db) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firestore reports client is offline. Offline fallback modes are active.");
    }
  }
}
testConnection();

export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
}

export async function logout() {
  await signOut(auth);
}

export async function isAdmin(uid: string) {
  // First check hardcoded admin
  if (auth.currentUser?.email === 'rajyar99@gmail.com') return true;
  if (!db) return false;
  
  const path = `admins/${uid}`;
  try {
    const adminDoc = await getDoc(doc(db, 'admins', uid));
    return adminDoc.exists();
  } catch (e) {
    // If it's a permission error, it means we're not an admin (based on rules)
    if (e instanceof Error && e.message.includes('permission')) {
      return false;
    }
    handleFirestoreError(e, OperationType.GET, path);
    return false;
  }
}

function getLocalGitaFallback() {
  try {
    const metaStr = safeLocalStorage.getItem('_local_gita_metadata');
    const chunksStr = safeLocalStorage.getItem('_local_gita_chunks');
    if (metaStr && chunksStr) {
      return {
        metadata: JSON.parse(metaStr),
        chunks: JSON.parse(chunksStr)
      };
    }
  } catch (e) {
    console.warn("Error reading local backup:", e);
  }
  return null;
}

export async function saveGitaData(
  name: string, 
  chunks: { text: string; embedding: number[] }[], 
  pdfBlob?: Blob,
  pdfSize?: number
) {
  const metadataPath = 'config/gita';
  let pdfUrl = '';

  // 1. Try uploading actual PDF file to Firebase Storage if provided
  if (db && storage && pdfBlob) {
    try {
      console.log("Uploading PDF to Firebase Storage...");
      const fileRef = ref(storage, 'gita/active_gita.pdf');
      const uploadResult = await uploadBytes(fileRef, pdfBlob, {
        contentType: 'application/pdf'
      });
      pdfUrl = await getDownloadURL(uploadResult.ref);
      console.log("PDF uploaded successfully, URL:", pdfUrl);
    } catch (storageErr) {
      console.warn("Storage upload failed, continuing with DB update without file hosting. Error:", storageErr);
    }
  }

  // Update local cache immediately so it's ready offline
  const localMetadata = { 
    name, 
    updatedAt: new Date().toISOString(),
    pdfUrl,
    pdfSize
  };
  try {
    safeLocalStorage.setItem('_local_gita_metadata', JSON.stringify(localMetadata));
    safeLocalStorage.setItem('_local_gita_chunks', JSON.stringify(chunks));
  } catch (err) {
    console.warn("localStorage caching failed:", err);
  }

  if (!db) {
    console.warn("Firestore not active; cached Gita locally.");
    return;
  }

  try {
    // 2. Fetch and delete existing chunks to avoid mixing old and new versions
    console.log("Purging old document chunks...");
    const chunksSnap = await getDocs(collection(db, 'config', 'gita', 'chunks'));
    if (!chunksSnap.empty) {
      const deleteBatch = writeBatch(db);
      chunksSnap.docs.forEach((docSnap) => {
        deleteBatch.delete(docSnap.ref);
      });
      try {
        await deleteBatch.commit();
        console.log("Deleted old chunks.");
      } catch (delErr) {
        console.warn("Batch chunk deletion failed:", delErr);
      }
    }

    // 3. Save new metadata and chunks
    const insertBatch = writeBatch(db);
    const metadataRef = doc(db, 'config', 'gita');
    
    const fieldsToSet: any = {
      name,
      updatedAt: serverTimestamp()
    };
    if (pdfUrl) {
      fieldsToSet.pdfUrl = pdfUrl;
    }
    if (pdfSize) {
      fieldsToSet.pdfSize = pdfSize;
    }

    insertBatch.set(metadataRef, fieldsToSet);

    chunks.forEach((chunk, i) => {
      const chunkRef = doc(collection(db, 'config', 'gita', 'chunks'));
      insertBatch.set(chunkRef, {
        ...chunk,
        order: i
      });
    });

    await insertBatch.commit();
    console.log("Successfully stored new Gita information.");
    return { pdfUrl };
  } catch (e) {
    console.error("Firestore write failed, fallback cache remains active:", e);
    handleFirestoreError(e, OperationType.WRITE, metadataPath);
    return null;
  }
}

export async function loadGitaData() {
  if (!db) {
    console.warn("Firestore database not configured or active. Loading local fallback...");
    return getLocalGitaFallback();
  }

  const metadataPath = 'config/gita';
  
  const fetchPromise = (async () => {
    const metadataSnap = await getDoc(doc(db, 'config', 'gita'));
    if (!metadataSnap.exists()) {
      return getLocalGitaFallback();
    }

    const chunksSnap = await getDocs(collection(db, 'config', 'gita', 'chunks'));
    const chunks = chunksSnap.docs
      .map(doc => doc.data() as { text: string; embedding: number[]; order?: number })
      // Sort by original page/chunk order
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const result = {
      metadata: metadataSnap.data(),
      chunks
    };

    // Keep client cache in sync
    try {
      safeLocalStorage.setItem(
        '_local_gita_metadata', 
        JSON.stringify({ 
          name: result.metadata?.name || 'Gita reference', 
          updatedAt: new Date().toISOString(),
          pdfUrl: result.metadata?.pdfUrl || '',
          pdfSize: result.metadata?.pdfSize || 0
        })
      );
      safeLocalStorage.setItem('_local_gita_chunks', JSON.stringify(result.chunks));
    } catch (err) {
      console.warn("Error updating local storage cache:", err);
    }

    return result;
  })();

  const timeoutPromise = new Promise<null>((_, reject) => 
    setTimeout(() => reject(new Error("Timeout connecting to database")), 3500)
  );

  try {
    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (e) {
    console.error("Firestore loading error or timeout. Falling back to client cache:", e);
    const localData = getLocalGitaFallback();
    if (localData) {
      return localData;
    }
    // Only throw the real error if we don't even have a local fallback and it's not a timeout
    if (e instanceof Error && e.message.includes("Timeout")) {
      return null;
    }
    handleFirestoreError(e, OperationType.GET, metadataPath);
    return null;
  }
}

