import { useState, useCallback } from "react";
import { confirmResetPassword } from "../api/confirm-reset-password";

export const useConfirmResetPassword = () => {
    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState(null);

    const confirm = useCallback(async ({ oobCode, newPassword }) => {
        setIsPending(true);
        setError(null);
        try {
            await confirmResetPassword({ oobCode, newPassword });
        } catch (err) {
            setError(err);
            throw err;
        } finally {
            setIsPending(false);
        }
    }, []);

    return { confirm, isPending, error };
};