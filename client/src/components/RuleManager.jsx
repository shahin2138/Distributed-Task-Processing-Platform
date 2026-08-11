import React, { useState } from 'react';
import { Layers, Plus, Trash2, CheckCircle2, XCircle } from 'lucide-react';

export default function RuleManager({ rules, queues, buses, onCreateRule, onToggleRule, onDeleteRule }) {
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [eventSource, setEventSource] = useState('ecommerce.order');
  const [detailType, setDetailType] = useState('OrderCreated');
  const [patternJson, setPatternJson] = useState('{"status":"CONFIRMED"}');
  const [targetQueueId, setTargetQueueId] = useState(queues[0]?.id || 'queue-order-processing');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      JSON.parse(patternJson); // Validate JSON
      await onCreateRule({
        bus_id: 'bus-default',
        name,
        description,
        event_source: eventSource,
        detail_type: detailType,
        pattern_json: patternJson,
        target_queue_id: targetQueueId
      });
      setShowModal(false);
      setName('');
      setDescription('');
    } catch (err) {
      alert('Pattern JSON is invalid: ' + err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header */}
      <div className="glass-card" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} color="var(--accent-cyan)" /> EventBridge Pattern Rules Engine
          </h3>
          <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Configure pattern filtering rules that match incoming events and route payloads to SQS target queues.
          </div>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} /> Create New Rule
        </button>
      </div>

      {/* Rules List */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        {rules.map((r) => (
          <div key={r.id} className="glass-card" style={{ padding: '20px', opacity: r.is_active ? 1 : 0.6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>{r.name}</div>
                <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>{r.description || 'No description provided'}</div>
              </div>
              <button 
                onClick={() => onToggleRule(r.id, !r.is_active)} 
                style={{ background: 'transparent', border: 'none', color: r.is_active ? 'var(--accent-green)' : 'var(--text-dim)' }}
                title="Toggle Active State"
              >
                {r.is_active ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem', background: 'var(--bg-surface)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-color)', marginBottom: '14px' }}>
              <div><strong style={{ color: 'var(--text-muted)' }}>Source:</strong> <span style={{ color: 'var(--primary-orange)', fontFamily: 'var(--font-mono)' }}>{r.event_source}</span></div>
              <div><strong style={{ color: 'var(--text-muted)' }}>Detail-Type:</strong> <span style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>{r.detail_type}</span></div>
              <div><strong style={{ color: 'var(--text-muted)' }}>Destination Queue:</strong> <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>{r.target_queue_name}</span></div>
            </div>

            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Pattern Filter JSON:</div>
            <pre className="code-block" style={{ fontSize: '0.75rem', padding: '8px', maxHeight: '80px' }}>{r.pattern_json}</pre>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button 
                style={{ background: 'transparent', border: 'none', color: '#f87171', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }} 
                onClick={() => onDeleteRule(r.id)}
              >
                <Trash2 size={14} /> Delete Rule
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create Rule Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div className="glass-card" style={{ width: '480px', maxWidth: '90vw', padding: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>Create EventBridge Rule</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Rule Name</label>
                <input className="form-input" value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Order Confirmation Filter" />
              </div>
              <div className="form-group">
                <label>Description</label>
                <input className="form-input" value={description} onChange={e => setDescription(e.target.value)} placeholder="Description..." />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Event Source</label>
                  <input className="form-input" value={eventSource} onChange={e => setEventSource(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>Detail-Type</label>
                  <input className="form-input" value={detailType} onChange={e => setDetailType(e.target.value)} required />
                </div>
              </div>
              <div className="form-group">
                <label>Target SQS Queue</label>
                <select className="form-select" value={targetQueueId} onChange={e => setTargetQueueId(e.target.value)}>
                  {queues.map(q => (
                    <option key={q.id} value={q.id}>{q.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Pattern Filter JSON</label>
                <textarea className="form-textarea" value={patternJson} onChange={e => setPatternJson(e.target.value)} style={{ minHeight: '80px' }} />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Create Rule</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
