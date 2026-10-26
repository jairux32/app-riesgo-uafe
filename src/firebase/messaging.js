import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import app from './config';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

let messaging = null;
let db = null;

const getMessagingInstance = () => {
  if (!messaging) {
    try {
      messaging = getMessaging(app);
    } catch (err) {
      console.error('Error inicializando Firebase Messaging:', err);
      return null;
    }
  }
  return messaging;
};

const getDbInstance = () => {
  if (!db) {
    db = getFirestore(app);
  }
  return db;
};

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || '';

export const requestNotificationPermission = async (userId) => {
  try {
    const msgInstance = getMessagingInstance();
    if (!msgInstance) return null;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Permiso de notificaciones denegado');
      return null;
    }

    const token = await getToken(msgInstance, { vapidKey: VAPID_KEY });
    if (token) {
      const database = getDbInstance();
      await setDoc(doc(database, 'users', userId), { fcmToken: token }, { merge: true });
      console.log('FCM Token guardado:', token);
      return token;
    }
  } catch (err) {
    console.error('Error obteniendo FCM token:', err);
  }
  return null;
};

export const onMessageReceived = (callback) => {
  try {
    const msgInstance = getMessagingInstance();
    if (!msgInstance) return () => {};
    return onMessage(msgInstance, (payload) => {
      console.log('Mensaje recibido:', payload);
      callback(payload);
    });
  } catch (err) {
    console.error('Error en onMessage:', err);
    return () => {};
  }
};
