import { auth } from "../../../shared/auth";
import { sendPasswordResetEmail } from "firebase/auth";

export const resetPassword = async ({ email }) => {
  const actionCodeSettings = {
    url: `${window.location.origin}/reset-password`,
  };

  await sendPasswordResetEmail(auth, email, actionCodeSettings);
};