const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

const app = getApps().length === 0 ? initializeApp() : getApps()[0];

const db = getFirestore(app);
const auth = getAuth(app);

module.exports = {
  db,
  auth,
  FieldValue
};
