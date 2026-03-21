import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// 🔴 IDE TEDD A SAJÁT CONFIGOD
const firebaseConfig = {
apiKey: "AIzaSyDGuEn0AVRtEfXI_1P3MTIDxTl7RFID9Wo",

  authDomain: "registless.firebaseapp.com",
  projectId: "registless",
  storageBucket: "registless.firebasestorage.app",
  messagingSenderId: "27530670886",
  appId: "1:27530670886:web:45d855b605edbd057807e7",
 
};

const app = initializeApp(firebaseConfig);

// ✅ SAFE verzió (nem crash-el)
export const auth = getAuth(app);

export default app;