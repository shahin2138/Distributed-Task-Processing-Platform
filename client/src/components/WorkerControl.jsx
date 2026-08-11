import React, { useState } from 'react';
import { Cpu, Plus, Sliders, Play, Pause, AlertOctagon, CheckCircle2 } from 'lucide-react';

export default function WorkerControl({ workers, queues, config, onUpdateConfig, onAddWorker, onToggleWorker }) {
  const [newWorkerName, setNewWorkerName] = useState('');
  const [selectedQueueId, setSelectedQueueId] = useState(queues[0]?.id || 'queue-order-processing');

  const handleConfigChange = (field, val) => {
    onUpdateConfig({
      ...config,
      [field]: val
    });
  };

  const handleCreateWorker = (e) => {
    e.preventDefault();
    if (!newWorkerName) return;
    onAddWorker(newWorkerName, selectedQueueId);
    setNewWorkerName('');
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
      {/* Worker Pool Configuration */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sliders size={18} color="var(--accent-purple)" /> Simulation & Failure Injection Controls
        </h3>

        {/* Global Pool Toggle */}
        <div style={{ background: 'var(--bg-surface)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Background Task Processing Loop</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status: {config?.isPoolRunning ? '🟢 Running & Polling Queues' : '🔴 Paused'}</div>
          </div>
          <button className={config?.isPoolRunning ? 'btn-secondary' : 'btn-primary'} onClick={() => handleConfigChange('running', !config?.isPoolRunning)}>
            {config?.isPoolRunning ? <Pause size={16} /> : <Play size={16} />}
            {config?.isPoolRunning ? 'Pause Engine' : 'Resume Engine'}
          </button>
        </div>

        {/* Failure Rate Slider */}
        <div className="form-group" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertOctagon size={16} color="var(--accent-red)" /> Artificial Failure Injection Rate:
            </label>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-red)' }}>
              {((config?.simulatedFailureRate || 0) * 100).toFixed(0)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={config?.simulatedFailureRate || 0}
            onChange={(e) => handleConfigChange('failureRate', parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent-red)' }}
          />
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Inject random execution failures into workers to test automatic retry exponential backoff and Dead Letter Queue (DLQ) offloading!
          </div>
        </div>

        {/* Processing Delay Slider */}
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Cpu size={16} color="var(--accent-cyan)" /> Simulated Processing Execution Latency:
            </label>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-cyan)' }}>
              {config?.processingDelayMs || 1200} ms
            </span>
          </div>
          <input
            type="range"
            min="100"
            max="4000"
            step="100"
            value={config?.processingDelayMs || 1200}
            onChange={(e) => handleConfigChange('delayMs', parseInt(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
          />
        </div>
      </div>

      {/* Worker Nodes Control */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Cpu size={18} color="var(--accent-purple)" /> Provision & Scale Worker Pool ({workers.length})
        </h3>

        {/* Add Worker Form */}
        <form onSubmit={handleCreateWorker} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '10px', marginBottom: '20px' }}>
          <input
            className="form-input"
            placeholder="Worker Node Name"
            value={newWorkerName}
            onChange={e => setNewWorkerName(e.target.value)}
            required
          />
          <select className="form-select" value={selectedQueueId} onChange={e => setSelectedQueueId(e.target.value)}>
            {queues.map(q => (
              <option key={q.id} value={q.id}>{q.name}</option>
            ))}
          </select>
          <button type="submit" className="btn-primary" style={{ padding: '8px 14px' }}>
            <Plus size={16} /> Add Node
          </button>
        </form>

        {/* Active Worker List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '350px', overflowY: 'auto' }}>
          {workers.map((w) => (
            <div key={w.id} style={{ background: 'var(--bg-surface)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{w.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Assigned: <strong>{w.assigned_queue_name || 'Unassigned'}</strong></div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className={`badge ${w.status === 'BUSY' ? 'badge-orange' : w.status === 'PAUSED' ? 'badge-red' : 'badge-green'}`}>
                  {w.status}
                </span>
                <button
                  className="btn-secondary"
                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  onClick={() => onToggleWorker(w.id, w.status === 'PAUSED' ? 'IDLE' : 'PAUSED')}
                >
                  {w.status === 'PAUSED' ? <Play size={12} /> : <Pause size={12} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
