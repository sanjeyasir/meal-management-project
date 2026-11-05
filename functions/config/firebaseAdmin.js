const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { getStorage } = require("firebase-admin/storage");

// Determine the primary storage bucket from environment or default project bucket
const defaultBucketName =
  process.env.STORAGE_BUCKET ||
  (() => {
    try {
      return JSON.parse(process.env.FIREBASE_CONFIG || "{}").storageBucket;
    } catch (e) {
      return null;
    }
  })() ||
  "meal-management-project.firebasestorage.app";

const app =
  getApps().length === 0
    ? initializeApp({
        projectId: process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT || "meal-management-project",
        storageBucket: defaultBucketName
      })
    : getApps()[0];

const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

/**
 * Automatically find an existing bucket or create a dedicated storage instance
 */
async function getOrCreateStorageBucket() {
  const primaryCandidate = defaultBucketName;

  // 1. Check if the configured default bucket exists and is accessible
  try {
    const bucket = storage.bucket(primaryCandidate);
    const [exists] = await bucket.exists();
    if (exists) {
      return bucket;
    }
  } catch (err) {
    console.log(`[Storage] Default bucket check for '${primaryCandidate}':`, err.message);
  }

  // 2. Discover any bucket already active on this Google Cloud project
  try {
    if (storage.storageClient && typeof storage.storageClient.getBuckets === "function") {
      const [existingBuckets] = await storage.storageClient.getBuckets();
      if (existingBuckets && existingBuckets.length > 0) {
        const matched =
          existingBuckets.find(
            (b) =>
              b.name.includes("meal-management") ||
              b.name.includes("firebasestorage") ||
              b.name.includes("appspot")
          ) || existingBuckets[0];

        console.log(`[Storage] Found existing bucket on project: ${matched.name}`);
        return matched;
      }
    }
  } catch (listErr) {
    console.log("[Storage] Note while querying project buckets:", listErr.message);
  }

  // 3. Candidate bucket names to try or create
  const candidates = [
    primaryCandidate,
    "meal-management-project.appspot.com",
    "meal-management-project.firebasestorage.app",
    "meal-management-project-reports",
    "meal-management-project-archive"
  ];

  // Try creating an instance if not already existing
  for (const bName of candidates) {
    try {
      console.log(`[Storage] Attempting to create bucket instance '${bName}' in us-central1...`);
      const [newBucket] = await storage.storageClient.createBucket(bName, {
        location: "us-central1"
      });
      console.log(`[Storage] Created storage bucket instance successfully: ${newBucket.name}`);
      return newBucket;
    } catch (createErr) {
      console.log(`[Storage] Could not create bucket '${bName}':`, createErr.message);
    }
  }

  // Fallback to standard bucket reference
  return storage.bucket(primaryCandidate);
}

function getStorageBucket(customBucketName = null) {
  const target = customBucketName || defaultBucketName;
  try {
    return storage.bucket(target);
  } catch (err) {
    return storage.bucket();
  }
}

module.exports = {
  db,
  auth,
  storage,
  FieldValue,
  defaultBucketName,
  getStorageBucket,
  getOrCreateStorageBucket
};
