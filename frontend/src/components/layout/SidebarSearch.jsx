import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useNavigate } from "react-router";

import {
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useTasksContext } from "@/features/tasks/context/TasksContext";

function SidebarSearch() {
  const [query, setQuery] = useState("");
  const { tasks } = useTasksContext();
  const { state, isMobile, setOpen, setOpenMobile } = useSidebar();
  const navigate = useNavigate();

  const searchText = query.trim().toLowerCase();

  // Active tasks only checked by title/subject
  // useMemo to optimise performance
  const results = useMemo(() => {
    if (!searchText) return [];

    return tasks.filter(
      task =>
        task.status !== "Completed" &&
        [task.title, task.subject].some(field => field?.toLowerCase().includes(searchText)),
    );
  }, [tasks, searchText]);
  function handleSelect(task) {
    navigate(`/tasks?view=${encodeURIComponent(task.id)}`);
    setQuery("");
    if (isMobile) {
      setOpenMobile(false);
    }
  }

  // Collapsed sidebar: show a magnifying glass that expands the sidebar
  if (state === "collapsed" && !isMobile) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            aria-label="Search tasks"
            tooltip="Search tasks"
            onClick={() => setOpen(true)}
          >
            <Search />
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <div className="flex flex-col gap-1 pt-2">
      <SidebarInput
        type="search"
        value={query}
        onChange={event => setQuery(event.target.value)}
        placeholder="Search tasks..."
        aria-label="Search tasks"
      />

      {searchText && results.length === 0 && (
        <p className="px-2 py-1 text-sm text-muted-foreground">No tasks found</p>
      )}

      {results.length > 0 && (
        <SidebarMenu className="max-h-64 overflow-y-auto">
          {results.map(task => (
            <SidebarMenuItem key={task.id}>
              <SidebarMenuButton
                className="h-auto flex-col items-start gap-0 py-1.5"
                onClick={() => handleSelect(task)}
              >
                <span className="w-full truncate">{task.title}</span>
                {task.subject && (
                  <span className="w-full truncate text-xs text-muted-foreground">
                    {task.subject}
                  </span>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      )}
    </div>
  );
}

export { SidebarSearch };
