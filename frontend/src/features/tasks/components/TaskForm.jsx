import { format } from "date-fns";
import { CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Textarea } from "@/components/ui/textarea";
import { httpClient } from "../../../shared/http-client";

function TaskForm({
  draft,
  setDraft,
  onSave,
  onCancel,
  titleError,
  saveError,
  readOnly = false,
  requireDateAndTime = false,
}) {
  const [dateError, setDateError] = useState("");
  const [reminderError, setReminderError] = useState("");

  //Store the labels that belong to the user
  const [labels, setLabels] = useState([]);

  //Used when the user creates a new label
  const [newLabel, setNewLabel] = useState("");
  const [labelError, setLabelError] = useState("");

  //Load saved labels from the backend
  useEffect(() => {
    const loadLabels = async () => {
      try {
        const savedLabels = await httpClient(
          "http://localhost:3000/api/labels",
        );

        setLabels(savedLabels);
      } catch (err) {
        console.log(err);
      }
    };

    loadLabels();
  }, []);

  //Create a new reusable label
  const createLabel = async () => {
    setLabelError("");

    if (!newLabel.trim()) {
      setLabelError("Label cannot be empty");
      return;
    }

    try {
      const savedLabel = await httpClient(
        "http://localhost:3000/api/labels",
        {
          method: "POST",
          body: JSON.stringify({
            name: newLabel,
          }),
        },
      );

      //Add the new label to the dropdown
      setLabels((current) => [
        ...current,
        savedLabel,
      ]);

      //Select the new label for this task
      setDraft((prev) => ({
        ...prev,
        label: savedLabel.name,
      }));

      setNewLabel("");
    } catch (err) {
      console.log(err);

      setLabelError(
        err.message || "Failed to create label",
      );
    }
  };

  const handleSave = (event) => {
    event.preventDefault();

    setDateError("");

    if (requireDateAndTime && !draft.dueDate) {
      setDateError(
        "Due date is required for adding task to schedule.",
      );
      return;
    }

    setReminderError("");

    const hasReminderDate = Boolean(
      draft.reminderDate,
    );
    const hasReminderTime = Boolean(
      draft.reminderTime,
    );

    if (hasReminderDate !== hasReminderTime) {
      setReminderError(
        "Date and time is required to set a reminder.",
      );
      return;
    }

    //Check reminder is not in the past
    if (hasReminderDate && hasReminderTime) {
      const reminderDateOnly =
        draft.reminderDate instanceof Date
          ? format(
              draft.reminderDate,
              "yyyy-MM-dd",
            )
          : draft.reminderDate;

      const reminderDateTime = new Date(
        `${reminderDateOnly}T${draft.reminderTime}:00`,
      );

      if (reminderDateTime <= new Date()) {
        setReminderError(
          "Reminders cannot be set in the past.",
        );
        return;
      }
    }

    onSave();
  };

  return (
    <form
      className="space-y-4"
      onSubmit={handleSave}
    >
      <div className="space-y-2">
        <Label htmlFor="task-title">
          Task name
        </Label>

        <Input
          id="task-title"
          onChange={(event) =>
            setDraft((prev) => ({
              ...prev,
              title: event.target.value,
            }))
          }
          disabled={readOnly}
          maxLength={200}
          value={draft.title || ""}
        />

        {(draft.title?.length || 0) >= 200 && (
          <p className="text-sm text-medium-priority">
            Title cannot be more than 200 characters
          </p>
        )}

        {titleError && (
          <p className="text-sm text-destructive">
            {titleError}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="task-description">
          Description
        </Label>

        <Textarea
          id="task-description"
          onChange={(event) =>
            setDraft((prev) => ({
              ...prev,
              description: event.target.value,
            }))
          }
          maxLength={1000}
          disabled={readOnly}
          value={draft.description || ""}
        />

        {(draft.description?.length || 0) >=
          1000 && (
          <p className="text-sm text-medium-priority">
            Description cannot be more than 1000 characters
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="task-subject">
            Subject
          </Label>

          <Input
            id="task-subject"
            onChange={(event) =>
              setDraft((prev) => ({
                ...prev,
                subject: event.target.value,
              }))
            }
            maxLength={200}
            disabled={readOnly}
            required
            value={draft.subject || ""}
          />

          {(draft.subject?.length || 0) >=
            200 && (
            <p className="text-sm text-medium-priority">
              Subject cannot be more than 200 characters
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="task-label">
            Label
          </Label>

          <Select
            disabled={readOnly}
            value={draft.label || ""}
            onValueChange={(label) =>
              setDraft((prev) => ({
                ...prev,
                label,
              }))
            }
          >
            <SelectTrigger
              className="w-full"
              id="task-label"
            >
              <SelectValue placeholder="Choose a label" />
            </SelectTrigger>

            <SelectContent>
              {labels.map((label) => (
                <SelectItem
                  key={label.id}
                  value={label.name}
                >
                  {label.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {!readOnly && (
            <div className="flex gap-2">
              <Input
                value={newLabel}
                onChange={(event) =>
                  setNewLabel(
                    event.target.value,
                  )
                }
                maxLength={100}
                placeholder="Create new label"
              />

              <Button
                type="button"
                variant="outline"
                onClick={createLabel}
              >
                Add
              </Button>
            </div>
          )}

          {labelError && (
            <p className="text-sm text-destructive">
              {labelError}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <Label>Priority</Label>

        <p className="text-sm text-muted-foreground">
          Priority is automatically calculated from the due date.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="task-due-date">
            Due date{" "}
            {requireDateAndTime && (
              <span className="text-destructive">
                *
              </span>
            )}
          </Label>

          <Popover>
            <PopoverTrigger
              render={
                <Button
                  className={`w-full justify-start font-normal ${
                    dateError
                      ? "border-destructive"
                      : ""
                  }`}
                  disabled={readOnly}
                  id="task-due-date"
                  type="button"
                  variant="outline"
                />
              }
            >
              <CalendarDays />

              {draft.dueDate
                ? format(
                    draft.dueDate,
                    "PPP",
                  )
                : "Choose a date"}
            </PopoverTrigger>

            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                onSelect={(dueDate) => {
                  setDraft((prev) => ({
                    ...prev,
                    dueDate,
                  }));

                  if (dueDate) {
                    setDateError("");
                  }
                }}
                selected={draft.dueDate}
              />
            </PopoverContent>
          </Popover>

          {dateError && (
            <p className="text-sm text-destructive">
              {dateError}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="task-time">
            Time{" "}
            {requireDateAndTime && (
              <span className="text-destructive">
                *
              </span>
            )}
          </Label>

          <Input
            id="task-time"
            type="time"
            required={requireDateAndTime}
            onChange={(event) =>
              setDraft((prev) => ({
                ...prev,
                time: event.target.value,
              }))
            }
            disabled={readOnly}
            value={draft.time || ""}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="task-status">
            Status
          </Label>

          <Select
            disabled={readOnly}
            onValueChange={(status) =>
              setDraft((prev) => ({
                ...prev,
                status,
              }))
            }
            value={draft.status || "To Do"}
          >
            <SelectTrigger
              aria-label="Status"
              className="w-full"
              id="task-status"
            >
              <SelectValue />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="To Do">
                To Do
              </SelectItem>

              <SelectItem value="In Progress">
                In Progress
              </SelectItem>

              <SelectItem value="Completed">
                Completed
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="task-reminder-date">
            Reminder date
          </Label>

          <Popover>
            <PopoverTrigger
              render={
                <Button
                  className="w-full justify-start font-normal"
                  disabled={readOnly}
                  id="task-reminder-date"
                  type="button"
                  variant="outline"
                />
              }
            >
              <CalendarDays />

              {draft.reminderDate
                ? format(
                    draft.reminderDate,
                    "PPP",
                  )
                : "Choose a date"}
            </PopoverTrigger>

            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                onSelect={(reminderDate) =>
                  setDraft((prev) => ({
                    ...prev,
                    reminderDate,
                  }))
                }
                selected={
                  draft.reminderDate
                }
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label htmlFor="task-reminder-time">
            Reminder time
          </Label>

          <Input
            id="task-reminder-time"
            type="time"
            onChange={(event) =>
              setDraft((prev) => ({
                ...prev,
                reminderTime:
                  event.target.value,
              }))
            }
            disabled={readOnly}
            value={
              draft.reminderTime || ""
            }
          />
        </div>

        {typeof Notification !==
          "undefined" &&
          Notification.permission ===
            "denied" && (
            <p className="text-sm text-muted-foreground">
              Notifications are blocked in
              your browser: reminders won't
              show a popup.
            </p>
          )}

        {reminderError && (
          <p className="text-sm text-destructive">
            {reminderError}
          </p>
        )}
      </div>

      {saveError && (
        <p className="text-sm text-destructive">
          {saveError}
        </p>
      )}

      {!readOnly && (
        <div className="flex justify-end gap-2">
          <Button
            onClick={onCancel}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>

          <Button type="submit">
            Save task
          </Button>
        </div>
      )}
    </form>
  );
}

export { TaskForm };