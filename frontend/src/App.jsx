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
  },
  {
    alert_id: 'alert-txn-1002',
    account_id: 'acct-02',
    transaction_id: 'txn-1002',
    score: 76,
    severity: 'high',
    reasons: ['Cash channel', 'High-risk jurisdiction: RU'],
  },
  {
    alert_id: 'alert-txn-1004',
    account_id: 'acct-03',
    transaction_id: 'txn-1004',
    score: 81,
    severity: 'high',
    reasons: ['Crypto channel', 'Round-trip funds movement suspected'],
  },
];

const fallbackCases = [
  {
    case_id: 'case-001',
    account_id: 'acct-01',
    status: 'open',
    analyst: 'N. Patel',
    summary: 'Large outbound transfer with unusual payment behavior.',
  },
  {
    case_id: 'case-002',
    account_id: 'acct-02',
    status: 'pending',
    analyst: 'M. Gomez',
    summary: 'Cash-intensive inbound transaction tied to high-risk jurisdiction.',
  },
];

function App() {
  const [summary, setSummary] = useState(fallbackSummary);
  const [alerts, setAlerts] = useState(fallbackAlerts);
  const [cases, setCases] = useState(fallbackCases);
  const [health, setHealth] = useState({ status: 'loading' });

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
          setCases(await casesRes.json());
        }
      } catch (error) {
        console.warn('Using fallback AML dashboard data.', error);
      }
    };

    loadData();
  }, []);

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
        <div className={`status-badge ${health.status === 'ok' ? 'online' : ''}`}>
          {health.status === 'ok' ? 'API Online' : 'Demo Mode'}
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
        <div className="panel">
          <div className="panel-header">
            <h2>Active alerts</h2>
            <button>Escalate all</button>
          </div>

          <div className="alert-list">
            {alerts.map((alert) => (
              <article key={alert.alert_id} className="alert-item">
                <div className="alert-head">
                  <span className={`severity ${alert.severity}`}>{alert.severity}</span>
                  <strong>{alert.alert_id}</strong>
                </div>
                <p>Account: {alert.account_id}</p>
                <p>Transaction: {alert.transaction_id}</p>
                <p>Score: {alert.score}</p>
                <ul>
                  {alert.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>Open investigations</h2>
            <button>New case</button>
          </div>

          <div className="case-list">
            {cases.map((caseItem) => (
              <div key={caseItem.case_id} className="case-card">
                <div className="case-row">
                  <strong>{caseItem.case_id}</strong>
                  <span className={`case-status ${caseItem.status}`}>{caseItem.status}</span>
                </div>
                <p>Account: {caseItem.account_id}</p>
                <p>Analyst: {caseItem.analyst}</p>
                <p>{caseItem.summary}</p>
              </div>
            ))}
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
