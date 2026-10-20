import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const serviceAccount = JSON.parse(
  readFileSync(new URL("../serviceAccountKey.json", import.meta.url)),
);

initializeApp({
  credential: cert(serviceAccount),
});

export const db = getFirestore();
//allows optional fields to be left empty
db.settings({ ignoreUndefinedProperties: true });
