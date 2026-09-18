import { useState, useCallback } from "react";
import { resetPassword } from "../api/reset-password";

export const useResetPassword = () => {
    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState(null);

    const reset = useCallback(async (credentials) => {
        setIsPending(true);
        setError(null);
        try {
            await resetPassword(credentials);
        } catch (err) {
            setError(err);
            throw err;
        } finally {
            setIsPending(false);
        }
    }, []);

    return { reset, isPending, error };
};