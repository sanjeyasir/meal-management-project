const { initializeApp } = require("firebase/app");
const { getAuth, signInWithEmailAndPassword } = require("firebase/auth");
const { getFirestore, collection, getDocs, doc, writeBatch } = require("firebase/firestore");

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

async function updateAllToHalfPaid() {
  console.log("==================================================================");
  console.log("   UPDATING ALL EMPLOYEE DETAILS & ALLOCATIONS TO 'HALF PAID'     ");
  console.log("==================================================================");

  // 1. Authenticate with Firebase Authentication
  console.log("\n[1/4] Authenticating as Administrator...");
  try {
    const cred = await signInWithEmailAndPassword(auth, "admin@gmail.com", "admin@123");
    console.log(`   ✓ Authenticated successfully as ${cred.user.email}`);
  } catch (err) {
    console.warn(`   Notice: Admin email sign-in warning (${err.message}). Proceeding...`);
  }

  const now = new Date().toISOString();

  // 2. Update all Employee Documents to 'Half Paid'
  console.log("\n[2/4] Fetching all records from 'employees' collection...");
  const empSnap = await getDocs(collection(db, "employees"));
  console.log(`   Found ${empSnap.size} employee record(s). Updating pay_category to 'Half Paid'...`);

  let empUpdatedCount = 0;
  let batch = writeBatch(db);
  let batchCount = 0;

  for (const docSnap of empSnap.docs) {
    const data = docSnap.data();
    batch.update(docSnap.ref, {
      pay_category: "Half Paid",
      updated_at: now
    });
    empUpdatedCount++;
    batchCount++;

    if (batchCount >= 400) {
      await batch.commit();
      console.log(`   ✓ Committed batch of ${batchCount} employee updates...`);
      batch = writeBatch(db);
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
    console.log(`   ✓ Committed final batch of ${batchCount} employee updates.`);
  }
  console.log(`   ✓ Total ${empUpdatedCount} employee(s) updated to 'Half Paid'.`);

  // 3. Update all Active Meal Allocations to 'Half Paid'
  console.log("\n[3/4] Fetching all records from 'meal_allocations' collection...");
  const allocSnap = await getDocs(collection(db, "meal_allocations"));
  console.log(`   Found ${allocSnap.size} active meal allocation(s). Updating pay_category to 'Half Paid'...`);

  let allocUpdatedCount = 0;
  batch = writeBatch(db);
  batchCount = 0;

  for (const docSnap of allocSnap.docs) {
    batch.update(docSnap.ref, {
      pay_category: "Half Paid",
      updated_at: now
    });
    allocUpdatedCount++;
    batchCount++;

    if (batchCount >= 400) {
      await batch.commit();
      console.log(`   ✓ Committed batch of ${batchCount} meal allocation updates...`);
      batch = writeBatch(db);
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
    console.log(`   ✓ Committed final batch of ${batchCount} meal allocation updates.`);
  }
  console.log(`   ✓ Total ${allocUpdatedCount} meal allocation(s) updated to 'Half Paid'.`);

  // 4. Update Archived Meal Allocations (if present)
  console.log("\n[4/4] Checking 'archived_meal_allocations' collection...");
  try {
    const archSnap = await getDocs(collection(db, "archived_meal_allocations"));
    if (!archSnap.empty) {
      console.log(`   Found ${archSnap.size} archived allocation(s). Updating to 'Half Paid'...`);
      let archCount = 0;
      batch = writeBatch(db);
      batchCount = 0;

      for (const docSnap of archSnap.docs) {
        batch.update(docSnap.ref, {
          pay_category: "Half Paid",
          updated_at: now
        });
        archCount++;
        batchCount++;

        if (batchCount >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
        }
      }
      if (batchCount > 0) {
        await batch.commit();
      }
      console.log(`   ✓ Total ${archCount} archived allocation(s) updated to 'Half Paid'.`);
    } else {
      console.log("   No archived allocations found.");
    }
  } catch (archErr) {
    console.log("   Archived collection check note:", archErr.message);
  }

  console.log("\n==================================================================");
  console.log("   SUMMARY:");
  console.log(`   - Employees updated to 'Half Paid':        ${empUpdatedCount}`);
  console.log(`   - Meal allocations updated to 'Half Paid': ${allocUpdatedCount}`);
  console.log("   ALL RECORDS SUCCESSFULLY UPDATED TO 'HALF PAID'!");
  console.log("==================================================================\n");
}

updateAllToHalfPaid()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("FATAL ERROR during update:", err);
    process.exit(1);
  });
