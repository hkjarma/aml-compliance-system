import { useEffect, useMemo, useState } from 'react';

const fallbackSummary = {
  total_transactions: 4,
  alerts_count: 3,
  high_risk_count: 2,
  average_score: 73.5,
  top_risk_accounts: ['acct-01', 'acct-02', 'acct-03'],
};

const fallbackAlerts = [
  {
    alert_id: 'alert-txn-1001',
    account_id: 'acct-01',
    transaction_id: 'txn-1001',
    score: 92,
    severity: 'critical',
    reasons: ['Large outbound transfer', 'High-risk settlement patterns'],
    country: 'US',
    amount: '$22,000',
    channel: 'Wire',
  },
  {
    alert_id: 'alert-txn-1002',
    account_id: 'acct-02',
    transaction_id: 'txn-1002',
    score: 76,
    severity: 'high',
    reasons: ['Cash channel', 'High-risk jurisdiction: RU'],
    country: 'RU',
    amount: '$14,000',
    channel: 'Cash',
  },
  {
    alert_id: 'alert-txn-1004',
    account_id: 'acct-03',
    transaction_id: 'txn-1004',
    score: 81,
    severity: 'high',
    reasons: ['Crypto channel', 'Round-trip funds movement suspected'],
    country: 'CN',
    amount: '$32,000',
    channel: 'Crypto',
  },
];

const fallbackCases = [
  {
    case_id: 'case-001',
    account_id: 'acct-01',
    status: 'open',
    analyst: 'N. Patel',
    summary: 'Large outbound transfer with unusual payment behavior.',
    priority: 'High',
    age: '1h 20m',
  },
  {
    case_id: 'case-002',
    account_id: 'acct-02',
    status: 'pending',
    analyst: 'M. Gomez',
    summary: 'Cash-intensive inbound transaction tied to high-risk jurisdiction.',
    priority: 'Critical',
    age: '3h 05m',
  },
  {
    case_id: 'case-003',
    account_id: 'acct-07',
    status: 'review',
    analyst: 'S. Chen',
    summary: 'Recurring round-trip pattern across multiple entities.',
    priority: 'Medium',
    age: '5h 41m',
  },
];

function App() {
  const [summary, setSummary] = useState(fallbackSummary);
  const [alerts, setAlerts] = useState(fallbackAlerts);
  const [cases, setCases] = useState(fallbackCases);
  const [health, setHealth] = useState({ status: 'loading' });
  const [selectedCase, setSelectedCase] = useState(fallbackCases[0]);
  const [activeFilter, setActiveFilter] = useState('All');

  useEffect(() => {
    const loadData = async () => {
      try {
        const [healthRes, summaryRes, alertsRes, casesRes] = await Promise.all([
          fetch('/health'),
          fetch('/api/v1/risk/summary'),
          fetch('/api/v1/alerts'),
          fetch('/api/v1/cases'),
        ]);

        if (healthRes.ok) {
          const healthData = await healthRes.json();
          setHealth(healthData);
        }

        if (summaryRes.ok) {
          setSummary(await summaryRes.json());
        }

        if (alertsRes.ok) {
          setAlerts(await alertsRes.json());
        }

        if (casesRes.ok) {
          const loadedCases = await casesRes.json();
          setCases(loadedCases);
          if (loadedCases.length) setSelectedCase(loadedCases[0]);
        }
      } catch (error) {
        console.warn('Using fallback AML dashboard data.', error);
      }
    };

    loadData();
  }, []);

  const filteredCases = useMemo(() => {
    if (activeFilter === 'All') return cases;
    return cases.filter((item) => item.status === activeFilter.toLowerCase());
  }, [cases, activeFilter]);

  const highRiskCount = useMemo(
    () => alerts.filter((alert) => ['high', 'critical'].includes(alert.severity)).length,
    [alerts]
  );

  return (
    <div className="dashboard-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">COMPLIANCE OPERATIONS</p>
          <h1>AML Analyst Dashboard</h1>
        </div>
        <div className="topbar-actions">
          <div className={`status-badge ${health.status === 'ok' ? 'online' : ''}`}>
            {health.status === 'ok' ? 'API Online' : 'Demo Mode'}
          </div>
          <button className="primary-button">+ New alert</button>
        </div>
      </header>

      <section className="stats-grid">
        <div className="stat-card accent-blue">
          <span>Total transactions</span>
          <strong>{summary.total_transactions}</strong>
        </div>
        <div className="stat-card accent-orange">
          <span>Alerts</span>
          <strong>{summary.alerts_count}</strong>
        </div>
        <div className="stat-card accent-red">
          <span>High-risk</span>
          <strong>{highRiskCount}</strong>
        </div>
        <div className="stat-card accent-green">
          <span>Average score</span>
          <strong>{summary.average_score}</strong>
        </div>
      </section>

      <section className="content-grid">
        <div className="panel panel-lg">
          <div className="panel-header">
            <h2>Active alerts</h2>
            <button className="secondary-button">Escalate all</button>
          </div>

          <div className="alert-list">
            {alerts.map((alert) => (
              <article key={alert.alert_id} className="alert-item">
                <div className="alert-head">
                  <span className={`severity ${alert.severity}`}>{alert.severity}</span>
                  <strong>{alert.alert_id}</strong>
                </div>

                <div className="alert-meta">
                  <span>Account: {alert.account_id}</span>
                  <span>Txn: {alert.transaction_id}</span>
                </div>

                <div className="alert-meta compact">
                  <span>{alert.country}</span>
                  <span>{alert.channel}</span>
                  <span>{alert.amount}</span>
                </div>

                <p className="score-line">Score: {alert.score}</p>
                <ul>
                  {alert.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>

        <aside className="panel panel-side">
          <div className="panel-header sticky-header">
            <h2>Investigation queue</h2>
            <button className="secondary-button">New case</button>
          </div>

          <div className="filter-row">
            {['All', 'Open', 'Pending', 'Review'].map((filter) => (
              <button
                key={filter}
                className={activeFilter === filter ? 'filter-button active' : 'filter-button'}
                onClick={() => setActiveFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </div>

          <div className="case-list">
            {filteredCases.map((caseItem) => (
              <button
                key={caseItem.case_id}
                className={selectedCase?.case_id === caseItem.case_id ? 'case-card selected' : 'case-card'}
                onClick={() => setSelectedCase(caseItem)}
              >
                <div className="case-row">
                  <strong>{caseItem.case_id}</strong>
                  <span className={`case-status ${caseItem.status}`}>{caseItem.status}</span>
                </div>
                <p>Account: {caseItem.account_id}</p>
                <p>Analyst: {caseItem.analyst}</p>
                <div className="case-footer">
                  <span className="priority-pill">{caseItem.priority}</span>
                  <span>{caseItem.age}</span>
                </div>
              </button>
            ))}
          </div>
        </aside>
      </section>

      <section className="panel detail-panel">
        <div className="panel-header detail-header">
          <div>
            <p className="eyebrow subtle">CASE DETAIL</p>
            <h2>{selectedCase?.case_id}</h2>
          </div>
          <div className="detail-actions">
            <button className="secondary-button">Escalate</button>
            <button className="primary-button">Close case</button>
          </div>
        </div>

        <div className="detail-grid">
          <div>
            <div className="detail-row">
              <span>Status</span>
              <strong>{selectedCase?.status}</strong>
            </div>
            <div className="detail-row">
              <span>Account</span>
              <strong>{selectedCase?.account_id}</strong>
            </div>
            <div className="detail-row">
              <span>Analyst</span>
              <strong>{selectedCase?.analyst}</strong>
            </div>
          </div>

          <div className="summary-box">
            <h3>Investigation summary</h3>
            <p>{selectedCase?.summary}</p>
          </div>
        </div>
      </section>

      <section className="panel full-width">
        <div className="panel-header">
          <h2>High-risk account watchlist</h2>
        </div>
        <div className="watchlist">
          {summary.top_risk_accounts.map((account) => (
            <div key={account} className="watchlist-item">
              <span>{account}</span>
              <span className="dot" />
              <span>Priority review</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default App;
