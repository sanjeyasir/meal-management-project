const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, doc, deleteDoc } = require("firebase/firestore");

const firebaseConfig = {
  apiKey: "AIzaSyBMHPcENLLt4uYIjCQIxNWrx339Aksv8Js",
  authDomain: "meal-management-system-ac8ca.firebaseapp.com",
  projectId: "meal-management-system-ac8ca",
  storageBucket: "meal-management-system-ac8ca.firebasestorage.app",
  messagingSenderId: "262120546026",
  appId: "1:262120546026:web:e5119d0a5effc829a74193"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function inspectCollections() {
  const collections = ["users", "employees", "meal_allocations", "employee_categories", "departments"];
  
  for (const colName of collections) {
    console.log(`\n=================== COLLECTION: ${colName} ===================`);
    const snap = await getDocs(collection(db, colName));
    console.log(`Total documents: ${snap.size}`);
    snap.forEach(d => {
      console.log(`Doc ID: "${d.id}" ->`, JSON.stringify(d.data()));
    });
  }
}

inspectCollections().catch(err => {
  console.error("Error inspecting:", err);
  process.exit(1);
});
