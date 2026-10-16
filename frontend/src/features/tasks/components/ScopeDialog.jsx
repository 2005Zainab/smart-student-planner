import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function ScopeDialog({
  open,
  onOpenChange,
  onChoose,
  title = "Apply changes to",
  description = "Choose whether these content changes should apply only to this occurrence or to future occurrences in the series.",
  occurrenceLabel = "This occurrence only",
  seriesLabel = "Apply to future occurrences",
  seriesScope = "future", // value passed to onChoose for the series option
  seriesDisabled = false,
  destructive = false, // styles the series option
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="flex-col-reverse sm:flex-col-reverse">
          <AlertDialogCancel className="w-full">Cancel</AlertDialogCancel>

          <Button
            className="w-full"
            type="button"
            variant="outline"
            onClick={() => onChoose("occurrence")}
          >
            {occurrenceLabel}
          </Button>

          <AlertDialogAction
            className={`w-full ${
              destructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : ""
            }`}
            disabled={seriesDisabled}
            onClick={event => {
              event.preventDefault();
              onChoose(seriesScope);
            }}
          >
            {seriesLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export { ScopeDialog };
