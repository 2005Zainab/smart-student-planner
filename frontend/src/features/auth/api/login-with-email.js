import { auth } from "../../../shared/auth";
import { signInWithEmailAndPassword } from "firebase/auth";

export const loginWithEmail = async ({ email, password }) => {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
};
