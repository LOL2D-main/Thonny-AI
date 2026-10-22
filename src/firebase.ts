import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

// Blueprint Validation Constants (Synchronicity with firebase-blueprint.json & firestore.rules)
const ID_REGEX = /^[a-zA-Z0-9_\-]+$/;
const TITLE_REGEX = /^[a-zA-Z0-9_.\- ]+$/;

export function sanitizeDocumentId(rawId: string): string {
  const cleaned = rawId.replace(/[^a-zA-Z0-9_\-]/g, "_").slice(0, 128);
  return cleaned || "doc_default";
}

export function sanitizeScriptTitle(rawTitle: string): string {
  const cleaned = rawTitle.replace(/[^a-zA-Z0-9_.\- ]/g, "_").trim().slice(0, 120);
  return cleaned || "untitled.py";
}

export async function signInWithGoogle(): Promise<User | null> {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function logOutUser(): Promise<void> {
  await signOut(auth);
}

export interface CloudScriptRecord {
  id: string;
  title: string;
  path: string;
  content: string;
  ownerId: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface CloudChatMessageRecord {
  id: string;
  role: "user" | "model";
  text: string;
  model: "gemini-4-argon" | "gemini-3.8-flash" | "gemini-3.1-flash-lite";
  ownerId: string;
  createdAt?: Timestamp | null;
}

export async function saveCloudScript(params: {
  id: string;
  title: string;
  path: string;
  content: string;
  isExisting?: boolean;
}): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;

  const docId = sanitizeDocumentId(params.id);
  const safeTitle = sanitizeScriptTitle(params.title);
  const safePath = (params.path || `C:\\Users\\User\\Thonny\\${safeTitle}`).slice(0, 260);
  const safeContent = (params.content || "").slice(0, 100000);

  if (!ID_REGEX.test(docId) || !TITLE_REGEX.test(safeTitle)) {
    throw new Error("Invalid script ID or title format.");
  }

  const docRef = doc(db, "scripts", docId);
  try {
    if (params.isExisting) {
      await updateDoc(docRef, {
        title: safeTitle,
        path: safePath,
        content: safeContent,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(docRef, {
        title: safeTitle,
        path: safePath,
        content: safeContent,
        ownerId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    // If updateDoc failed because document wasn't created yet, fallback to setDoc
    if (params.isExisting) {
      try {
        await setDoc(docRef, {
          title: safeTitle,
          path: safePath,
          content: safeContent,
          ownerId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return;
      } catch (createErr) {
        handleFirestoreError(createErr, OperationType.CREATE, `scripts/${docId}`);
      }
    }
    handleFirestoreError(
      err,
      params.isExisting ? OperationType.UPDATE : OperationType.CREATE,
      `scripts/${docId}`
    );
  }
}

export async function deleteCloudScript(id: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  const docId = sanitizeDocumentId(id);
  try {
    await deleteDoc(doc(db, "scripts", docId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `scripts/${docId}`);
  }
}

export async function saveCloudChatMessage(params: {
  id: string;
  role: "user" | "model";
  text: string;
  model: "gemini-4-argon" | "gemini-3.8-flash" | "gemini-3.1-flash-lite";
}): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  const docId = sanitizeDocumentId(params.id);
  const safeText = (params.text || "").trim().slice(0, 50000);
  if (!safeText) return;

  const validModel =
    params.model === "gemini-4-argon" ||
    params.model === "gemini-3.8-flash" ||
    params.model === "gemini-3.1-flash-lite"
      ? params.model
      : "gemini-3.8-flash";

  try {
    await setDoc(doc(db, "chat_messages", docId), {
      role: params.role === "model" ? "model" : "user",
      text: safeText,
      model: validModel,
      ownerId: user.uid,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `chat_messages/${docId}`);
  }
}

export async function deleteCloudChatMessage(id: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  const docId = sanitizeDocumentId(id);
  try {
    await deleteDoc(doc(db, "chat_messages", docId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `chat_messages/${docId}`);
  }
}

export { onAuthStateChanged, collection, query, where, onSnapshot };
export type { User };
