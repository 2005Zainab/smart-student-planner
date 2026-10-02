import { auth } from "../../../shared/auth";
import { signOut } from "firebase/auth";

export const logout = () => signOut(auth);
