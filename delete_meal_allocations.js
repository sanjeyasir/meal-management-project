const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, deleteDoc, doc, writeBatch } = require("firebase/firestore");

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

async function wipeAllMealAllocations() {
  console.log("Fetching all meal_allocations from Firestore...");
  const snap = await getDocs(collection(db, "meal_allocations"));
  console.log(`Found ${snap.size} meal allocation document(s) in Firestore.`);

  if (snap.size === 0) {
    console.log("No meal allocations to delete.");
    return;
  }

  const batchSize = 400;
  let batch = writeBatch(db);
  let count = 0;
  let totalDeleted = 0;

  for (const docSnap of snap.docs) {
    batch.delete(docSnap.ref);
    count++;
    totalDeleted++;

    if (count >= batchSize) {
      await batch.commit();
      console.log(`Deleted batch of ${count} records...`);
      batch = writeBatch(db);
      count = 0;
    }
  }

  if (count > 0) {
    await batch.commit();
  }

  console.log(`[SUCCESS] Successfully wiped all ${totalDeleted} meal allocation records from Firestore!`);
}

wipeAllMealAllocations().catch(err => {
  console.error("Error wiping meal allocations:", err);
  process.exit(1);
});
