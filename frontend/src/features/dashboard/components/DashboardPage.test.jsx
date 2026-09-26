import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardPage } from './DashboardPage';

vi.mock('@/shared/auth-provider', () => ({
  useAuth: () => ({ user: { displayName: 'Tung Tung Tung Sahur' } }),
}));

vi.mock('@/features/tasks/context/TasksContext', () => ({
  useTasksContext: vi.fn(),
}));

vi.mock('@/features/tasks/utils/task-date-utils', () => ({
  getUpcomingTasks: vi.fn(),
  getUndatedTasks: vi.fn(),
  getWeeklySchedule: vi.fn(),
}));

import { useTasksContext } from '@/features/tasks/context/TasksContext';
import {
  getUpcomingTasks,
  getUndatedTasks,
  getWeeklySchedule,
} from '@/features/tasks/utils/task-date-utils';

function renderDashboard() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUpcomingTasks.mockReturnValue([]);
    getUndatedTasks.mockReturnValue([]);
    getWeeklySchedule.mockReturnValue([]);
  });

  it('greets the signed-in user by name', () => {
    useTasksContext.mockReturnValue({ tasks: [], isLoading: false, error: null });
    renderDashboard();
    expect(screen.getByText(/good morning, tung tung tung sahur/i)).toBeInTheDocument();
  });

  it('shows an upcoming task with its priority badge', () => {
    const rawTask = { id: '1', title: 'Finish essay', dueDate: '2026-10-01', status: 'To Do' };
    useTasksContext.mockReturnValue({ tasks: [rawTask], isLoading: false, error: null });
    getUpcomingTasks.mockReturnValue([
      {
        ...rawTask,
        subject: 'English',
        priority: 'High',
        daysUntilDue: 1,
        parsedDateTime: new Date(),
      },
    ]);
    renderDashboard();
    expect(screen.getByText('Finish essay')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText(/due tomorrow/i)).toBeInTheDocument();
  });

  it('shows an error message when tasks fail to load', () => {
    useTasksContext.mockReturnValue({ tasks: [], isLoading: false, error: new Error('fail') });
    renderDashboard();
    expect(screen.getByText(/unable to load tasks/i)).toBeInTheDocument();
  });

  it('shows loading skeletons while tasks are loading', () => {
    useTasksContext.mockReturnValue({ tasks: [], isLoading: true, error: null });
    renderDashboard();
    expect(screen.queryByText(/no upcoming tasks/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/unable to load tasks/i)).not.toBeInTheDocument();
  });
});
