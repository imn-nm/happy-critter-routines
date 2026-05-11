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
      <DialogContent className="sm:max-w-[440px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{initialText ? 'Edit Note' : 'Add Note'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <Label htmlFor="day-note">{format(date, 'EEEE, MMMM d')}</Label>
            <Textarea
              id="day-note"
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
                className="text-destructive hover:text-destructive mr-auto"
              >
                Delete
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !text.trim()}>
              {isLoading ? 'Saving...' : initialText ? 'Update' : 'Save Note'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default DayNoteDialog;
