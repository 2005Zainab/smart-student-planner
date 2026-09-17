import { useState, useEffect, useCallback } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../../shared/auth";
import { getTasks } from "../api/getTasks";

export function useTasks() {
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getTasks();
      setTasks(data ?? []);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                fetchTasks();
            }
        });

        return () => unsubscribe();
    }, [fetchTasks]);

  return { tasks, setTasks, isLoading, error, refetch: fetchTasks };
}
