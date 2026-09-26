import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { SchedulePage } from './SchedulePage';
import { httpClient } from '../../../shared/http-client';
import { addDays, format } from 'date-fns';

let mockTasks = [];

vi.mock('../../tasks/context/TasksContext', () => ({
  useTasksContext: () => {
    const [tasks, setTasks] = useState(mockTasks);
    return { tasks, setTasks, isLoading: false, error: null };
  },
}));
vi.mock('../../../shared/http-client', () => ({ httpClient: vi.fn() }));

vi.mock('../../tasks/components/TaskForm', () => ({
  TaskForm: ({ draft, setDraft, onSave, requireDateAndTime }) => (
    <div data-testid="task-form" data-require-date-and-time={String(requireDateAndTime)}>
      <input
        aria-label="title"
        value={draft.title}
        onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
      />
      <input
        aria-label="due date"
        type="date"
        value={draft.dueDate || ''}
        onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value }))}
      />
      <input
        aria-label="time"
        type="time"
        value={draft.time || ''}
        onChange={(e) => setDraft((d) => ({ ...d, time: e.target.value }))}
      />
      <button onClick={onSave}>Save</button>
    </div>
  ),
}));

vi.mock('./ScheduleList', () => ({
  ScheduleList: ({ tasks }) => (
    <div>
      {tasks.map((t) => (
        <span key={t.id}>{t.title}</span>
      ))}
    </div>
  ),
}));

describe('SchedulePage', () => {
  beforeEach(() => {
    const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    mockTasks = [
      { id: 'task-1', title: 'Study session', status: 'To Do', dueDate: tomorrow, time: '09:00' },
    ];
    vi.clearAllMocks();
  });

  it('groups and displays upcoming tasks by day', () => {
    render(<SchedulePage />);
    expect(screen.getByText('Study session')).toBeInTheDocument();
  });

  it('shows the empty state when there are no upcoming tasks', () => {
    mockTasks = [];
    render(<SchedulePage />);
    expect(screen.getByText(/no tasks scheduled/i)).toBeInTheDocument();
  });

  it('passes requireDateAndTime to TaskForm, since Schedule events must have a date and time', async () => {
    render(<SchedulePage />);
    await userEvent.click(screen.getByRole('button', { name: /add event/i }));

    expect(screen.getByTestId('task-form')).toHaveAttribute('data-require-date-and-time', 'true');
  });

  it('creates an event with a due date and time, sent to the API in the correct format', async () => {
    httpClient.mockResolvedValue({ id: 'task-2', title: 'New event' });

    render(<SchedulePage />);
    await userEvent.click(screen.getByRole('button', { name: /add event/i }));
    await userEvent.type(screen.getByLabelText('title'), 'New event');
    await userEvent.type(screen.getByLabelText('due date'), '2026-10-05');
    await userEvent.type(screen.getByLabelText('time'), '09:00');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(httpClient).toHaveBeenCalled());

    const [url, options] = httpClient.mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/tasks');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toMatchObject({
      title: 'New event',
      dueDate: '2026-10-05',
      time: '09:00',
    });
  });
});
