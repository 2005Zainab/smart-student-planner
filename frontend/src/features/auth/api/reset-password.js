import { auth } from "../../../shared/auth";
import { sendPasswordResetEmail, fetchSignInMethodsForEmail } from "firebase/auth";

export const resetPassword = async ({ email }) => {
    const signInMethods = await fetchSignInMethodsForEmail(auth, email);

    if (signInMethods.length === 0) {
        const error = new Error("No account found with that email.");
        error.code = "auth/email-not-found";
        throw error;
    }

    const actionCodeSettings = {
        url: `${window.location.origin}/reset-password`,
    };

    await sendPasswordResetEmail(auth, email, actionCodeSettings);
};