import { db } from "../shared/firebase.js";

export async function getUserToday(uid) {
  const userDoc = await db.collection("users").doc(uid).get();
  const timezone = userDoc.exists && userDoc.data().timezone ? userDoc.data().timezone : "UTC";

  let resolvedTimezone = timezone;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format();
  } catch {
    resolvedTimezone = "UTC";
  }

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: resolvedTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
