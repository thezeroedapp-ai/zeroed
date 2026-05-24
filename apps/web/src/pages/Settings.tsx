import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiFetch, fmtD } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import AvatarCircle from '@/components/ui/avatar-circle';

const SINKING_CATEGORIES = ['car', 'home', 'medical', 'travel', 'education', 'holiday', 'tax', 'other'];

interface SinkingFund { id: string; category: string; monthly_amount: number; label?: string; }
interface PlaidItem { item_id: string; institution_name: string; last_synced?: string; error_status?: string | null; }

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function Settings() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [income, setIncome]           = useState('');
  const [incomeLoading, setIncomeLoading] = useState(false);
  const [incomeSaved, setIncomeSaved] = useState(false);
  const [confirmDisconnectId, setConfirmDisconnectId] = useState<string | null>(null);
  const [confirmFundId, setConfirmFundId] = useState<string | null>(null);
  const [sinkingFunds, setSinkingFunds]   = useState<SinkingFund[]>([]);
  const [plaidItems, setPlaidItems]       = useState<PlaidItem[]>([]);
  const [sfForm, setSfForm]   = useState({ category: 'car', amount: '', label: '' });
  const [sfSaving, setSfSaving] = useState(false);
  const [plaidLoading, setPlaidLoading] = useState(false);
  const [syncing, setSyncing]           = useState(false);

  function loadPlaidScript(): Promise<void> {
    return new Promise(resolve => {
      if ((window as any).Plaid) { resolve(); return; }
      const s = document.createElement('script');
      s.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
      s.onload = () => resolve();
      document.head.appendChild(s);
    });
  }

  async function connectBank() {
    setPlaidLoading(true);
    try {
      await loadPlaidScript();
      const r = await apiFetch('/api/plaid/create-link-token', { method: 'POST' });
      const { link_token } = await r.json();
      (window as any).Plaid.create({
        token: link_token,
        onSuccess: async (publicToken: string, metadata: any) => {
          await apiFetch('/api/plaid/exchange-token', {
            method: 'POST',
            body: JSON.stringify({ public_token: publicToken, institution_name: metadata.institution?.name }),
          });
          await apiFetch('/api/plaid/sync', { method: 'POST' });
          loadSettings();
        },
        onExit: () => {},
      }).open();
    } finally { setPlaidLoading(false); }
  }

  async function reconnectItem(itemId: string) {
    setPlaidLoading(true);
    try {
      await loadPlaidScript();
      const r = await apiFetch('/api/plaid/create-link-token/update', {
        method: 'POST', body: JSON.stringify({ item_id: itemId }),
      });
      const { link_token } = await r.json();
      (window as any).Plaid.create({
        token: link_token,
        onSuccess: async () => { await apiFetch('/api/plaid/sync', { method: 'POST' }); loadSettings(); },
        onExit: () => {},
      }).open();
    } finally { setPlaidLoading(false); }
  }

  async function disconnectItem(itemId: string) {
    await apiFetch(`/api/plaid/items/${itemId}`, { method: 'DELETE' });
    setConfirmDisconnectId(null);
    loadSettings();
  }

  async function syncNow() {
    setSyncing(true);
    try { await apiFetch('/api/plaid/sync', { method: 'POST' }); loadSettings(); }
    finally { setSyncing(false); }
  }

  async function loadSettings() {
    try {
      const [r1, r2, r3] = await Promise.all([
        apiFetch('/api/sinking-funds/income'),
        apiFetch('/api/sinking-funds'),
        apiFetch('/api/plaid/items'),
      ]);
      if (r1.ok) { const d = await r1.json(); setIncome(d.monthly_income?.toString() || ''); }
      if (r2.ok) { const d = await r2.json(); setSinkingFunds(d.funds || []); }
      if (r3.ok) { const d = await r3.json(); setPlaidItems(d.items || []); }
    } catch { /* ignore */ }
  }

  useEffect(() => { loadSettings(); }, []);

  async function saveIncome() {
    setIncomeLoading(true);
    try {
      await apiFetch('/api/sinking-funds/income', {
        method: 'PUT',
        body: JSON.stringify({ monthly_income: parseFloat(income) }),
      });
      setIncomeSaved(true);
      setTimeout(() => setIncomeSaved(false), 2000);
    } finally { setIncomeLoading(false); }
  }

  async function addFund() {
    if (!sfForm.amount) return;
    setSfSaving(true);
    try {
      await apiFetch('/api/sinking-funds', {
        method: 'POST',
        body: JSON.stringify({ category: sfForm.category, monthly_amount: parseFloat(sfForm.amount), label: sfForm.label || null }),
      });
      setSfForm({ category: 'car', amount: '', label: '' });
      loadSettings();
    } finally { setSfSaving(false); }
  }

  async function deleteFund(id: string) {
    await apiFetch(`/api/sinking-funds/${id}`, { method: 'DELETE' });
    setConfirmFundId(null);
    loadSettings();
  }

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  const totalSinking = sinkingFunds.reduce((s, f) => s + f.monthly_amount, 0);

  return (
    <div className="min-h-dvh">
      <div className="sticky top-0 z-10 px-5 lg:px-10 py-5 top-bar border-b border-border">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Preferences, banks, and account</p>
        </div>
      </div>

      <div className="px-6 lg:px-10 pb-[calc(var(--nav-h)+24px)] md:pb-10 pt-8 max-w-3xl mx-auto space-y-8">

        {/* Monthly Income */}
        <section>
          <p className="text-sm font-semibold text-foreground mb-3">Monthly Income</p>
          <Card className="bg-card border-border">
            <CardContent className="p-5 space-y-3">
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Take-home pay (after tax)</Label>
                  <Input
                    type="number" min="0" step="100" placeholder="e.g. 5000"
                    value={income} onChange={e => setIncome(e.target.value)}
                    className="bg-input border-border text-foreground focus-visible:ring-[var(--primary)]/50"
                  />
                </div>
                <Button onClick={saveIncome} disabled={incomeLoading || !income}
                  className={cn('shrink-0 bg-primary hover:bg-primary/90', incomeSaved && 'bg-green hover:bg-green/90')}>
                  {incomeLoading ? '…' : incomeSaved ? '✓ Saved' : 'Save'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Used to calculate monthly surplus for your payoff plan.</p>
            </CardContent>
          </Card>
        </section>

        {/* Sinking Funds */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-foreground">Sinking Funds</p>
            {totalSinking > 0 && (
              <span className="text-xs text-muted-foreground">{fmtD(totalSinking)}/mo reserved</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
            Reserve amounts for known future expenses so they don't derail your payoff plan.
          </p>

          {sinkingFunds.length > 0 && (
            <Card className="bg-card border-border mb-3">
              <CardContent className="p-0">
                {sinkingFunds.map((f, i) => (
                  <div key={f.id} className={cn(
                    'flex items-center justify-between px-4 py-4',
                    i < sinkingFunds.length - 1 && 'border-b border-border',
                  )}>
                    <div>
                      <p className="text-sm font-semibold text-foreground capitalize">
                        {f.label || f.category.charAt(0).toUpperCase() + f.category.slice(1)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{fmtD(f.monthly_amount)}/mo</p>
                    </div>
                    {confirmFundId === f.id ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">Delete?</span>
                        <Button variant="outline" size="sm" onClick={() => deleteFund(f.id)} className="h-7 text-xs border-red/30 text-red hover:bg-red-dim">Yes</Button>
                        <Button variant="outline" size="sm" onClick={() => setConfirmFundId(null)} className="h-7 text-xs border-border text-muted-foreground">No</Button>
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => setConfirmFundId(f.id)} className="h-7 text-xs border-red/30 text-red hover:bg-red/10">Delete</Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card className="bg-card border-border">
            <CardHeader className="pt-5 pb-2 px-5">
              <CardTitle className="text-sm font-semibold">{sinkingFunds.length === 0 ? 'Add Your First Fund' : 'Add Fund'}</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Category</Label>
                <Select value={sfForm.category} onValueChange={v => setSfForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger className="bg-input border-border text-foreground"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border text-foreground">
                    {SINKING_CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Label (optional)</Label>
                <Input placeholder="e.g. Car registration" value={sfForm.label}
                  onChange={e => setSfForm(p => ({ ...p, label: e.target.value }))}
                  className="bg-input border-border text-foreground focus-visible:ring-[var(--primary)]/50" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Monthly Amount ($)</Label>
                <Input type="number" min="1" step="1" placeholder="0" value={sfForm.amount}
                  onChange={e => setSfForm(p => ({ ...p, amount: e.target.value }))}
                  className="bg-input border-border text-foreground focus-visible:ring-[var(--primary)]/50" />
              </div>
              <Button onClick={addFund} disabled={sfSaving || !sfForm.amount} className="w-full bg-primary hover:bg-primary/90">
                {sfSaving ? '…' : 'Add Sinking Fund'}
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* Connected Banks */}
        <section>
          <p className="text-sm font-semibold text-foreground mb-3">Connected Banks</p>

          {plaidItems.length === 0 ? (
            <Card className="bg-card border-border mb-3">
              <CardContent className="p-4 text-center">
                <p className="text-sm text-muted-foreground">No banks connected yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2 mb-3">
              {plaidItems.map(item => (
                <Card key={item.item_id} className="bg-card border-border">
                  <CardContent className="p-4">
                    {item.error_status === 'ITEM_LOGIN_REQUIRED' && (
                      <div className="flex items-center gap-2 bg-red/10 border border-red/25 rounded-lg px-3 py-2 mb-3">
                        <AlertTriangle size={14} className="text-red shrink-0" />
                        <p className="text-xs text-red">Bank connection expired — please reconnect to resume syncing.</p>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <AvatarCircle name={item.institution_name} size={36} />
                        <div>
                          <p className="text-sm font-semibold text-foreground">{item.institution_name}</p>
                          {item.last_synced && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Synced {relativeTime(item.last_synced)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0 items-center">
                        {item.error_status === 'ITEM_LOGIN_REQUIRED' && (
                          <Button size="sm" onClick={() => reconnectItem(item.item_id)} disabled={plaidLoading}
                            className="h-8 bg-primary hover:bg-primary/90">Reconnect</Button>
                        )}
                        {confirmDisconnectId === item.item_id ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">Disconnect?</span>
                            <Button size="sm" onClick={() => disconnectItem(item.item_id)} className="h-8 border-red/30 text-red hover:bg-red-dim" variant="outline">Yes</Button>
                            <Button size="sm" variant="outline" onClick={() => setConfirmDisconnectId(null)} className="h-8 border-border text-muted-foreground">No</Button>
                          </div>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => setConfirmDisconnectId(item.item_id)}
                            className="h-8 border-red/30 text-red hover:bg-red/10">Disconnect</Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={connectBank} disabled={plaidLoading} className="flex-1 bg-primary hover:bg-primary/90">
              {plaidLoading ? '…' : '+ Connect Bank'}
            </Button>
            {plaidItems.length > 0 && (
              <Button variant="outline" onClick={syncNow} disabled={syncing}
                className="border-border text-muted-foreground hover:text-foreground whitespace-nowrap">
                {syncing ? 'Syncing…' : 'Sync Now'}
              </Button>
            )}
          </div>
        </section>

        {/* Account */}
        <section>
          <p className="text-sm font-semibold text-foreground mb-3">Account</p>
          <Card className="bg-card border-red/20">
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground mb-4">Signing out will end your current session.</p>
              <Button variant="outline" onClick={handleSignOut}
                className="w-full border-red/30 text-red hover:bg-red-dim">Sign Out</Button>
            </CardContent>
          </Card>
        </section>

        <p className="text-center text-xs text-muted-foreground pb-2">Zeroed v6.1</p>
      </div>
    </div>
  );
}
