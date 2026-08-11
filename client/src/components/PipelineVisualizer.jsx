import React from 'react';
import { Cpu, Zap, Layers, HardDrive, AlertTriangle, Play, RefreshCw } from 'lucide-react';

export default function PipelineVisualizer({ overview, rules, workers, dlqRecords, logs, onQuickPublish, onRefresh }) {
  const stats = overview?.stats || {};
  const queues = overview?.queues || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Quick Actions Bar */}
      <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Zap size={20} color="var(--primary-orange)" />
          <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Simulate Live Event Trigger:</span>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => onQuickPublish('ecommerce.order', 'OrderCreated', { orderId: 'ORD-' + Math.floor(Math.random()*9000+1000), amount: 149.99, status: 'CONFIRMED' })}>
             New Order ($149.99)
          </button>
          <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => onQuickPublish('user.auth', 'UserRegistered', { userId: 'usr_' + Math.floor(Math.random()*9000+1000), email: 'alex@example.com' })}>
             User Signup
          </button>
          <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem', borderColor: 'rgba(239, 68, 68, 0.4)', color: '#f87171' }} onClick={() => onQuickPublish('payment.gateway', 'PaymentFailed', { txId: 'tx_' + Math.floor(Math.random()*9000+1000), status: 'PAYMENT_DECLINED', forceFail: true })}>
             Payment Failure (Force DLQ)
          </button>
          <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={onRefresh}>
            <RefreshCw size={14} /> Refresh Metrics
          </button>
        </div>
      </div>

      {/* Visual Pipeline Architecture Diagrams */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={18} color="var(--accent-cyan)" /> Distributed Task Processing Pipeline Architecture
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', position: 'relative' }}>
          {/* Node 1: Event Ingestion */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="badge badge-orange">Producers</span>
              <Zap size={16} color="var(--primary-orange)" />
            </div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>Event Ingestion</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Published:</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary-orange)', fontFamily: 'var(--font-mono)' }}>
              {stats.totalEvents || 0}
            </div>
          </div>

          {/* Node 2: EventBridge Bus & Rules */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="badge badge-cyan">EventBridge</span>
              <Layers size={16} color="var(--accent-cyan)" />
            </div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>Rules Router</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Active Filter Rules:</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
              {rules?.length || 0}
            </div>
          </div>

          {/* Node 3: Target Queues */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="badge badge-green">SQS Queues</span>
              <HardDrive size={16} color="var(--accent-green)" />
            </div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>Queue System</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Messages Pending:</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-green)', fontFamily: 'var(--font-mono)' }}>
              {stats.totalPendingMessages || 0}
            </div>
          </div>

          {/* Node 4: Worker Pool */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="badge badge-purple">Workers</span>
              <Cpu size={16} color="var(--accent-purple)" />
            </div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>Worker Pool</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Active Nodes:</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-purple)', fontFamily: 'var(--font-mono)' }}>
              {stats.activeWorkers || 0}
            </div>
          </div>

          {/* Node 5: Dead Letter Queue */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="badge badge-red">DLQ</span>
              <AlertTriangle size={16} color="var(--accent-red)" />
            </div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>Dead Letter Queue</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Unresolved Errors:</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-red)', fontFamily: 'var(--font-mono)' }}>
              {stats.dlqUnresolvedCount || 0}
            </div>
          </div>
        </div>
      </div>

      {/* Queue Depth Breakdown Table */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div className="glass-card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <HardDrive size={16} color="var(--accent-green)" /> Queue Depth & Status Summary
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {queues.map((q) => (
              <div key={q.id} style={{ background: 'var(--bg-surface)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{q.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Retries: max {q.max_retries} | Lock: {q.visibility_timeout_sec}s</div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <span className="badge badge-cyan">Pending: {q.pending_count || 0}</span>
                  <span className="badge badge-purple">Processing: {q.processing_count || 0}</span>
                  <span className="badge badge-green">Done: {q.completed_count || 0}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Worker Pool Activity */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={16} color="var(--accent-purple)" /> Active Workers Activity
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {workers.map((w) => (
              <div key={w.id} style={{ background: 'var(--bg-surface)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{w.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Assigned: {w.assigned_queue_name || 'Unassigned'}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className={`badge ${w.status === 'BUSY' ? 'badge-orange' : 'badge-green'}`}>
                    {w.status === 'BUSY' ? '⚡ BUSY' : '🟢 IDLE'}
                  </span>
                  <span style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    ✅ {w.processed_count} | ❌ {w.failed_count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Real-time System Telemetry Terminal */}
      <div className="terminal-window">
        <div className="terminal-header">
          <span>SYSTEM EXECUTION AUDIT TERMINAL LOGS</span>
          <span style={{ color: 'var(--accent-green)' }}>● LIVE WEBSOCKET TELEMETRY</span>
        </div>
        <div className="terminal-body">
          {logs.map((log) => (
            <div key={log.id} className="log-line">
              <span className="log-time">{new Date(log.created_at).toLocaleTimeString()}</span>
              <span className="log-component">[{log.component}]</span>
              <span className={`log-level-${log.log_level}`}>{log.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
