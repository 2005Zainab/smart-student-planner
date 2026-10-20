import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SidebarSearch } from "./SidebarSearch";

const mockNavigate = vi.fn();
let mockTasks = [];

vi.mock("react-router", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("@/features/tasks/context/TasksContext", () => ({
  useTasksContext: () => ({ tasks: mockTasks }),
}));

function renderSearch({ defaultOpen = true } = {}) {
  return render(
    <SidebarProvider defaultOpen={defaultOpen}>
      <SidebarSearch />
    </SidebarProvider>,
  );
}

describe("SidebarSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTasks = [
      { id: "t1", title: "Finish essay", subject: "English", status: "To Do" },
      { id: "t2", title: "Read chapter 4", subject: "History", status: "In Progress" },
      { id: "t3", title: "Essay draft", subject: "English", status: "Completed" },
      { id: "t4", title: "Lab report", subject: null, status: "To Do" },
    ];
  });

  it("shows no results before anything is typed", () => {
    renderSearch();
    expect(screen.queryByText("Finish essay")).not.toBeInTheDocument();
    expect(screen.queryByText("No tasks found")).not.toBeInTheDocument();
  });

  it("filters by title, ignoring case", async () => {
    renderSearch();
    await userEvent.type(screen.getByLabelText("Search tasks"), "ESSAY");

    expect(screen.getByText("Finish essay")).toBeInTheDocument();
    expect(screen.queryByText("Read chapter 4")).not.toBeInTheDocument();
  });

  it("filters by subject", async () => {
    renderSearch();
    await userEvent.type(screen.getByLabelText("Search tasks"), "history");

    expect(screen.getByText("Read chapter 4")).toBeInTheDocument();
    expect(screen.queryByText("Finish essay")).not.toBeInTheDocument();
  });

  it("never shows completed tasks", async () => {
    renderSearch();
    await userEvent.type(screen.getByLabelText("Search tasks"), "essay");

    expect(screen.getByText("Finish essay")).toBeInTheDocument();
    expect(screen.queryByText("Essay draft")).not.toBeInTheDocument();
  });

  it("shows a message when nothing matches", async () => {
    renderSearch();
    await userEvent.type(screen.getByLabelText("Search tasks"), "zzz");

    expect(screen.getByText("No tasks found")).toBeInTheDocument();
  });

  it("navigates to the task's view and clears the box when a result is clicked", async () => {
    renderSearch();
    await userEvent.type(screen.getByLabelText("Search tasks"), "lab");
    await userEvent.click(screen.getByRole("button", { name: /lab report/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/tasks?view=t4");
    expect(screen.getByLabelText("Search tasks")).toHaveValue("");
  });

  it("shows only a search icon when collapsed, and expands on click", async () => {
    renderSearch({ defaultOpen: false });
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Search tasks" }));

    expect(screen.getByRole("searchbox")).toBeInTheDocument();
  });
});
