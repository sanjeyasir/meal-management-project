const { initializeApp } = require("firebase/app");
const { getAuth, signInWithEmailAndPassword } = require("firebase/auth");
const { getFirestore, doc, getDoc, collection, getDocs } = require("firebase/firestore");

const firebaseConfig = {
  apiKey: "AIzaSyBMHPcENLLt4uYIjCQIxNWrx339Aksv8Js",
  authDomain: "meal-management-project.firebaseapp.com",
  projectId: "meal-management-project",
  storageBucket: "meal-management-project.firebasestorage.app",
  messagingSenderId: "262120546026",
  appId: "1:262120546026:web:e5119d0a5effc829a74193"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function verify() {
  await signInWithEmailAndPassword(auth, "admin@gmail.com", "admin@123");

  const testIds = ["89", "817", "9141", "9142", "9001805", "9704825", "8001690", "8711575", "8541", "9541"];
  console.log("--- Checking sample uploaded docs ---");
  for (const id of testIds) {
    const snap = await getDoc(doc(db, "employees", id));
    if (snap.exists()) {
      const d = snap.data();
      console.log(`[PASS] ${id}: Name="${d.name}" | Comp=${d.company} | EPF=${d.epf_no} | Cat=${d.category_employment} | Pay=${d.pay_category} | Desig=${d.designation} | Dept=${d.department}`);
    } else {
      console.error(`[FAIL] Doc ${id} not found!`);
    }
  }

  const allSnap = await getDocs(collection(db, "employees"));
  let clericalCount = 0;
  let execCount = 0;
  let toyoUploaded = 0;
  let rileysUploaded = 0;

  allSnap.forEach(s => {
    const d = s.data();
    if (d.source_sheet === "Clerical List") clericalCount++;
    if (d.source_sheet === "Executive List") execCount++;
    if (d.source_sheet && d.company === "Toyo") toyoUploaded++;
    if (d.source_sheet && d.company === "Rileys") rileysUploaded++;
  });

  console.log("\n--- Upload Verification Summary ---");
  console.log(`Total records in Firestore: ${allSnap.size}`);
  console.log(`Clerical records uploaded: ${clericalCount}`);
  console.log(`Executive records uploaded: ${execCount}`);
  console.log(`Toyo uploaded (prefix 8): ${toyoUploaded}`);
  console.log(`Rileys uploaded (prefix 9): ${rileysUploaded}`);
  console.log(`Total new records from file: ${clericalCount + execCount}`);
}

verify().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
