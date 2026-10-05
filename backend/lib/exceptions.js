import { FieldValue } from "firebase-admin/firestore";

export function hasException(series, dateStr) {
  return (series.exceptions ?? []).includes(dateStr);
}

export function addExceptionUpdate(dateStr) {
  return { exceptions: FieldValue.arrayUnion(dateStr) };
}
