import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, LogOut, Mail, Lock, User, Pencil, Check, X } from "lucide-react";
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
import PetAvatar, { type PetType } from "@/components/PetAvatar";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const PET_TYPES: { type: PetType; name: string }[] = [
  { type: "fox", name: "Arctic Fox" },
];

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
  const { user, signOut } = useAuth();
  const { children, updateChild } = useChildren();

  const fullName = (user?.user_metadata?.full_name as string | undefined) ?? "";
  const email = user?.email ?? "";

  const [editingChild, setEditingChild] = useState<Child | null>(null);

  return (
    <div className="min-h-screen pb-sp-8">
      <div className="max-w-[420px] mx-auto flex flex-col gap-sp-4">
        {/* Header */}
        <header className="flex items-center justify-between gap-sp-3 px-sp-4 pt-sp-5">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            aria-label="Back"
            className="shrink-0 w-9 h-9 rounded-pill bg-iris-400/[0.04] border border-iris-400/30 flex items-center justify-center text-fog-50 hover:bg-iris-400/10 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-20 text-white leading-none">Settings</h1>
          <div className="w-9 h-9" />
        </header>

        {/* Account */}
        <section className="mx-sp-4 rounded-[28px] border border-[rgba(135,155,255,0.6)] bg-[rgba(135,155,255,0.2)] p-sp-4 flex flex-col gap-sp-3">
          <h2 className="text-14 font-medium text-iris-400">Account</h2>

          <EditableRow
            icon={<User className="w-4 h-4 text-iris-400" />}
            label="Name"
            value={fullName}
            placeholder="Your name"
            onSave={async (next) => {
              const { error } = await supabase.auth.updateUser({ data: { full_name: next } });
              if (error) throw error;
            }}
          />
          <EditableRow
            icon={<Mail className="w-4 h-4 text-iris-400" />}
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

          <button
            type="button"
            onClick={async () => { await signOut(); navigate("/"); }}
            className="self-start flex items-center gap-2 text-14 text-coral-400 hover:underline"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </section>

        {/* Children */}
        <section className="mx-sp-4 rounded-[28px] border border-[rgba(135,155,255,0.6)] bg-[rgba(135,155,255,0.2)] p-sp-4 flex flex-col gap-sp-3">
          <div className="flex items-center justify-between">
            <h2 className="text-14 font-medium text-iris-400">Children</h2>
            <Button size="sm" onClick={() => navigate("/setup")} className="gap-1.5">
              <Plus className="w-4 h-4" />
              Add child
            </Button>
          </div>

          {children.length === 0 ? (
            <p className="text-14 text-fog-200">
              No children yet. Add one to start tracking routines.
            </p>
          ) : (
            <ul className="flex flex-col gap-sp-2">
              {children.map(child => (
                <li
                  key={child.id}
                  className="flex items-center gap-sp-3 p-sp-3 rounded-[20px] bg-[rgba(8,1,26,0.4)]"
                >
                  <div className="shrink-0 w-12 h-12 rounded-[20px] bg-paper flex items-center justify-center overflow-hidden">
                    <PetAvatar petType={child.petType} happiness={child.petHappiness} size="sm" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-16 text-fog-50 truncate">{child.name}</p>
                    <p className="text-12 text-fog-200 truncate">
                      {child.age ? `Age ${child.age} · ` : ""}{child.petType}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingChild(child)}
                    className="text-12 text-iris-400 hover:underline"
                  >
                    Edit
                  </button>
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
    } catch (e: any) {
      setMsg({ kind: "err", text: e?.message ?? "Failed to save." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-sp-3 p-sp-3 rounded-[20px] bg-[rgba(8,1,26,0.4)]">
        <div className="shrink-0 w-8 h-8 rounded-pill bg-iris-400/10 flex items-center justify-center">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-12 text-iris-400">{label}</p>
          {editing ? (
            <Input
              autoFocus
              type={type}
              value={draft}
              placeholder={placeholder}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
              className="bg-transparent border-iris-400/30 text-fog-50 h-7 px-2 mt-1"
            />
          ) : (
            <p className="text-14 text-fog-50 truncate">{value || "—"}</p>
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
                "shrink-0 w-8 h-8 rounded-pill flex items-center justify-center",
                "bg-mint-500/15 border border-mint-500/40 text-mint-500 hover:bg-mint-500/25",
              )}
            >
              <Check className="w-4 h-4" strokeWidth={3} />
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={busy}
              aria-label="Cancel"
              className="shrink-0 w-8 h-8 rounded-pill flex items-center justify-center bg-fog-50/5 border border-fog-50/20 text-fog-50 hover:bg-fog-50/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={`Edit ${label}`}
            className="shrink-0 w-8 h-8 rounded-pill bg-iris-400/10 border border-iris-400/30 text-iris-400 hover:bg-iris-400/20 flex items-center justify-center"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {editing && helper && <p className="text-11 text-fog-300 px-1">{helper}</p>}
      {msg && (
        <p className={cn("text-12 px-1", msg.kind === "ok" ? "text-mint-500" : "text-coral-400")}>
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
    <form onSubmit={submit} className="flex flex-col gap-sp-2 pt-sp-2 border-t border-iris-400/[0.18]">
      <Label htmlFor="new-pw" className="text-12 text-iris-400 flex items-center gap-1.5">
        <Lock className="w-3.5 h-3.5" /> Change password
      </Label>
      <div className="flex items-center gap-sp-2">
        <Input
          id="new-pw"
          type="password"
          value={pw}
          onChange={e => setPw(e.target.value)}
          placeholder="New password (6+ chars)"
          className="bg-black/30 border-iris-400/30 text-fog-50"
        />
        <Button type="submit" size="sm" disabled={busy || pw.length < 6}>
          {busy ? "Saving…" : "Update"}
        </Button>
      </div>
      {msg && (
        <p className={cn("text-12", msg.kind === "ok" ? "text-mint-500" : "text-coral-400")}>
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
  const [petType, setPetType] = useState<PetType>("fox");
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
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-sp-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="child-name" className="text-12 text-iris-400">Name</Label>
            <Input
              id="child-name"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="child-age" className="text-12 text-iris-400">Age</Label>
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
            <Label className="text-12 text-iris-400">Pet</Label>
            <div className="flex gap-sp-2">
              {PET_TYPES.map(p => (
                <button
                  key={p.type}
                  type="button"
                  onClick={() => setPetType(p.type)}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-1.5 p-sp-3 rounded-[20px] border transition-colors",
                    petType === p.type
                      ? "bg-iris-400/[0.18] border-iris-400"
                      : "bg-iris-400/[0.04] border-iris-400/20 hover:bg-iris-400/10",
                  )}
                >
                  <div className="w-10 h-10 rounded-pill bg-paper overflow-hidden flex items-center justify-center">
                    <PetAvatar petType={p.type} happiness={70} size="sm" />
                  </div>
                  <span className="text-12 text-fog-50">{p.name}</span>
                </button>
              ))}
            </div>
          </div>
          {err && <p className="text-12 text-coral-400">{err}</p>}
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
