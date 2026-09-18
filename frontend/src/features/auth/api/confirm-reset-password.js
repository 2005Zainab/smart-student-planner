import { auth } from "../../../shared/auth";
import { confirmPasswordReset } from "firebase/auth";

export const confirmResetPassword = async ({ oobCode, newPassword }) => {
    await confirmPasswordReset(auth, oobCode, newPassword);
};