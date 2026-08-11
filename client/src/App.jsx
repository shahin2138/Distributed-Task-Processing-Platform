import React, { useState, useEffect } from 'react';
import { Zap, Layers, HardDrive, Cpu, AlertTriangle, Database, Activity, RefreshCw } from 'lucide-react';
import PipelineVisualizer from './components/PipelineVisualizer.jsx';
import EventPublisher from './components/EventPublisher.jsx';
import RuleManager from './components/RuleManager.jsx';
import QueueInspector from './components/QueueInspector.jsx';
import WorkerControl from './components/WorkerControl.jsx';
import SqlViewer from './components/SqlViewer.jsx';

export default function App() {
  const [activeTab, setActiveTab] = useState('pipeline');
  const [overview, setOverview] = useState(null);
  const [rules, setRules] = useState([]);
  const [buses, setBuses] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [workerConfig, setWorkerConfig] = useState(null);
  const [dlqRecords, setDlqRecords] = useState([]);
  const [logs, setLogs] = useState([]);
  const [wsConnected, setWsConnected] = useState(false);

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 3000);

    // Setup WebSocket connection
    let ws = null;
    const connectWS = () => {
      const wsUrl = `ws://${window.location.hostname}:5000`;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'CONNECTED') {
            setWsConnected(true);
          } else {
            // Trigger refresh on dynamic telemetry events
            fetchAllData();
          }
        } catch (e) {}
      };

      ws.onclose = () => {
        setWsConnected(false);
        setTimeout(connectWS, 3000);
      };
    };

    connectWS();

    return () => {
      clearInterval(interval);
      if (ws) ws.close();
    };
  }, []);

  const fetchAllData = async () => {
    try {
      const [ovRes, rulesRes, busesRes, workersRes, dlqRes, logsRes] = await Promise.all([
        fetch('/api/overview'),
        fetch('/api/rules'),
        fetch('/api/buses'),
        fetch('/api/workers'),
        fetch('/api/dlq'),
        fetch('/api/logs?limit=50')
      ]);

      const ovData = await ovRes.json();
      const rulesData = await rulesRes.json();
      const busesData = await busesRes.json();
      const workersData = await workersRes.json();
      const dlqData = await dlqRes.json();
      const logsData = await logsRes.json();

      if (ovData.success) setOverview(ovData);
      if (rulesData.success) setRules(rulesData.rules);
      if (busesData.success) setBuses(busesData.buses);
      if (workersData.success) {
        setWorkers(workersData.workers);
        setWorkerConfig(workersData.config);
      }
      if (dlqData.success) setDlqRecords(dlqData.records);
      if (logsData.success) setLogs(logsData.logs);
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  const handlePublishEvent = async (eventData) => {
    const res = await fetch('/api/events/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData)
    });
    const data = await res.json();
    fetchAllData();
    return data;
  };

  const handleCreateRule = async (ruleData) => {
    await fetch('/api/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ruleData)
    });
    fetchAllData();
  };

  const handleToggleRule = async (ruleId, is_active) => {
    await fetch(`/api/rules/${ruleId}/toggle`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active })
    });
    fetchAllData();
  };

  const handleDeleteRule = async (ruleId) => {
    await fetch(`/api/rules/${ruleId}`, { method: 'DELETE' });
    fetchAllData();
  };

  const handleRedriveDLQ = async (dlqId) => {
    await fetch(`/api/dlq/redrive/${dlqId}`, { method: 'POST' });
    fetchAllData();
  };

  const handleUpdateWorkerConfig = async (config) => {
    await fetch('/api/workers/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    fetchAllData();
  };

  const handleAddWorker = async (name, queueId) => {
    await fetch('/api/workers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, queueId })
    });
    fetchAllData();
  };

  const handleToggleWorker = async (workerId, status) => {
    await fetch(`/api/workers/${workerId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    fetchAllData();
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header Bar */}
      <header className="app-header">
        <div className="brand-logo">
          <Zap size={24} color="var(--primary-orange)" />
          <span>EventGrid Platform</span>
          <span className="badge badge-orange" style={{ fontSize: '0.65rem' }}>MINI AWS EVENTBRIDGE + SQS</span>
        </div>

        {/* Center Tabs Navigation */}
        <nav className="nav-tabs">
          <button className={`tab-btn ${activeTab === 'pipeline' ? 'active' : ''}`} onClick={() => setActiveTab('pipeline')}>
            <Activity size={16} /> Pipeline Visualizer
          </button>
          <button className={`tab-btn ${activeTab === 'publisher' ? 'active' : ''}`} onClick={() => setActiveTab('publisher')}>
            <Zap size={16} /> Event Publisher
          </button>
          <button className={`tab-btn ${activeTab === 'rules' ? 'active' : ''}`} onClick={() => setActiveTab('rules')}>
            <Layers size={16} /> Event Rules ({rules.length})
          </button>
          <button className={`tab-btn ${activeTab === 'queues' ? 'active' : ''}`} onClick={() => setActiveTab('queues')}>
            <HardDrive size={16} /> SQS & DLQ
          </button>
          <button className={`tab-btn ${activeTab === 'workers' ? 'active' : ''}`} onClick={() => setActiveTab('workers')}>
            <Cpu size={16} /> Workers Pool
          </button>
          <button className={`tab-btn ${activeTab === 'sql' ? 'active' : ''}`} onClick={() => setActiveTab('sql')} style={{ borderColor: 'var(--primary-orange)' }}>
            <Database size={16} color="var(--primary-orange)" /> SQL Reference
          </button>
        </nav>

        {/* WebSocket Stream Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <div className="status-pulse" style={{ background: wsConnected ? 'var(--accent-green)' : 'var(--accent-red)' }} />
          <span>{wsConnected ? 'Real-Time Stream' : 'Connecting WS...'}</span>
        </div>
      </header>

      {/* Main App Workspace */}
      <main style={{ flex: 1, padding: '24px', maxWidth: '1440px', margin: '0 auto', width: '100%' }}>
        {activeTab === 'pipeline' && (
          <PipelineVisualizer
            overview={overview}
            rules={rules}
            workers={workers}
            dlqRecords={dlqRecords}
            logs={logs}
            onQuickPublish={(source, detail_type, detail) => handlePublishEvent({ bus_id: 'bus-default', source, detail_type, detail })}
            onRefresh={fetchAllData}
          />
        )}

        {activeTab === 'publisher' && (
          <EventPublisher
            buses={buses}
            onPublish={handlePublishEvent}
          />
        )}

        {activeTab === 'rules' && (
          <RuleManager
            rules={rules}
            queues={overview?.queues || []}
            buses={buses}
            onCreateRule={handleCreateRule}
            onToggleRule={handleToggleRule}
            onDeleteRule={handleDeleteRule}
          />
        )}

        {activeTab === 'queues' && (
          <QueueInspector
            queues={overview?.queues || []}
            dlqRecords={dlqRecords}
            onRedriveDLQ={handleRedriveDLQ}
            onRefresh={fetchAllData}
          />
        )}

        {activeTab === 'workers' && (
          <WorkerControl
            workers={workers}
            queues={overview?.queues || []}
            config={workerConfig}
            onUpdateConfig={handleUpdateWorkerConfig}
            onAddWorker={handleAddWorker}
            onToggleWorker={handleToggleWorker}
          />
        )}

        {activeTab === 'sql' && (
          <SqlViewer />
        )}
      </main>
    </div>
  );
}
