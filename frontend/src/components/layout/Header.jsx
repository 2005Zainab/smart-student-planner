import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "./ThemeToggle";
import { useLocation } from "react-router";

const pageTitles = {
  "/dashboard": "Dashboard",
  "/tasks": "Tasks",
  "/calendar": "Calendar",
};

function Header() {
  const { pathname } = useLocation();
  const title = pageTitles[pathname] ?? "Smart Student Planner";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <h1 className="text-sm font-semibold">{title}</h1>
      </div>
      <ThemeToggle />
    </header>
  );
}

export { Header };
