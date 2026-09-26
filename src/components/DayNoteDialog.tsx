import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';

interface DayNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  initialText?: string;
  onSubmit: (text: string) => void;
  onDelete?: () => void;
  isLoading?: boolean;
}

const DayNoteDialog = ({
  open,
  onOpenChange,
  date,
  initialText = '',
  onSubmit,
  onDelete,
  isLoading = false,
}: DayNoteDialogProps) => {
  const [text, setText] = useState(initialText);

  useEffect(() => {
    if (open) setText(initialText);
  }, [open, initialText]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] border-0 font-sans">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-[18px] font-semibold text-focus-text">{initialText ? 'Edit Note' : 'Add Note'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <Label htmlFor="day-note" className="text-[13px] font-medium text-focus-muted">{format(date, 'EEEE, MMMM d')}</Label>
            <Textarea
              id="day-note"
              className="min-h-11 rounded-[14px] border-0 bg-focus-surface text-[15px] text-focus-text placeholder:text-focus-muted/60 focus-visible:ring-2 focus-visible:ring-focus-lavender focus-visible:ring-offset-0"
              placeholder="e.g. Early dismissal at 1pm, dentist appointment, half day"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              autoFocus
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            {initialText && onDelete && (
              <Button
                type="button"
                variant="ghost"
                onClick={onDelete}
                disabled={isLoading}
                className="h-11 px-4 rounded-[14px] bg-transparent text-[14px] font-semibold text-focus-coral hover:bg-focus-coral/10 hover:text-focus-coral sm:mr-auto"
              >
                Delete
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              className="h-11 px-5 rounded-[14px] bg-focus-surface text-[14px] font-semibold text-focus-muted hover:bg-focus-raised hover:text-focus-muted"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" variant="ghost" disabled={isLoading || !text.trim()} className="h-11 px-5 rounded-[14px] bg-focus-lime text-[14px] font-semibold text-focus-bg hover:bg-focus-lime/90">
              {isLoading ? 'Saving…' : initialText ? 'Update Note' : 'Save Note'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default DayNoteDialog;
