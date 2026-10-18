import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getAI, GoogleAIBackend } from "firebase/ai";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID,
  measurementId: import.meta.env.VITE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Initialize App Check
self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
initializeAppCheck(app, {
  // if we were to deploy this to an actual live website, we would need to replace this with a real site key
  // For development purposes, we can use a placeholder key, but it will not work in production.
  provider: new ReCaptchaV3Provider("placeholder-site-key"),
  isTokenAutoRefreshEnabled: true,
});

// Initialize the Gemini Developer API backend service.
const ai = getAI(app, { backend: new GoogleAIBackend() });

export { auth, ai };
