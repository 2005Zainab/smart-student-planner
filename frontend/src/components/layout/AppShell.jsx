import { AppSidebar } from "./AppSidebar";
import { Header } from "./Header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

function AppShell({ children }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Header />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}

export { AppShell };
