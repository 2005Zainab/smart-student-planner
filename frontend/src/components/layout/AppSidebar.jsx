import { CalendarDays, CheckSquare, LayoutDashboard, User } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NavLink, useLocation } from "react-router";
import { useLogout } from "@/features/auth/hooks/use-logout";
import { useNavigate } from "react-router";
import { useAuth } from "@/shared/auth-provider";
import { getAuthErrorMessage } from "@/features/auth/utils/get-auth-error-message";

const navigation = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Tasks", href: "/tasks", icon: CheckSquare },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
];

function AppSidebar() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { error, isPending, logout } = useLogout();
  const navigate = useNavigate();
  const userName = user?.displayName ?? user?.email ?? "Student";
  async function handleLogout() {
    try {
      await logout();
      navigate("/login");
    } catch {}
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="Smart Student Planner">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
                S
              </span>
              <span className="truncate font-semibold">
                Smart Student Planner
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {navigation.map(({ label, href, icon: Icon }) => (
              <SidebarMenuItem key={href}>
                <SidebarMenuButton
                  isActive={pathname === href}
                  render={<NavLink to={href} />}
                  tooltip={label}
                >
                  <Icon />
                  <span>{label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<SidebarMenuButton tooltip="Profile" />}
              >
                <User />
                <span>{userName}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>Profile</DropdownMenuItem>
                <DropdownMenuItem disabled={isPending} onClick={handleLogout}>
                  {isPending ? "Signing out..." : "Sign out"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
        {error && (
          <p className="px-2 text-xs text-destructive" role="alert">
            {getAuthErrorMessage(error, "We could not sign you out. Try again.")}
          </p>
        )}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

export { AppSidebar };
