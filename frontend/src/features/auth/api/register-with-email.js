import { auth } from "../../../shared/auth";
import { createUserWithEmailAndPassword } from "firebase/auth";

export const registerWithEmail = async ({ email, password }) => {
  const credential = await createUserWithEmailAndPassword(
    auth,
    email,
    password,
  );
  return credential.user;
};
