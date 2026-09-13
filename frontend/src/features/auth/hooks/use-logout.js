import { useState, useCallback } from "react";
import { logout as logoutRequest } from "../api/logout";

export const useLogout = () => {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState(null);

  const logout = useCallback(async () => {
    setIsPending(true);
    setError(null);
    try {
      await logoutRequest();
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setIsPending(false);
    }
  }, []);

  return { logout, isPending, error };
};
