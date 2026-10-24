// The firebaseConfig object from the Firebase console. Set it to null to use
// the local Node server instead (offline development).
// These values identify the project; they are not secrets. The security
// rules in database.rules.json are what protect the data.
window.MEETCUTE_FIREBASE = {
  apiKey: 'AIzaSyCosM-bQTErszN6g6WQAGaYjh_jH4pYv3s',
  authDomain: 'meetcute-a66da.firebaseapp.com',
  databaseURL: 'https://meetcute-a66da-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'meetcute-a66da',
  storageBucket: 'meetcute-a66da.firebasestorage.app',
  messagingSenderId: '747862088816',
  appId: '1:747862088816:web:6f360af6998cb86e26a8b5',
};
// Until the database exists, stay on the local server rather than half-working.
if (!window.MEETCUTE_FIREBASE.databaseURL) window.MEETCUTE_FIREBASE = null;
// Add ?local to the URL to test against the local Node server instead of the
// real database (keeps test conversations out of Firebase).
if (/[?&]local\b/.test(location.search)) window.MEETCUTE_FIREBASE = null;
