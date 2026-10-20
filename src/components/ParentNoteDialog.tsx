import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PARENT_NOTE_MAX } from "@/hooks/useParentNotes";
import { cn } from "@/lib/utils";

interface ParentNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Label over the note box, e.g. "Why? (optional)". */
  noteLabel: string;
  placeholder?: string;
  confirmLabel: string;
  /** Extra controls above the note, e.g. how many stars. */
  children?: ReactNode;
  /** Lift above a sheet that sits over the usual dialog layer (the Alerts panel). */
  raised?: boolean;
  /** Gets the trimmed note ('' when left blank). The dialog closes after. */
  onConfirm: (note: string) => void | Promise<void>;
}

/**
 * A parent's yes/no step with an optional note for the child: why stars were
 * given, or why a reward ask was a no. The child sees the note once.
 */
const ParentNoteDialog = ({ open, onOpenChange, title, description, noteLabel, placeholder, confirmLabel, children, raised, onConfirm }: ParentNoteDialogProps) => {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  // Each opening starts blank.
  useEffect(() => {
    if (open) setNote("");
  }, [open]);

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm(note.trim());
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={o => !busy && onOpenChange(o)}>
      <AlertDialogContent className={cn("max-w-[90vw] sm:max-w-lg", raised && "z-[90]")} overlayClassName={raised ? "z-[85]" : undefined}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        {children}
        <div className="flex flex-col gap-2">
          <Label htmlFor="parent-note">{noteLabel}</Label>
          <Textarea
            id="parent-note"
            value={note}
            onChange={e => setNote(e.target.value.slice(0, PARENT_NOTE_MAX))}
            placeholder={placeholder}
            maxLength={PARENT_NOTE_MAX}
            rows={3}
          />
          <p className="text-12 text-focus-muted text-right" aria-live="polite">
            {note.length}/{PARENT_NOTE_MAX}
          </p>
        </div>
        <AlertDialogFooter className="flex-col sm:flex-row gap-sp-2">
          <AlertDialogCancel asChild>
            <Button type="button" variant="secondary" size="md" disabled={busy}>Cancel</Button>
          </AlertDialogCancel>
          <Button type="button" variant="primary" size="md" disabled={busy} onClick={confirm}>
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ParentNoteDialog;
