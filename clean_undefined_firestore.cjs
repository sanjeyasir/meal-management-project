const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, deleteDoc, doc } = require("firebase/firestore");

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

async function cleanUndefinedDocuments() {
  const collections = ["users", "employees", "meal_allocations", "employee_categories", "departments"];
  let totalDeleted = 0;

  for (const col of collections) {
    const snap = await getDocs(collection(db, col));
    for (const d of snap.docs) {
      const data = d.data();
      const id = d.id;
      const isUndefinedId = id === "undefined" || id === "null" || id.includes("undefined") || id.includes("null");
      const hasUndefinedEmpId = data.employee_id === "undefined" || data.emp_id === "undefined" || data.employee_id === null;

      if (isUndefinedId || hasUndefinedEmpId) {
        console.log(`[CLEANING] Deleting invalid doc from '${col}': ID='${id}', Data=`, data);
        await deleteDoc(d.ref);
        totalDeleted++;
      }
    }
  }

  console.log(`[DONE] Finished cleanup. Deleted ${totalDeleted} invalid/undefined document(s).`);
}

cleanUndefinedDocuments().catch(err => {
  console.error("Cleanup error:", err);
  process.exit(1);
});
