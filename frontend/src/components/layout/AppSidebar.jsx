import { useEffect, useState } from "react";

import {
  CalendarDays,
  CheckSquare,
  LayoutDashboard,
  List,
  Settings,
  User,
  PanelLeft,
} from "lucide-react";

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
  useSidebar,
} from "@/components/ui/sidebar";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { NavLink, useLocation, useNavigate } from "react-router";

import { useLogout } from "@/features/auth/hooks/use-logout";
import { useAuth } from "@/shared/auth-provider";
import { getAuthErrorMessage } from "@/features/auth/utils/get-auth-error-message";
import { getProfilePicture } from "@/features/settings/api/profile-picture-api";

// Main navigation links
const navigation = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Tasks",
    href: "/tasks",
    icon: CheckSquare,
  },
  {
    label: "Calendar",
    href: "/calendar",
    icon: CalendarDays,
  },
  {
    label: "Schedule",
    href: "/schedule",
    icon: List,
  },
];

function AppSidebar() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { error, isPending, logout } = useLogout();
  const navigate = useNavigate();
  const { toggleSidebar } = useSidebar();

  const [profilePicture, setProfilePicture] = useState(null);

  const userName = user?.displayName ?? user?.email ?? "Student";

  // Load the profile picture for the logged-in user
  useEffect(() => {
    let cancelled = false;

    if (!user?.uid) {
      return;
    }

    async function loadProfilePicture() {
      try {
        const result = await getProfilePicture();

        if (!cancelled) {
          setProfilePicture(result.profilePicture || null);
        }
      } catch (err) {
        console.error("Could not load profile picture:", err);

        if (!cancelled) {
          setProfilePicture(null);
        }
      }
    }

    loadProfilePicture();

    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  // Reload the picture when it changes in Settings
  useEffect(() => {
    async function updateProfilePicture() {
      if (!user?.uid) return;

      try {
        const result = await getProfilePicture();
        setProfilePicture(result.profilePicture || null);
      } catch (err) {
        console.error("Could not refresh profile picture:", err);
      }
    }

    window.addEventListener("profile-picture-updated", updateProfilePicture);

    return () => {
      window.removeEventListener("profile-picture-updated", updateProfilePicture);
    };
  }, [user?.uid]);

  // Log the user out
  async function handleLogout() {
    try {
      await logout();
      navigate("/login");
      // eslint-disable-next-line no-empty
    } catch {}
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="Smart Student Planner">
              {/* Smart Student Planner logo */}
              <img src="/favicon.svg" alt="Smart Student Planner" className="size-8 rounded-md" />

              <span className="truncate font-semibold">Smart Student Planner</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {/* Button to minimize the sidebar */}
          <div className="hidden md:block">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="cursor-pointer"
                  onClick={toggleSidebar}
                  tooltip="Expand Sidebar"
                >
                  <PanelLeft />
                  <span>Minimize</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </div>

          {/* Navigation links */}
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
              <DropdownMenuTrigger render={<SidebarMenuButton tooltip="Profile" />}>
                {/* Show the saved picture or the default icon */}
                {profilePicture ? (
                  <img
                    src={profilePicture}
                    alt="Your profile picture"
                    className="size-6 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <User />
                )}

                <span>{userName}</span>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate("/settings")}>
                  <User />
                  Profile
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => navigate("/settings")}>
                  <Settings />
                  Settings
                </DropdownMenuItem>

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
