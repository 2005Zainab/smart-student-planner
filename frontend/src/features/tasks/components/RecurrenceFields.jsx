import { format } from "date-fns";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function RecurrenceFields({
  recurrence,
  dueDate,
  onChange,
  onRuleChange,
  showReminder = true,
  readOnly = false,
}) {
  if (!recurrence) return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="recurrence-type">Repeat type</Label>
          <Select
            disabled={readOnly}
            value={recurrence.rule.type}
            onValueChange={type => {
              if (type === "daily") {
                onRuleChange({ type, interval: 1 });
              } else if (type === "weekly") {
                onRuleChange({
                  type,
                  interval: 1,
                  weekdays: [recurrence.defaultWeekday],
                });
              } else {
                onRuleChange({
                  type,
                  interval: 1,
                  monthDay: dueDate instanceof Date ? dueDate.getDate() : 1,
                });
              }
            }}
          >
            <SelectTrigger id="recurrence-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="recurrence-interval">Every</Label>
          <Input
            disabled={readOnly}
            id="recurrence-interval"
            min="1"
            max="30"
            onChange={event =>
              onRuleChange({
                ...recurrence.rule,
                interval: Number(event.target.value),
              })
            }
            type="number"
            value={recurrence.rule.interval}
          />
        </div>
      </div>
      {recurrence.rule.type === "weekly" && (
        <div className="space-y-2">
          <Label>Weekdays</Label>
          <div className="flex flex-wrap gap-2">
            {[
              [1, "Mon"],
              [2, "Tue"],
              [3, "Wed"],
              [4, "Thu"],
              [5, "Fri"],
              [6, "Sat"],
              [7, "Sun"],
            ].map(([day, label]) => {
              const selected = recurrence.rule.weekdays.includes(day);
              return (
                <Button
                  key={day}
                  disabled={readOnly}
                  onClick={() => {
                    if (selected && recurrence.rule.weekdays.length === 1) return;
                    onRuleChange({
                      ...recurrence.rule,
                      weekdays: selected
                        ? recurrence.rule.weekdays.filter(value => value !== day)
                        : [...recurrence.rule.weekdays, day].sort((a, b) => a - b),
                    });
                  }}
                  type="button"
                  variant={selected ? "default" : "outline"}
                >
                  {label}
                </Button>
              );
            })}
          </div>
        </div>
      )}
      {recurrence.rule.type === "monthly" && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="recurrence-month-day">Day of month</Label>
            <Input
              disabled={readOnly || recurrence.rule.useLastDayOfMonth === true}
              id="recurrence-month-day"
              max="31"
              min="1"
              onChange={event =>
                onRuleChange({
                  type: "monthly",
                  interval: recurrence.rule.interval,
                  monthDay: Number(event.target.value),
                })
              }
              type="number"
              value={recurrence.rule.monthDay || ""}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={recurrence.rule.useLastDayOfMonth === true}
              disabled={readOnly}
              id="recurrence-last-day"
              onCheckedChange={checked =>
                onRuleChange(
                  checked
                    ? {
                        type: "monthly",
                        interval: recurrence.rule.interval,
                        useLastDayOfMonth: true,
                      }
                    : {
                        type: "monthly",
                        interval: recurrence.rule.interval,
                        monthDay: dueDate instanceof Date ? dueDate.getDate() : 1,
                      },
                )
              }
            />
            <Label htmlFor="recurrence-last-day">Use last day of month</Label>
          </div>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="recurrence-end-date">End date</Label>
        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  className="flex-1 justify-start font-normal"
                  disabled={readOnly}
                  id="recurrence-end-date"
                  type="button"
                  variant="outline"
                />
              }
            >
              <CalendarDays />
              {recurrence.endDate ? format(recurrence.endDate, "PPP") : "Never"}
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                onSelect={endDate => onChange({ endDate })}
                selected={recurrence.endDate || undefined}
              />
            </PopoverContent>
          </Popover>
          {recurrence.endDate && !readOnly && (
            <Button onClick={() => onChange({ endDate: null })} type="button" variant="outline">
              Never
            </Button>
          )}
        </div>
      </div>
      {showReminder && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="recurrence-reminder-offset">Remind me days before</Label>
            <Input
              disabled={readOnly}
              id="recurrence-reminder-offset"
              min="0"
              onChange={event =>
                onChange({
                  reminderOffsetDays: event.target.value === "" ? null : Number(event.target.value),
                })
              }
              type="number"
              value={recurrence.reminderOffsetDays ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="recurrence-reminder-time">At</Label>
            <Input
              disabled={readOnly}
              id="recurrence-reminder-time"
              onChange={event => onChange({ reminderTime: event.target.value })}
              type="time"
              value={recurrence.reminderTime || ""}
            />
          </div>
        </div>
      )}
      {!readOnly && (
        <p className="text-sm text-muted-foreground">
          Applies from {dueDate == null ? "(selected due date)" : format(dueDate, "PPP")}
        </p>
      )}
    </div>
  );
}

export { RecurrenceFields };
