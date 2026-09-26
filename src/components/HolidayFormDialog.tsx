import { useState, useLayoutEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Holiday } from '@/hooks/useHolidays';
import { format } from 'date-fns';

interface HolidayFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: HolidayFormData) => void;
  childId: string;
  initialDate?: Date;
  holiday?: Holiday;
  isLoading?: boolean;
}

export interface HolidayFormData {
  name: string;
  date: string;
  end_date: string | null;
  description: string;
  color: string;
  is_no_school: boolean;
}

const HolidayFormDialog = ({
  open,
  onOpenChange,
  onSubmit,
  childId,
  initialDate,
  holiday,
  isLoading = false,
}: HolidayFormDialogProps) => {
  const [formData, setFormData] = useState<HolidayFormData>({
    name: '',
    date: initialDate ? format(initialDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    end_date: null,
    description: '',
    color: '#FFA500',
    is_no_school: false,
  });

  // Start from scratch every time the form opens: closing it with the X, a
  // tap outside or a save used to leave the last holiday's name, end date
  // and "no school" in place for the next one. Before paint, so the old
  // values never flash.
  useLayoutEffect(() => {
    if (!open) return;
    if (holiday) {
      setFormData({
        name: holiday.name,
        date: holiday.date,
        end_date: holiday.end_date || null,
        description: holiday.description || '',
        color: holiday.color || '#FFA500',
        is_no_school: holiday.is_no_school,
      });
    } else {
      setFormData({
        name: '',
        date: format(initialDate ?? new Date(), 'yyyy-MM-dd'),
        end_date: null,
        description: '',
        color: '#FFA500',
        is_no_school: false,
      });
    }
  }, [open, holiday, initialDate]);

  const handleClose = () => {
    onOpenChange(false);
    // Reset form after close animation
    setTimeout(() => {
      setFormData({
        name: '',
        date: initialDate ? format(initialDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        end_date: null,
        description: '',
        color: '#FFA500',
        is_no_school: false,
      });
    }, 300);
  };

  const handleSubmitGuarded = (e: React.FormEvent) => {
    e.preventDefault();
    // Normalize: blank end date → null; reject end-before-start.
    const end = formData.end_date && formData.end_date >= formData.date ? formData.end_date : null;
    onSubmit({ ...formData, end_date: end });
  };

  const popularColors = [
    { name: 'Orange', value: '#FFA500' },
    { name: 'Red', value: '#EF4444' },
    { name: 'Blue', value: '#3B82F6' },
    { name: 'Green', value: '#10B981' },
    { name: 'Purple', value: '#A855F7' },
    { name: 'Pink', value: '#EC4899' },
    { name: 'Yellow', value: '#EAB308' },
    { name: 'Teal', value: '#14B8A6' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] border-0 font-sans">
        <form onSubmit={handleSubmitGuarded}>
          <DialogHeader>
            <DialogTitle className="text-[18px] font-semibold text-focus-text">
              {holiday ? 'Edit Holiday' : 'Add Holiday'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-[13px] font-medium text-focus-muted">Holiday Name *</Label>
              <Input
                id="name"
                className="min-h-11 rounded-[14px] border-0 bg-focus-surface text-[15px] text-focus-text placeholder:text-focus-muted/60 focus-visible:ring-2 focus-visible:ring-focus-lavender focus-visible:ring-offset-0"
                placeholder="e.g., Christmas, Birthday, Snow Day"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date" className="text-[13px] font-medium text-focus-muted">Date *</Label>
              <Input
                id="date"
                className="min-h-11 rounded-[14px] border-0 bg-focus-surface text-[15px] text-focus-text placeholder:text-focus-muted/60 focus-visible:ring-2 focus-visible:ring-focus-lavender focus-visible:ring-offset-0"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_date" className="text-[13px] font-medium text-focus-muted">End Date (Optional)</Label>
              <Input
                id="end_date"
                className="min-h-11 rounded-[14px] border-0 bg-focus-surface text-[15px] text-focus-text placeholder:text-focus-muted/60 focus-visible:ring-2 focus-visible:ring-focus-lavender focus-visible:ring-offset-0"
                type="date"
                value={formData.end_date || ''}
                min={formData.date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value || null })}
              />
              <p className="text-[12px] text-focus-muted">
                Leave blank for a single-day holiday. Use this to mark a window like a vacation week.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-[13px] font-medium text-focus-muted">Description (Optional)</Label>
              <Textarea
                id="description"
                className="min-h-11 rounded-[14px] border-0 bg-focus-surface text-[15px] text-focus-text placeholder:text-focus-muted/60 focus-visible:ring-2 focus-visible:ring-focus-lavender focus-visible:ring-offset-0"
                placeholder="Add notes about this holiday..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-focus-muted">Color</Label>
              <div className="flex items-start gap-2">
                <div className="flex flex-wrap gap-2">
                  {popularColors.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: color.value })}
                      aria-label={color.name}
                      aria-pressed={formData.color === color.value}
                      className={`w-11 h-11 rounded-full border-2 transition-all ${
                        formData.color === color.value
                          ? 'border-focus-text ring-2 ring-focus-lavender ring-offset-2 ring-offset-focus-sheet'
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
                <Input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  aria-label="Custom colour"
                  className="w-16 h-11 shrink-0 cursor-pointer rounded-[14px] border-0 bg-focus-surface p-1"
                />
              </div>
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="space-y-0.5">
                <Label htmlFor="no-school" className="text-[13px] font-medium text-focus-muted">No School Day</Label>
                <p className="text-[12px] text-focus-muted">
                  Mark this as a day off from school
                </p>
              </div>
              <Switch
                id="no-school"
                checked={formData.is_no_school}
                onCheckedChange={(checked) => setFormData({ ...formData, is_no_school: checked })}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="ghost"
              className="h-11 px-5 rounded-[14px] bg-focus-surface text-[14px] font-semibold text-focus-muted hover:bg-focus-raised hover:text-focus-muted"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" variant="ghost" disabled={isLoading} className="h-11 px-5 rounded-[14px] bg-focus-lime text-[14px] font-semibold text-focus-bg hover:bg-focus-lime/90">
              {isLoading ? 'Saving…' : holiday ? 'Update Holiday' : 'Add Holiday'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default HolidayFormDialog;
