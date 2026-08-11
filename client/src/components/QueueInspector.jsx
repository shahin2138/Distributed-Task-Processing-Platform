import React, { useState, useEffect } from 'react';
import { HardDrive, AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';

export default function QueueInspector({ queues, dlqRecords, onRedriveDLQ, onRefresh }) {
  const [selectedQueueId, setSelectedQueueId] = useState(queues[0]?.id || 'queue-order-processing');
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [activeTab, setActiveTab] = useState('queues'); // 'queues' or 'dlq'

  useEffect(() => {
    if (selectedQueueId) {
      fetchQueueMessages(selectedQueueId);
    }
  }, [selectedQueueId]);

  const fetchQueueMessages = async (qid) => {
    setLoadingMsgs(true);
    try {
      const res = await fetch(`/api/queues/${qid}/messages`);
      const data = await res.json();
      if (data.success) {
        setMessages(data.messages);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMsgs(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Tab Selector Bar */}
      <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className={`tab-btn ${activeTab === 'queues' ? 'active' : ''}`} onClick={() => setActiveTab('queues')}>
            <HardDrive size={16} /> SQS Target Queues ({queues.length})
          </button>
          <button className={`tab-btn ${activeTab === 'dlq' ? 'active' : ''}`} onClick={() => setActiveTab('dlq')}>
            <AlertTriangle size={16} color="var(--accent-red)" /> Dead Letter Queue ({dlqRecords.length})
          </button>
        </div>
        <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={onRefresh}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {activeTab === 'queues' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px' }}>
          {/* Queue Selector List */}
          <div className="glass-card" style={{ padding: '16px' }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '12px' }}>SELECT QUEUE:</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {queues.map((q) => (
                <div
                  key={q.id}
                  onClick={() => setSelectedQueueId(q.id)}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: selectedQueueId === q.id ? 'var(--bg-surface-elevated)' : 'transparent',
                    border: selectedQueueId === q.id ? '1px solid var(--primary-orange)' : '1px solid transparent',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: selectedQueueId === q.id ? 'var(--primary-orange)' : 'var(--text-main)' }}>{q.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', gap: '8px' }}>
                    <span>Pending: <strong>{q.pending_count}</strong></span>
                    <span>Done: <strong>{q.completed_count}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Messages Table */}
          <div className="glass-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>
                Queue Messages for: <span style={{ color: 'var(--primary-orange)' }}>{queues.find(q => q.id === selectedQueueId)?.name}</span>
              </h3>
              <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => fetchQueueMessages(selectedQueueId)}>
                <RefreshCw size={12} /> Reload Messages
              </button>
            </div>

            {loadingMsgs ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading queue messages...</div>
            ) : messages.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)' }}>No messages found in this queue right now.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '550px', overflowY: 'auto' }}>
                {messages.map((m) => (
                  <div key={m.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>{m.id}</span>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span className={`badge ${m.status === 'COMPLETED' ? 'badge-green' : m.status === 'PROCESSING' ? 'badge-orange' : m.status === 'DLQ' ? 'badge-red' : 'badge-cyan'}`}>
                          {m.status}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Retry Count: {m.retry_count}</span>
                      </div>
                    </div>

                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Payload:</div>
                    <pre className="code-block" style={{ fontSize: '0.75rem', padding: '8px' }}>{m.payload_json}</pre>

                    {m.error_message && (
                      <div style={{ marginTop: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '6px 10px', borderRadius: '4px', fontSize: '0.75rem' }}>
                        ⚠️ Exception: {m.error_message}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Dead Letter Queue (DLQ) Inspector & Re-drive Panel */
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} color="var(--accent-red)" /> Dead Letter Queue (DLQ) Inspector & Manual Re-drive
          </h3>

          {dlqRecords.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              🎉 Dead Letter Queue is currently clear! No unhandled message failures.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {dlqRecords.map((d) => (
                <div key={d.id} style={{ background: 'var(--bg-surface)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div>
                      <span style={{ fontWeight: 700, color: 'var(--accent-red)', fontSize: '0.9rem' }}>DLQ Item: {d.id}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '12px' }}>Original Queue: <strong>{d.original_queue_name}</strong></span>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <span className={`badge ${d.status === 'UNRESOLVED' ? 'badge-red' : 'badge-green'}`}>{d.status}</span>
                      {d.status === 'UNRESOLVED' && (
                        <button className="btn-primary" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => onRedriveDLQ(d.id)}>
                          <RotateCcw size={12} /> Re-drive to Queue
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ fontSize: '0.8rem', color: '#f87171', marginBottom: '8px' }}>
                    <strong>Fail Reason:</strong> {d.fail_reason} (Attempts: {d.retry_attempts})
                  </div>

                  <pre className="code-block" style={{ fontSize: '0.75rem', padding: '8px' }}>{d.payload_json}</pre>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
