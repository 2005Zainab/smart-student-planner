import { useState, useCallback } from "react";
import { registerWithEmail } from "../api/register-with-email";

export const useRegister = () => {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState(null);

  const register = useCallback(async (credentials) => {
    setIsPending(true);
    setError(null);
    try {
      const user = await registerWithEmail(credentials);
      return user;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setIsPending(false);
    }
  }, []);

  return { register, isPending, error };
};
