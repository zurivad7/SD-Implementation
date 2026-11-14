import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { SEED_DATA } from "../data/seed";
import { PRESETS } from "../data/presets";
import type { Category, Channel, Customer, Priority, Tier } from "../types";
import { CATEGORY_LABEL, CHANNEL_LABEL, LANGUAGE_LABEL, PRIORITY_LABEL, TIER_LABEL } from "../lib/format";
import { useDesk } from "../store/useDesk";

const field = "mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-900";
const label = "block text-sm font-medium";

const sortedCustomers = [...SEED_DATA.customers].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

/** Create ticket form (SPEC.md section 6.1). */
export default function CreateTicketForm() {
  const navigate = useNavigate();
  const createTicket = useDesk((s) => s.createTicket);
  const sandboxCustomers = useDesk((s) => s.customers);

  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [customerId, setCustomerId] = useState(sortedCustomers[0]!.id);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newTier, setNewTier] = useState<Tier>("standard");
  const [newLanguage, setNewLanguage] = useState<Customer["language"]>("en");
  const [channel, setChannel] = useState<Channel>("email");
  const [category, setCategory] = useState<Category>("license_activation");
  const [priority, setPriority] = useState<Priority | "">("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [presetId, setPresetId] = useState(PRESETS[0]!.id);
  const [error, setError] = useState("");

  const allCustomers = useMemo(() => [...sandboxCustomers, ...sortedCustomers], [sandboxCustomers]);
  const selected = allCustomers.find((c) => c.id === customerId);

  function fillExample() {
    const p = PRESETS.find((x) => x.id === presetId)!;
    setMode("existing");
    setCustomerId(p.customerId);
    setChannel(p.channel);
    setCategory(p.category);
    setPriority(p.priority ?? "");
    setSubject(p.subject);
    setBody(p.body);
    setError("");
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    let customer: Customer | undefined = selected;
    if (mode === "new") {
      if (!newName.trim() || !newEmail.trim()) return setError("Enter the new customer's name and email.");
      customer = { id: `s${String(sandboxCustomers.length + 1).padStart(3, "0")}`, name: newName.trim(), email: newEmail.trim(), tier: newTier, language: newLanguage };
    }
    if (!customer) return setError("Pick a customer.");
    if (!subject.trim() || !body.trim()) return setError("Enter a subject and a description.");
    const id = createTicket({ subject: subject.trim(), body: body.trim(), channel, category, ...(priority ? { priority } : {}) }, customer);
    navigate(`/sandbox/${id}`);
  }

  return (
    <form onSubmit={submit} aria-labelledby="create-heading" className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <h2 id="create-heading" className="text-lg font-semibold">Create a ticket</h2>

      <div className="mt-3 flex flex-wrap items-end gap-2 rounded-md bg-accent-50 p-3 dark:bg-slate-900">
        <div className="min-w-0 flex-1">
          <label htmlFor="preset" className={label}>Example scenario</label>
          <select id="preset" className={field} value={presetId} onChange={(e) => setPresetId(e.target.value)}>
            {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
        <button type="button" onClick={fillExample} className="rounded-md bg-accent-600 px-4 py-2 font-medium text-white hover:bg-accent-700">
          Fill example
        </button>
      </div>

      <fieldset className="mt-4">
        <legend className={label}>Customer</legend>
        <div className="mt-1 flex gap-4">
          {(["existing", "new"] as const).map((m) => (
            <label key={m} className="flex items-center gap-2">
              <input type="radio" name="customer-mode" value={m} checked={mode === m} onChange={() => setMode(m)} />
              {m === "existing" ? "Pick a customer" : "New customer"}
            </label>
          ))}
        </div>
      </fieldset>

      {mode === "existing" ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-[2fr,1fr]">
          <div>
            <label htmlFor="customer" className={label}>Customer</label>
            <select id="customer" className={field} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              {allCustomers.map((c) => <option key={c.id} value={c.id}>{c.name} ({TIER_LABEL[c.tier]}, {LANGUAGE_LABEL[c.language]})</option>)}
            </select>
          </div>
          <div>
            <span className={label} id="tier-label">Tier</span>
            <p aria-labelledby="tier-label" className="mt-1 rounded-md border border-dashed border-slate-300 px-3 py-2 dark:border-slate-600" data-testid="customer-tier">
              {selected ? TIER_LABEL[selected.tier] : "None"}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="new-name" className={label}>Name</label>
            <input id="new-name" className={field} value={newName} onChange={(e) => setNewName(e.target.value)} autoComplete="off" />
          </div>
          <div>
            <label htmlFor="new-email" className={label}>Email</label>
            <input id="new-email" type="email" className={field} value={newEmail} onChange={(e) => setNewEmail(e.target.value)} autoComplete="off" placeholder="name@example.com" />
          </div>
          <div>
            <label htmlFor="new-tier" className={label}>Tier</label>
            <select id="new-tier" className={field} value={newTier} onChange={(e) => setNewTier(e.target.value as Tier)}>
              {(Object.keys(TIER_LABEL) as Tier[]).map((t) => <option key={t} value={t}>{TIER_LABEL[t]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="new-language" className={label}>Language</label>
            <select id="new-language" className={field} value={newLanguage} onChange={(e) => setNewLanguage(e.target.value as Customer["language"])}>
              {(Object.keys(LANGUAGE_LABEL) as Customer["language"][]).map((l) => <option key={l} value={l}>{LANGUAGE_LABEL[l]}</option>)}
            </select>
          </div>
        </div>
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="channel" className={label}>Channel</label>
          <select id="channel" className={field} value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
            {(Object.keys(CHANNEL_LABEL) as Channel[]).map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="category" className={label}>Category</label>
          <select id="category" className={field} value={category} onChange={(e) => setCategory(e.target.value as Category)}>
            {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="priority" className={label}>Priority (optional)</label>
          <select id="priority" className={field} value={priority} onChange={(e) => setPriority(e.target.value as Priority | "")}>
            <option value="">Not set (normal)</option>
            {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
          </select>
        </div>
      </div>

      <div className="mt-3">
        <label htmlFor="subject" className={label}>Subject</label>
        <input id="subject" className={field} value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>
      <div className="mt-3">
        <label htmlFor="body" className={label}>Description</label>
        <textarea id="body" rows={4} className={field} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>

      {error && <p role="alert" className="mt-3 font-medium text-red-800 dark:text-red-300">{error}</p>}

      <button type="submit" className="mt-4 rounded-md bg-accent-600 px-4 py-2 font-medium text-white hover:bg-accent-700">
        Create ticket
      </button>
    </form>
  );
}
