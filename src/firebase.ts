import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBFwMZO7frhcze55NIeg07xOlfHlsLeszQ",
  authDomain: "kaihatu-7219f.firebaseapp.com",
  projectId: "kaihatu-7219f",
  storageBucket: "kaihatu-7219f.firebasestorage.app",
  messagingSenderId: "739739061081",
  appId: "1:739739061081:web:5710897105590342245a48",
  measurementId: "G-SL623Y1ZKE"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
auth.languageCode = 'ja';
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()})
});
