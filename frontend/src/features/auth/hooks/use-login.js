import { useState, useCallback } from "react";
import { loginWithEmail } from "../api/login-with-email";

export const useLogin = () => {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState(null);

  const login = useCallback(async (credentials) => {
    setIsPending(true);
    setError(null);
    try {
      const user = await loginWithEmail(credentials);
      return user;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setIsPending(false);
    }
  }, []);

  return { login, isPending, error };
};
