import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, LogOut, Mail, Lock, User, Check, X, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useChildren, type Child } from "@/hooks/useChildren";
import PetAvatar from "@/components/PetAvatar";
import CritterPicker from "@/components/critters/CritterPicker";
import { getPet, type PetId } from "@/components/pets/petCatalog";
import HouseholdSettings from "@/components/HouseholdSettings";
import ParentPinSettings from "@/components/ParentPinSettings";
import CalendarConnect from "@/components/CalendarConnect";
import { Switch } from "@/components/ui/switch";
import { soundsEnabled, setSoundsEnabled } from "@/lib/sounds";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { EditButton } from "@/components/IconActionButtons";

/**
 * Parent account settings.
 *
 * - Name + email are inline-editable (pencil → save/cancel).
 * - Password updates via supabase.auth.updateUser.
 * - Children list shows everyone with an "Edit" link that opens a dialog
 *   to change name / age / pet type. No destructive controls here —
 *   profile deletion is handled from the child dashboard.
 */
const ParentSettings = () => {
  const navigate = useNavigate();
  const [soundsOn, setSoundsOn] = useState(() => soundsEnabled());
  const { user, signOut } = useAuth();
  const { children, updateChild } = useChildren();

  const fullName = (user?.user_metadata?.full_name as string | undefined) ?? "";
  const email = user?.email ?? "";

  const [editingChild, setEditingChild] = useState<Child | null>(null);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  return (
    <div className="min-h-dvh pb-sp-8">
      <div className="max-w-[420px] mx-auto flex flex-col gap-sp-4">
        {/* Header */}
        <header className="flex items-center justify-between gap-sp-3 px-sp-4 pt-sp-5">
          <button
            type="button"
            onClick={() => navigate("/parent")}
            aria-label="Back"
            className="shrink-0 w-11 h-11 rounded-[14px] bg-focus-surface flex items-center justify-center text-focus-muted hover:bg-focus-raised hover:text-focus-text transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-20 font-bold text-focus-text leading-none">Settings</h1>
          <div className="w-11 h-11" />
        </header>

        {/* Account */}
        <section className="mx-sp-4 rounded-[24px] bg-focus-surface p-sp-4 flex flex-col gap-sp-3">
          <h2 className="text-14 font-semibold text-focus-text">Account</h2>

          <EditableRow
            icon={<User className="w-4 h-4 text-focus-lavender" />}
            label="Name"
            value={fullName}
            placeholder="Your name"
            onSave={async (next) => {
              const { error } = await supabase.auth.updateUser({ data: { full_name: next } });
              if (error) throw error;
            }}
          />
          <EditableRow
            icon={<Mail className="w-4 h-4 text-focus-lavender" />}
            label="Email"
            value={email}
            placeholder="you@example.com"
            type="email"
            helper="A confirmation email may be sent before the change takes effect."
            onSave={async (next) => {
              const { error } = await supabase.auth.updateUser({ email: next });
              if (error) throw error;
            }}
          />

          <PasswordChange />

          {/* Onboarding is dismissed for good once seen — this is the only
              way back to it. Clearing the flag makes the dashboard show it
              on the next visit. */}
          <button
            type="button"
            onClick={() => {
              try {
                if (user?.id) window.localStorage.removeItem(`onboarding_seen:${user.id}`);
              } catch {
                /* ignore storage errors */
              }
              navigate("/parent");
            }}
            className="tap-target self-start flex items-center gap-2 min-h-11 text-14 text-focus-lavender hover:underline"
          >
            <PlayCircle className="w-4 h-4" />
            Replay Welcome Tour
          </button>

          <button
            type="button"
            onClick={() => setConfirmSignOut(true)}
            className="tap-target self-start flex items-center gap-2 min-h-11 text-14 text-focus-coral hover:underline"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </section>

        <Dialog open={confirmSignOut} onOpenChange={setConfirmSignOut}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Sign Out of This Device?</DialogTitle>
            </DialogHeader>
            <p className="text-14 text-focus-muted">
              Your child's screen and your other devices stay signed in.
            </p>
            <DialogFooter className="gap-sp-2 pt-sp-2">
              <Button type="button" variant="secondary" onClick={() => setConfirmSignOut(false)}>Cancel</Button>
              <Button type="button" variant="destructive" onClick={async () => { await signOut(); navigate("/"); }}>Sign Out</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Sounds — per device, so set it on the child's screen itself. */}
        <section className="mx-sp-4 rounded-[24px] bg-focus-surface p-sp-4 flex flex-col gap-sp-2">
          <div className="flex items-center justify-between gap-sp-3">
            <div>
              <h2 className="text-14 font-semibold text-focus-text">Sounds on This Device</h2>
              <p className="text-12 text-focus-muted">Soft chimes when a task starts, is done, or a reward is approved. Saved on this device only.</p>
            </div>
            <Switch checked={soundsOn} onCheckedChange={(v) => { setSoundsOn(v); setSoundsEnabled(v); }} aria-label="Sounds on this device" />
          </div>
        </section>

        <HouseholdSettings />

        <ParentPinSettings />
        <CalendarConnect />

        {/* Children */}
        <section className="mx-sp-4 rounded-[24px] bg-focus-surface p-sp-4 flex flex-col gap-sp-3">
          <div className="flex items-center justify-between">
            <h2 className="text-14 font-semibold text-focus-text">Children</h2>
            <Button size="sm" onClick={() => navigate("/setup")} className="gap-1.5">
              <Plus className="w-4 h-4" />
              Add Child
            </Button>
          </div>

          {children.length === 0 ? (
            <p className="text-14 text-focus-muted">
              No children yet. Add one to start tracking routines.
            </p>
          ) : (
            <ul className="flex flex-col gap-sp-2">
              {children.map(child => (
                <li
                  key={child.id}
                  className="flex items-center gap-sp-3 p-sp-3 rounded-[20px] bg-focus-bg/60"
                >
                  <div className="shrink-0 w-12 h-12 rounded-[20px] bg-focus-sunken flex items-center justify-center overflow-hidden">
                    <PetAvatar petType={child.petType} happiness={child.petHappiness} outfit={child.pet_outfit} size="sm" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-16 font-semibold text-focus-text truncate">{child.name}</p>
                    <p className="text-12 text-focus-muted truncate">
                      {child.age ? `Age ${child.age} · ` : ""}{getPet(child.petType).name}
                    </p>
                  </div>
                  <EditButton onClick={() => setEditingChild(child)} label={`Edit ${child.name}`} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <EditChildDialog
        child={editingChild}
        onClose={() => setEditingChild(null)}
        onSave={async (updates) => {
          if (!editingChild) return;
          await updateChild(editingChild.id, updates);
          setEditingChild(null);
        }}
      />
    </div>
  );
};

/** Inline-editable row — pencil to enter edit mode, check/x to save/cancel. */
function EditableRow({
  icon,
  label,
  value,
  placeholder,
  type = "text",
  helper,
  onSave,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  placeholder?: string;
  type?: string;
  helper?: string;
  onSave: (next: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Reset draft when we open the editor or the underlying value changes.
  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);

  const cancel = () => {
    setEditing(false);
    setDraft(value);
    setMsg(null);
  };

  const save = async () => {
    if (draft === value) { setEditing(false); return; }
    setBusy(true);
    setMsg(null);
    try {
      await onSave(draft);
      setEditing(false);
      setMsg({
        kind: "ok",
        text: type === "email" ? "Check your inbox to confirm the change." : "Saved.",
      });
    } catch (e: any) {
      setMsg({ kind: "err", text: e?.message ?? "Failed to save." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-sp-3 p-sp-3 rounded-[20px] bg-focus-bg/60">
        <div className="shrink-0 w-8 h-8 rounded-[10px] bg-focus-raised flex items-center justify-center">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-12 text-focus-muted">{label}</p>
          {editing ? (
            <Input
              autoFocus
              type={type}
              value={draft}
              placeholder={placeholder}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
              className="h-11 px-3 mt-1"
            />
          ) : (
            <p className="text-14 text-focus-text truncate">{value || "—"}</p>
          )}
        </div>
        {editing ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={save}
              disabled={busy}
              aria-label="Save"
              className={cn(
                "shrink-0 w-11 h-11 rounded-[14px] flex items-center justify-center",
                "bg-focus-mint/15 text-focus-mint hover:bg-focus-mint/25",
              )}
            >
              <Check className="w-4 h-4" strokeWidth={3} />
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={busy}
              aria-label="Cancel"
              className="shrink-0 w-11 h-11 rounded-[14px] flex items-center justify-center bg-focus-raised text-focus-muted hover:text-focus-text"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <EditButton onClick={() => setEditing(true)} label={`Edit ${label}`} />
        )}
      </div>
      {editing && helper && <p className="text-12 text-focus-muted px-1">{helper}</p>}
      {msg && (
        <p className={cn("text-12 px-1", msg.kind === "ok" ? "text-focus-mint" : "text-focus-coral")}>
          {msg.text}
        </p>
      )}
    </div>
  );
}

function PasswordChange() {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 6) {
      setMsg({ kind: "err", text: "Password must be at least 6 characters." });
      return;
    }
    setBusy(true); setMsg(null);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) setMsg({ kind: "err", text: error.message });
    else { setPw(""); setMsg({ kind: "ok", text: "Password updated." }); }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-sp-2 pt-sp-2 border-t border-focus-raised">
      <Label htmlFor="new-pw" className="text-12 text-focus-muted flex items-center gap-1.5">
        <Lock className="w-3.5 h-3.5" /> Change Password
      </Label>
      <div className="flex items-center gap-sp-2">
        <Input
          id="new-pw"
          type="password"
          value={pw}
          onChange={e => setPw(e.target.value)}
          placeholder="New password (6+ chars)"
        />
        <Button type="submit" size="sm" variant="secondary" disabled={busy || pw.length < 6}>
          {busy ? "Saving…" : "Update"}
        </Button>
      </div>
      {msg && (
        <p className={cn("text-12", msg.kind === "ok" ? "text-focus-mint" : "text-focus-coral")}>
          {msg.text}
        </p>
      )}
    </form>
  );
}

function EditChildDialog({
  child,
  onClose,
  onSave,
}: {
  child: Child | null;
  onClose: () => void;
  onSave: (updates: Partial<Child>) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [age, setAge] = useState<string>("");
  const [petType, setPetType] = useState<PetId>("rabbit");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (child) {
      setName(child.name);
      setAge(child.age != null ? String(child.age) : "");
      setPetType(child.petType);
      setErr(null);
    }
  }, [child]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setErr("Name is required."); return; }
    setBusy(true); setErr(null);
    try {
      await onSave({
        name: name.trim(),
        age: age ? parseInt(age, 10) : undefined,
        petType,
      });
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!child} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-sp-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="child-name" className="text-12 text-focus-muted">Name</Label>
            <Input
              id="child-name"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="child-age" className="text-12 text-focus-muted">Age</Label>
            <Input
              id="child-age"
              type="number"
              min={1}
              max={18}
              value={age}
              onChange={e => setAge(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-12 text-focus-muted">Pet</Label>
            <CritterPicker value={petType} onChange={setPetType} />
          </div>
          {err && <p className="text-12 text-focus-coral">{err}</p>}
          <DialogFooter className="gap-sp-2 pt-sp-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default ParentSettings;
