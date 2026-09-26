import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import TimeSelect from '@/components/TimeSelect';
import { ParentEvent } from '@/hooks/useParentEvents';
import { format } from 'date-fns';

interface ParentEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ParentEventFormData) => void;
  initialDate?: Date;
  /** When set, the dialog edits this event instead of creating a new one. */
  event?: ParentEvent | null;
  isLoading?: boolean;
}

export interface ParentEventFormData {
  title: string;
  date: string;
  /** null = all-day / no specific time */
  time: string | null;
  notes: string | null;
}

// Parent-only appointments (teacher conference, doctor visit). These never
// appear in the child's view — they're reminders for the parent, not tasks.
const ParentEventDialog = ({
  open,
  onOpenChange,
  onSubmit,
  initialDate,
  event,
  isLoading = false,
}: ParentEventDialogProps) => {
  const emptyForm = (): ParentEventFormData => ({
    title: '',
    date: initialDate ? format(initialDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    time: null,
    notes: null,
  });

  const [formData, setFormData] = useState<ParentEventFormData>(emptyForm());

  useEffect(() => {
    if (event) {
      setFormData({
        title: event.title,
        date: event.date,
        time: event.time ? event.time.slice(0, 5) : null,
        notes: event.notes || null,
      });
    } else {
      setFormData(emptyForm());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, initialDate, open]);

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleSubmitGuarded = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      title: formData.title.trim(),
      notes: formData.notes?.trim() || null,
    });
  };

  const hasTime = formData.time != null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] border-0 font-sans">
        <form onSubmit={handleSubmitGuarded}>
          <DialogHeader>
            <DialogTitle className="text-[18px] font-semibold text-focus-text">{event ? 'Edit Event' : 'Add Event'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="event-title" className="text-[13px] font-medium text-focus-muted">Title *</Label>
              <Input
                id="event-title"
                className="min-h-11 rounded-[14px] border-0 bg-focus-surface text-[15px] text-focus-text placeholder:text-focus-muted/60 focus-visible:ring-2 focus-visible:ring-focus-lavender focus-visible:ring-offset-0"
                placeholder="e.g. Parent-teacher conference, Dentist"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-date" className="text-[13px] font-medium text-focus-muted">Date *</Label>
              <Input
                id="event-date"
                className="min-h-11 rounded-[14px] border-0 bg-focus-surface text-[15px] text-focus-text placeholder:text-focus-muted/60 focus-visible:ring-2 focus-visible:ring-focus-lavender focus-visible:ring-offset-0"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex min-h-11 items-center justify-between">
                <Label htmlFor="event-has-time" className="text-[13px] font-medium text-focus-muted">Set a Time</Label>
                <Switch
                  id="event-has-time"
                  checked={hasTime}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, time: checked ? '15:00' : null })
                  }
                />
              </div>
              {hasTime ? (
                <TimeSelect
                  value={formData.time || '15:00'}
                  onChange={(v) => setFormData({ ...formData, time: v })}
                />
              ) : (
                <p className="text-[12px] text-focus-muted">All day — no specific time.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-notes" className="text-[13px] font-medium text-focus-muted">Notes (Optional)</Label>
              <Textarea
                id="event-notes"
                className="min-h-11 rounded-[14px] border-0 bg-focus-surface text-[15px] text-focus-text placeholder:text-focus-muted/60 focus-visible:ring-2 focus-visible:ring-focus-lavender focus-visible:ring-offset-0"
                placeholder="e.g. Room 12, bring the report card"
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value || null })}
                rows={2}
              />
            </div>

            <p className="text-[12px] text-focus-muted">
              Only you see this — it never shows up on your child's schedule.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="ghost" onClick={handleClose} disabled={isLoading} className="h-11 px-5 rounded-[14px] bg-focus-surface text-[14px] font-semibold text-focus-muted hover:bg-focus-raised hover:text-focus-muted">
              Cancel
            </Button>
            <Button type="submit" variant="ghost" disabled={isLoading} className="h-11 px-5 rounded-[14px] bg-focus-lime text-[14px] font-semibold text-focus-bg hover:bg-focus-lime/90">
              {isLoading ? 'Saving…' : event ? 'Update Event' : 'Add Event'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ParentEventDialog;
