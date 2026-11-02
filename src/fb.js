import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, onSnapshot, writeBatch } from 'firebase/firestore';
import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
export { initializeApp, getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence,
  initializeFirestore, persistentLocalCache, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, onSnapshot, writeBatch, getAI, getGenerativeModel, GoogleAIBackend,
  initializeAppCheck, ReCaptchaEnterpriseProvider };
