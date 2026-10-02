import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useState } from "react";
import { CalendarPage } from "./CalendarPage";
import { httpClient } from "../../../shared/http-client";

let mockTasks = [];

vi.mock("../../tasks/context/TasksContext", () => ({
  useTasksContext: () => {
    const [tasks, setTasks] = useState(mockTasks);
    return { tasks, setTasks, isLoading: false, error: null };
  },
}));
vi.mock("../../../shared/http-client", () => ({ httpClient: vi.fn() }));
vi.mock("../../tasks/components/TaskForm", () => ({
  TaskForm: ({ draft, setDraft, onSave, titleError, saveError }) => (
    <div data-testid="task-form">
      <input
        aria-label="title"
        value={draft.title}
        onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
      />
      {titleError && <p role="alert">{titleError}</p>}
      {saveError && <p role="alert">{saveError}</p>}
      <button onClick={onSave}>Save</button>
    </div>
  ),
}));

describe("CalendarPage", () => {
  beforeEach(() => {
    mockTasks = [];
    vi.clearAllMocks();
  });

  it("navigates to the next and previous month", async () => {
    render(<CalendarPage />);
    const initialHeading = screen.getByRole("heading", { level: 2 }).textContent;

    await userEvent.click(screen.getByRole("button", { name: "→" }));
    expect(screen.getByRole("heading", { level: 2 }).textContent).not.toBe(initialHeading);

    await userEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(initialHeading);
  });

  it("requires a due date before saving a task", async () => {
    render(<CalendarPage />);
    await userEvent.click(screen.getByRole("button", { name: /add task/i }));
    await userEvent.type(screen.getByLabelText("title"), "Untitled task");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/choose a due date/i);
    expect(httpClient).not.toHaveBeenCalled();
  });
});
