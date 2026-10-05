import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useState } from "react";
import { TasksPage } from "./TasksPage";
import { httpClient } from "../../../shared/http-client";

let mockTasks = [];

vi.mock("../context/TasksContext", () => ({
  useTasksContext: () => {
    const [tasks, setTasks] = useState(mockTasks);
    return { tasks, setTasks, isLoading: false, error: null };
  },
}));

vi.mock("../../../shared/http-client", () => ({
  httpClient: vi.fn(),
}));

vi.mock("./TaskForm", () => ({
  TaskForm: ({ draft, setDraft, onSave, onCancel, titleError, saveError }) => (
    <div data-testid="task-form">
      <input
        aria-label="title"
        value={draft.title}
        onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
      />
      {titleError && <p role="alert">{titleError}</p>}
      {saveError && <p role="alert">{saveError}</p>}
      <button onClick={onSave}>Save</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

vi.mock("./TaskList", () => ({
  TaskList: ({ tasks, onEdit, onDelete, onToggle }) => (
    <div data-testid="task-list">
      {tasks.map(task => (
        <div key={task.id} data-testid={`task-${task.id}`}>
          <span>{task.title}</span>
          <button onClick={() => onToggle(task.id)}>toggle</button>
          <button onClick={() => onDelete(task.id)}>delete</button>
          <button onClick={() => onEdit(task)}>edit</button>
        </div>
      ))}
    </div>
  ),
}));

describe("TasksPage", () => {
  beforeEach(() => {
    mockTasks = [{ id: "task-1", title: "Finish essay", status: "To Do" }];
    vi.clearAllMocks();
  });

  it("renders existing tasks", () => {
    render(<TasksPage />);
    expect(screen.getByText("Finish essay")).toBeInTheDocument();
  });

  it("opens the editor when Add task is clicked", async () => {
    render(<TasksPage />);
    await userEvent.click(screen.getByRole("button", { name: /add task/i }));
    expect(screen.getByTestId("task-form")).toBeInTheDocument();
  });

  it("shows a title error and does not call the API when saving a blank title", async () => {
    render(<TasksPage />);
    await userEvent.click(screen.getByRole("button", { name: /add task/i }));
    await userEvent.clear(screen.getByLabelText("title"));
    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/cannot be empty/i);
    expect(httpClient).not.toHaveBeenCalled();
  });

  it("creates a task via the API and displays it on success", async () => {
    httpClient.mockResolvedValue({ id: "task-2", title: "Read chapter 4", status: "To Do" });

    render(<TasksPage />);
    await userEvent.click(screen.getByRole("button", { name: /add task/i }));
    await userEvent.type(screen.getByLabelText("title"), "Read chapter 4");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(httpClient).toHaveBeenCalledWith(
        "http://localhost:3000/api/tasks",
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(await screen.findByText("Read chapter 4")).toBeInTheDocument();
  });

  it("shows a save error and keeps the editor open when the API call fails", async () => {
    httpClient.mockRejectedValue(new Error("Failed to fetch"));

    render(<TasksPage />);
    await userEvent.click(screen.getByRole("button", { name: /add task/i }));
    await userEvent.type(screen.getByLabelText("title"), "Read chapter 4");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to fetch");
  });

  it("deletes a task after confirming", async () => {
    httpClient.mockResolvedValue({});

    render(<TasksPage />);
    await userEvent.click(screen.getByRole("button", { name: "delete" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(httpClient).toHaveBeenCalledWith(
        "http://localhost:3000/api/tasks/task-1",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
    expect(screen.queryByText("Finish essay")).not.toBeInTheDocument();
  });

  it("marks a task completed when toggled", async () => {
    httpClient.mockResolvedValue({});

    render(<TasksPage />);
    await userEvent.click(screen.getByRole("button", { name: "toggle" }));

    await waitFor(() => expect(httpClient).toHaveBeenCalled());

    const [url, options] = httpClient.mock.calls[0];
    expect(url).toBe("http://localhost:3000/api/tasks/task-1");
    expect(options.method).toBe("PATCH");
    expect(JSON.parse(options.body)).toEqual({
      status: "Completed",
      reminderDate: null,
      reminderTime: null,
    });
  });

  it("edits a one-off task through /api/tasks/:id", async () => {
    httpClient.mockResolvedValue({ id: "task-1", title: "Finish essay now", status: "To Do" });

    render(<TasksPage />);
    await userEvent.click(screen.getByRole("button", { name: "edit" }));
    await userEvent.type(screen.getByLabelText("title"), " now");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(httpClient).toHaveBeenCalled());

    const [url, options] = httpClient.mock.calls[0];
    expect(url).toBe("http://localhost:3000/api/tasks/task-1");
    expect(options.method).toBe("PATCH");
    expect(JSON.parse(options.body)).toMatchObject({ title: "Finish essay now" });
  });

  describe("recurring occurrences", () => {
    const occurrenceUrl = "http://localhost:3000/api/task-series/s1/occurrences/2026-10-03";

    beforeEach(() => {
      // Shaped like a server occurrence: explicit seriesId/occurrenceDate, null (not
      // undefined) for empty reminder/time fields.
      mockTasks = [
        {
          id: "s1_2026-10-03",
          seriesId: "s1",
          occurrenceDate: "2026-10-03",
          title: "Study",
          description: "",
          subject: "Math",
          status: "To Do",
          dueDate: "2026-10-03",
          time: null,
          checklist: [],
          reminderDate: null,
          reminderTime: null,
          virtual: true,
        },
      ];
    });

    it("toggles status through the occurrence endpoint", async () => {
      httpClient.mockResolvedValue({});

      render(<TasksPage />);
      await userEvent.click(screen.getByRole("button", { name: "toggle" }));

      await waitFor(() => expect(httpClient).toHaveBeenCalled());

      const [url, options] = httpClient.mock.calls[0];
      expect(url).toBe(occurrenceUrl);
      expect(options.method).toBe("PATCH");
      expect(JSON.parse(options.body)).toEqual({
        status: "Completed",
        reminderDate: null,
        reminderTime: null,
      });
    });

    it("sends only the changed field when editing", async () => {
      httpClient.mockResolvedValue({ title: "Study hard" });

      render(<TasksPage />);
      await userEvent.click(screen.getByRole("button", { name: "edit" }));
      await userEvent.type(screen.getByLabelText("title"), " hard");
      await userEvent.click(screen.getByRole("button", { name: /save/i }));

      await waitFor(() => expect(httpClient).toHaveBeenCalled());

      const [url, options] = httpClient.mock.calls[0];
      expect(url).toBe(occurrenceUrl);
      // No dueDate (occurrences can't move), seriesId, priority or other untouched fields.
      expect(JSON.parse(options.body)).toEqual({ title: "Study hard" });
    });

    it("sends no request when an untouched occurrence is saved", async () => {
      render(<TasksPage />);
      await userEvent.click(screen.getByRole("button", { name: "edit" }));
      await userEvent.click(screen.getByRole("button", { name: /save/i }));

      expect(httpClient).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.queryByTestId("task-form")).not.toBeInTheDocument());
    });

    it("keeps the task's id when the response does not include one", async () => {
      // The materialized occurrence doc has no id field of its own.
      httpClient.mockResolvedValue({
        seriesId: "s1",
        occurrenceDate: "2026-10-03",
        title: "Study hard",
        virtual: false,
      });

      render(<TasksPage />);
      await userEvent.click(screen.getByRole("button", { name: "edit" }));
      await userEvent.type(screen.getByLabelText("title"), " hard");
      await userEvent.click(screen.getByRole("button", { name: /save/i }));

      expect(await screen.findByText("Study hard")).toBeInTheDocument();
      expect(screen.getByTestId("task-s1_2026-10-03")).toBeInTheDocument();
    });
  });
});
