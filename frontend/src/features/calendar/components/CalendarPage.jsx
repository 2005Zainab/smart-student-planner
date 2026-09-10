import { useState } from "react";

function CalendarPage() {
  const [calendarItem, setCalendarItem] = useState({
    id: 1,
    title: "COMP602 Study Session",
    date: "2026-09-15",
    time: "10:00",
  });

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(calendarItem);

  function startEditing() {
    setDraft(calendarItem);
    setIsEditing(true);
  }

  function saveChanges() {
    setCalendarItem(draft);
    setIsEditing(false);
  }

  return (
    <main className="flex-1 space-y-6 p-4 md:p-6">
      <div>
        <h2 className="text-2xl font-semibold">Calendar</h2>
        <p className="mt-1 text-muted-foreground">
          View and manage your study schedule.
        </p>
      </div>

      <div className="rounded-lg border p-4">
        {!isEditing ? (
          <>
            <h3 className="font-semibold">{calendarItem.title}</h3>
            <p>Date: {calendarItem.date}</p>
            <p>Time: {calendarItem.time}</p>

            <button
              className="mt-4 rounded bg-black px-4 py-2 text-white"
              onClick={startEditing}
            >
              Edit
            </button>
          </>
        ) : (
          <div className="space-y-3">
            <input
              className="w-full rounded border p-2"
              value={draft.title}
              onChange={(event) =>
                setDraft({ ...draft, title: event.target.value })
              }
            />

            <input
              className="w-full rounded border p-2"
              type="date"
              value={draft.date}
              onChange={(event) =>
                setDraft({ ...draft, date: event.target.value })
              }
            />

            <input
              className="w-full rounded border p-2"
              type="time"
              value={draft.time}
              onChange={(event) =>
                setDraft({ ...draft, time: event.target.value })
              }
            />

            <button
              className="rounded bg-black px-4 py-2 text-white"
              onClick={saveChanges}
            >
              Save changes
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

export { CalendarPage };
