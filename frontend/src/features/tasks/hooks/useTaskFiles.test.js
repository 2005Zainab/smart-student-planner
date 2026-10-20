// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("../../../shared/http-client", () => ({
  httpClient: vi.fn(),
}));

vi.mock("../api/getFiles", () => ({
  uploadTaskFile: vi.fn(),
  deleteTaskFile: vi.fn(),
  openTaskFile: vi.fn(),
}));

import { useTaskFiles } from "./useTaskFiles";

function stage(task, file) {
  const { result } = renderHook(() => useTaskFiles(task, vi.fn()));

  act(() => result.current.stageFiles([file]));

  return result.current;
}

describe("useTaskFiles stageFiles", () => {
  it("rejects a file that is already attached to the task", () => {
    const task = { id: "t1", files: [{ id: "f1", name: "notes.pdf", size: 3 }] };

    const { stagedFiles, errors } = stage(task, new File(["abc"], "notes.pdf"));

    expect(stagedFiles).toHaveLength(0);
    expect(errors[0]).toMatch(/already attached/i);
  });

  it("rejects a file when the task already has 5 files", () => {
    const files = [1, 2, 3, 4, 5].map(n => ({ id: `f${n}`, name: `file${n}.pdf`, size: n }));

    const { stagedFiles, errors } = stage({ id: "t1", files }, new File(["abc"], "new.pdf"));

    expect(stagedFiles).toHaveLength(0);
    expect(errors[0]).toMatch(/at most 5/i);
  });

  it("rejects a file type that isn't allowed", () => {
    const { stagedFiles, errors } = stage({ id: "t1", files: [] }, new File(["abc"], "notes.exe"));

    expect(stagedFiles).toHaveLength(0);
    expect(errors[0]).toMatch(/only PDF/i);
  });

  it("accepts a .txt file", () => {
    const { stagedFiles, errors } = stage({ id: "t1", files: [] }, new File(["abc"], "notes.txt"));

    expect(stagedFiles).toHaveLength(1);
    expect(errors).toHaveLength(0);
  });
});
