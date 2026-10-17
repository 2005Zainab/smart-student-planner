import { useRef, useState } from "react";
import { FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ACCEPTED_EXTENSIONS, MAX_FILES_PER_TASK } from "../hooks/useTaskFiles";

const formatSize = bytes => (bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 1024)} KB`);

// The "Files" card in the task form
// Kept separate from the task form itself because it has its own state (staged files, errors, busy) and is a bit more complex than the other fields.
function TaskFilesCard({ taskFiles, readOnly = false }) {
  const {
    files,
    stagedFiles,
    errors,
    isBusy,
    canAttach,
    stageFiles,
    unstageFile,
    uploadStaged,
    removeFile,
    openFile,
  } = taskFiles;

  const inputRef = useRef(null);
  const [filesToggle, setFilesToggle] = useState(null);
  const showFiles = filesToggle ?? (readOnly && files.length > 0);

  const handlePick = event => {
    stageFiles(Array.from(event.target.files));
    // Clear the picker so choosing the same file again still counts as a change
    event.target.value = "";
  };

  return (
    <div className="space-y-2 rounded-md border p-4">
      {/* Header: tick to show or hide the files, the counter stays visible */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={showFiles}
            id="task-files"
            onCheckedChange={checked => setFilesToggle(Boolean(checked))}
          />
          <Label htmlFor="task-files">Files</Label>
        </div>
        {files.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {files.length} of {MAX_FILES_PER_TASK} files
          </span>
        )}
      </div>

      {showFiles && (
        <>
          {/* Files already uploaded: click a name to open it in a new tab */}
          {files.map(file => (
            <div
              key={file.id}
              className="flex items-center justify-between gap-2 min-w-0 p-1.5 rounded-md hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <button
                  type="button"
                  className="min-w-0 truncate text-left text-sm hover:underline cursor-pointer"
                  title={file.name}
                  onClick={() => openFile(file)}
                >
                  {file.name}
                </button>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatSize(file.size)}
                </span>
              </div>
              {!readOnly && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="cursor-pointer"
                  aria-label={`Remove ${file.name}`}
                  disabled={isBusy}
                  onClick={() => removeFile(file)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}

          {files.length === 0 && stagedFiles.length === 0 && canAttach && (
            <p className="text-sm text-muted-foreground">No files yet.</p>
          )}

          {!readOnly && !canAttach && (
            <p className="text-sm text-muted-foreground">Save the task first, then add files.</p>
          )}

          {/* Chosen but not uploaded yet */}
          {stagedFiles.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Ready to upload</p>
              {stagedFiles.map(file => (
                <div
                  key={`${file.name}-${file.size}`}
                  className="flex items-center justify-between gap-2 min-w-0 p-1.5 rounded-md bg-muted/50"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 truncate text-sm" title={file.name}>
                      {file.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatSize(file.size)}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className="cursor-pointer"
                    aria-label={`Don't upload ${file.name}`}
                    disabled={isBusy}
                    onClick={() => unstageFile(file)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {!readOnly && canAttach && (
            <div className="flex flex-wrap gap-2">
              <input
                ref={inputRef}
                type="file"
                multiple
                accept={ACCEPTED_EXTENSIONS.join(",")}
                className="hidden"
                onChange={handlePick}
              />
              <Button
                type="button"
                variant="outline"
                disabled={isBusy}
                onClick={() => inputRef.current?.click()}
              >
                Add file
              </Button>
              {stagedFiles.length > 0 && (
                <Button type="button" disabled={isBusy} onClick={() => uploadStaged()}>
                  {isBusy ? "Uploading..." : "Upload"}
                </Button>
              )}
            </div>
          )}

          {errors.map(message => (
            <p key={message} className="text-sm text-medium-priority">
              {message}
            </p>
          ))}
        </>
      )}
    </div>
  );
}

export { TaskFilesCard };
