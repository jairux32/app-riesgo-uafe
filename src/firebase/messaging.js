import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import app from './config';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const messaging = getMessaging(app);
const db = getFirestore(app);

const VAPID_KEY = 'BEl62iOMfaU2n6AOr9Y7E9z8Y5E5M9T2L3K4J5H6G7F8D9S0A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U1V2W3X4Y5Z6';

export const requestNotificationPermission = async (userId) => {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Permiso de notificaciones denegado');
      return null;
    }

    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (token) {
      // Guardar token en Firestore
      await setDoc(doc(db, 'users', userId), { fcmToken: token }, { merge: true });
      console.log('FCM Token guardado:', token);
      return token;
    }
  } catch (err) {
    console.error('Error obteniendo FCM token:', err);
  }
  return null;
};

export const onMessageReceived = (callback) => {
  return onMessage(messaging, (payload) => {
    console.log('Mensaje recibido:', payload);
    callback(payload);
  });
};
