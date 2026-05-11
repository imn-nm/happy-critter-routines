import { useState } from 'react';
import { Copy, Users, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useHousehold } from '@/hooks/useHousehold';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const HouseholdSettings = () => {
  const { user } = useAuth();
  const { household, members, createHousehold, createInvite } = useHousehold();
  const [inviteEmail, setInviteEmail] = useState('');
  const [latestUrl, setLatestUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!household) {
    return (
      <section className="mx-sp-4 rounded-[28px] border border-[rgba(135,155,255,0.6)] bg-[rgba(135,155,255,0.2)] p-sp-4 flex flex-col gap-sp-3">
        <h2 className="text-14 font-medium text-iris-400 flex items-center gap-2">
          <Users className="w-4 h-4" /> Household
        </h2>
        <p className="text-14 text-fog-200">
          You're not in a household yet. Create one to share this account with a spouse or co-parent.
        </p>
        <Button
          size="sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await createHousehold('My Family');
            } finally {
              setBusy(false);
            }
          }}
        >
          Create household
        </Button>
      </section>
    );
  }

  const generate = async () => {
    setBusy(true);
    try {
      const invite = await createInvite(inviteEmail.trim() || undefined);
      setLatestUrl(invite.url);
      setInviteEmail('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-sp-4 rounded-[28px] border border-[rgba(135,155,255,0.6)] bg-[rgba(135,155,255,0.2)] p-sp-4 flex flex-col gap-sp-3">
      <div className="flex items-center justify-between">
        <h2 className="text-14 font-medium text-iris-400 flex items-center gap-2">
          <Users className="w-4 h-4" /> Household
        </h2>
        <span className="text-12 text-fog-200">{household.name}</span>
      </div>

      <div className="flex flex-col gap-sp-1">
        <p className="text-12 text-fog-200">Members</p>
        <ul className="flex flex-col gap-1">
          {(members ?? []).map(m => (
            <li
              key={m.user_id}
              className="text-14 text-fog-50 px-sp-2 py-1 rounded-[12px] bg-[rgba(8,1,26,0.4)] flex justify-between"
            >
              <span>{m.user_id === user?.id ? 'You' : m.user_id.slice(0, 8) + '…'}</span>
              <span className="text-fog-200 text-12">{m.role}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-sp-2">
        <p className="text-12 text-fog-200">Invite your spouse</p>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="email (optional)"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
          />
          <Button size="sm" onClick={generate} disabled={busy} className="gap-1.5">
            <Mail className="w-4 h-4" /> Invite
          </Button>
        </div>

        {latestUrl && (
          <div className="flex items-center gap-2 p-sp-2 rounded-[12px] bg-[rgba(8,1,26,0.4)]">
            <code className="text-12 text-fog-50 flex-1 truncate">{latestUrl}</code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(latestUrl);
                toast.success('Invite link copied');
              }}
              className="text-iris-400 hover:text-iris-300"
              aria-label="Copy invite link"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default HouseholdSettings;
