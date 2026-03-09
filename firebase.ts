// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDZraPiI2SI55b90U4O3IwXIOuMI3ujdK4",
  authDomain: "escala-mops.firebaseapp.com",
  projectId: "escala-mops",
  storageBucket: "escala-mops.firebasestorage.app",
  messagingSenderId: "506574748281",
  appId: "1:506574748281:web:23d95ad039e6add8e172a8",
  measurementId: "G-TZ71SD47M6"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app)
auth.useDeviceLanguage()
const analytics = getAnalytics(app);

export { auth }