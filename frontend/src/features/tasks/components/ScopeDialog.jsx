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

function ScopeDialog({ open, onOpenChange, onChoose }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Apply changes to</AlertDialogTitle>
          <AlertDialogDescription>
            Choose whether these content changes should apply only to this occurrence or to future
            occurrences in the series.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="flex-col-reverse sm:flex-col-reverse">
          <AlertDialogCancel className="w-full">Cancel</AlertDialogCancel>

          <Button
            className="w-full"
            type="button"
            variant="outline"
            onClick={() => onChoose("occurrence")}
          >
            This occurrence only
          </Button>

          <AlertDialogAction
            className="w-full"
            onClick={event => {
              event.preventDefault();
              onChoose("future");
            }}
          >
            Apply to future occurrences
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export { ScopeDialog };
