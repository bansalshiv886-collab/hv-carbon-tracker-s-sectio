
import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';

const DEFAULT_FACTORS = {
  "Car (km)": 0.192,
  "Motorbike (km)": 0.103,
  "Bus (km)": 0.089,
  "Train (km)": 0.041,
  "Flight (short-haul, km)": 0.254,
  "Electricity (kWh)": 0.72,
  "Natural gas (m3)": 2.02,
  "Beef (serving)": 27.0,
  "Rice (kg)": 2.7
};

const STORAGE_KEY = "cf_tracker_data_v1";
const FACTOR_KEY = "cf_tracker_factors_v1";

function safeParse(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch (e) {
    return fallback;
  }
}

export default function App() {
  const [factors, setFactors] = useState(() => safeParse(FACTOR_KEY, DEFAULT_FACTORS));
  const [entries, setEntries] = useState(() => safeParse(STORAGE_KEY, []));
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0,10), activity: Object.keys(factors)[0], amount: "10", notes: "" });
  const [query, setQuery] = useState("");
  const [userName, setUserName] = useState(() => localStorage.getItem('cf_user_name') || "");
  const [showWelcome, setShowWelcome] = useState(() => !(localStorage.getItem('cf_user_name')));
  const [theme, setTheme] = useState(() => localStorage.getItem('hv_theme') || 'light');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }, [entries]);

  useEffect(() => {
    localStorage.setItem(FACTOR_KEY, JSON.stringify(factors));
  }, [factors]);

  useEffect(() => {
    if (userName) {
      localStorage.setItem('cf_user_name', userName);
      setShowWelcome(false);
    }
  }, [userName]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('hv_theme', theme);
  }, [theme]);

  function addEntry(e) {
    e.preventDefault();
    const factor = factors[form.activity] ?? 0;
    const amount = parseFloat(form.amount) || 0;
    const co2 = +(factor * amount).toFixed(3);
    const newEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2,8),
      date: form.date,
      activity: form.activity,
      amount,
      unitFactor: factor,
      co2,
      notes: form.notes || ""
    };
    setEntries(prev => [newEntry, ...prev].slice(0,1000));
    setForm({ ...form, amount: "", notes: "" });
  }

  function removeEntry(id) {
    setEntries(prev => prev.filter(x => x.id !== id));
  }

  function clearAll() {
    if (!window.confirm("Clear all saved entries? This cannot be undone.")) return;
    setEntries([]);
  }

  function resetAll() {
    if (!window.confirm("Reset app to defaults? This will erase entries and factors.")) return;
    setEntries([]);
    setFactors(DEFAULT_FACTORS);
    localStorage.removeItem('cf_user_name');
    setUserName('');
    setShowWelcome(true);
  }

  function updateFactor(name, value) {
    setFactors(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
  }

  function addCustomFactor() {
    const name = prompt("Name of new activity (e.g. 'Walking (km)'):");
    if (!name) return;
    const value = prompt("Emission factor (kg CO2e per unit). Example: 0.192 for Car per km:");
    if (value === null) return;
    setFactors(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
  }

  function exportCSV() {
    const header = ["date","activity","amount","unit_kgCO2e","co2_kg","notes"];
    const rows = entries.map(r => [r.date, r.activity, r.amount, r.unitFactor, r.co2, `"${(r.notes||"").replace(/"/g,'""')}"`]);
    const csv = [header, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `carbon-entries-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function totalCO2(entriesList = entries) {
    return entriesList.reduce((s,e) => s + (parseFloat(e.co2)||0), 0).toFixed(3);
  }

  function filteredEntries() {
    if (!query) return entries;
    const q = query.toLowerCase();
    return entries.filter(e => e.activity.toLowerCase().includes(q) || (e.notes||"").toLowerCase().includes(q));
  }

  function buildMonthlyData() {
    const map = {};
    for (const e of entries) {
      const month = e.date.slice(0,7);
      map[month] = (map[month] || 0) + (parseFloat(e.co2) || 0);
    }
    const months = Object.keys(map).sort();
    return months.map(m => ({ month: m, co2: +map[m].toFixed(3) }));
  }

  const chartData = buildMonthlyData();

  const suggestions = [
    "Reduce car trips: combine errands, carpool, or choose public transit.",
    "Switch to LED lighting and unplug idle chargers.",
    "Reduce beef consumption and prefer plant-based meals.",
    "Improve home insulation and set thermostat efficiently.",
    "Choose renewable electricity plans if available.",
    "Fly less: favour rail or bus for short trips."
  ];

  return (
    <div className="app">
      {showWelcome ? (
        <div className="modal">
          <div className="modal-card">
            <h2>Welcome in the HV Project of Section S</h2>
            <p>Please enter your name to begin.</p>
            <input autoFocus placeholder="Your name" value={userName} onChange={e => setUserName(e.target.value)} />
            <div className="modal-actions">
              <button onClick={() => { setUserName('Guest'); }}>Continue as Guest</button>
              <button onClick={() => { if(!userName){ alert('Please enter a name or choose Guest.'); return;} setUserName(userName); }}>Save & Continue</button>
            </div>
          </div>
        </div>
      ) : null}

      <header className="header">
        <div>
          <h1>Carbon Footprint Tracker</h1>
          <p>{userName ? `Welcome, ${userName}!` : 'Add activities and track your emissions.'}</p>
        </div>
        <div className="header-right">
          <div>HV project of Section S</div>
          <div className="theme-toggle">
            <label>Theme</label>
            <select value={theme} onChange={e => setTheme(e.target.value)}>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
        </div>
      </header>

      <main className="container">
        <section className="card">
          <form onSubmit={addEntry} className="form-grid">
            <div>
              <label>Date</label>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
            </div>
            <div>
              <label>Activity</label>
              <select value={form.activity} onChange={e => setForm({ ...form, activity: e.target.value })}>
                {Object.keys(factors).map(k => <option key={k} value={k}>{k} — {factors[k]} kg/unit</option>)}
              </select>
            </div>
            <div>
              <label>Amount</label>
              <input type="number" step="any" placeholder="e.g. 12" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required />
            </div>
            <div>
              <label>Notes</label>
              <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="form-actions">
              <button type="submit">Add entry</button>
              <button type="button" onClick={() => setForm({ ...form, amount: "", notes: "" })}>Reset form</button>
              <button type="button" onClick={addCustomFactor}>Add custom activity</button>
            </div>
          </form>
        </section>

        <section className="card summary">
          <div className="summary-top">
            <h2>Summary</h2>
            <div>Total recorded: <strong>{totalCO2()} kg CO2e</strong></div>
          </div>

          <div className="search-row">
            <input placeholder="filter activity or notes" value={query} onChange={e => setQuery(e.target.value)} />
            <div className="small-actions">
              <button onClick={exportCSV}>Export CSV</button>
              <button onClick={clearAll}>Clear all</button>
              <button onClick={resetAll}>Start Over</button>
            </div>
          </div>

          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="co2" stroke="#3b82f6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card entries">
          <h2>Entries</h2>
          <div className="entries-list">
            {filteredEntries().length === 0 ? <div className="muted">No entries yet.</div> : filteredEntries().map(e => (
              <div key={e.id} className="entry">
                <div>
                  <div className="entry-title">{e.activity} — <span className="muted">{e.amount}</span></div>
                  <div className="muted">{e.date} • {e.co2} kg CO2e</div>
                  {e.notes ? <div className="muted">{e.notes}</div> : null}
                </div>
                <div className="entry-actions">
                  <button onClick={() => removeEntry(e.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card factors">
          <h2>Emission factors (editable)</h2>
          <div className="factors-grid">
            {Object.entries(factors).map(([k,v]) => (
              <div key={k} className="factor-row">
                <div className="factor-name">{k}</div>
                <input value={v} onChange={e => updateFactor(k, e.target.value)} />
              </div>
            ))}
          </div>
        </section>

        <section className="card tips">
          <h2>Reduction suggestions</h2>
          <ul>
            {suggestions.map((s,i) => <li key={i}>{s}</li>)}
          </ul>
        </section>
      </main>

      <footer className="footer">Made with ♻️ — edit factors to match local official data for best accuracy.</footer>
    </div>
  );
}
