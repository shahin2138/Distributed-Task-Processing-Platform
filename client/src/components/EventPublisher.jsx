import React, { useState } from 'react';
import { Send, Zap, Play, CheckCircle } from 'lucide-react';

export default function EventPublisher({ buses, onPublish }) {
  const [busId, setBusId] = useState('bus-default');
  const [source, setSource] = useState('ecommerce.order');
  const [detailType, setDetailType] = useState('OrderCreated');
  const [payloadStr, setPayloadStr] = useState(JSON.stringify({
    orderId: 'ORD-9842',
    customerId: 'cust_3301',
    amount: 299.50,
    status: 'CONFIRMED',
    items: ['MacBook Pro M3', 'USB-C Cable']
  }, null, 2));

  const [publishResult, setPublishResult] = useState(null);
  const [isBursting, setIsBursting] = useState(false);

  const handlePublish = async (e) => {
    e.preventDefault();
    try {
      const detail = JSON.parse(payloadStr);
      const res = await onPublish({ bus_id: busId, source, detail_type: detailType, detail });
      setPublishResult(res);
    } catch (err) {
      alert('Invalid JSON Payload: ' + err.message);
    }
  };

  const loadPreset = (presetName) => {
    if (presetName === 'order') {
      setSource('ecommerce.order');
      setDetailType('OrderCreated');
      setPayloadStr(JSON.stringify({ orderId: 'ORD-' + Math.floor(Math.random()*9000+1000), amount: 199.99, status: 'CONFIRMED' }, null, 2));
    } else if (presetName === 'user') {
      setSource('user.auth');
      setDetailType('UserRegistered');
      setPayloadStr(JSON.stringify({ userId: 'usr_' + Math.floor(Math.random()*9000+1000), email: 'user@domain.com', plan: 'PREMIUM' }, null, 2));
    } else if (presetName === 'payment_failed') {
      setSource('payment.gateway');
      setDetailType('PaymentFailed');
      setPayloadStr(JSON.stringify({ txId: 'tx_' + Math.floor(Math.random()*9000+1000), amount: 450.00, status: 'PAYMENT_DECLINED', forceFail: true }, null, 2));
    }
  };

  const handleBurstTrigger = async (count = 10) => {
    setIsBursting(true);
    for (let i = 0; i < count; i++) {
      const eventTypes = [
        { source: 'ecommerce.order', detail_type: 'OrderCreated', detail: { orderId: 'ORD-' + (1000 + i), amount: (Math.random() * 200).toFixed(2), status: 'CONFIRMED' } },
        { source: 'user.auth', detail_type: 'UserRegistered', detail: { userId: 'usr_' + (2000 + i), email: `user${i}@test.com` } },
        { source: 'payment.gateway', detail_type: 'PaymentFailed', detail: { txId: 'tx_' + (3000 + i), forceFail: i % 3 === 0 } }
      ];
      const randomEvt = eventTypes[i % eventTypes.length];
      await onPublish({ bus_id: busId, ...randomEvt });
      await new Promise(r => setTimeout(r, 200));
    }
    setIsBursting(false);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
      {/* Event Publisher Form */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Zap size={18} color="var(--primary-orange)" /> EventBridge Ingestion Publisher
        </h3>

        {/* Preset Selector */}
        <div style={{ marginBottom: '18px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', alignSelf: 'center' }}>Presets:</span>
          <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.775rem' }} onClick={() => loadPreset('order')}>📦 Order Created</button>
          <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.775rem' }} onClick={() => loadPreset('user')}>👤 User Signup</button>
          <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.775rem', borderColor: 'rgba(239, 68, 68, 0.4)', color: '#f87171' }} onClick={() => loadPreset('payment_failed')}>💥 Payment Failed</button>
        </div>

        <form onSubmit={handlePublish}>
          <div className="form-group">
            <label>Event Bus</label>
            <select className="form-select" value={busId} onChange={(e) => setBusId(e.target.value)}>
              {buses.map(b => (
                <option key={b.id} value={b.id}>{b.name} ({b.description})</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label>Event Source (e.g. ecommerce.order)</label>
              <input className="form-input" value={source} onChange={(e) => setSource(e.target.value)} required />
            </div>

            <div className="form-group">
              <label>Detail Type (e.g. OrderCreated)</label>
              <input className="form-input" value={detailType} onChange={(e) => setDetailType(e.target.value)} required />
            </div>
          </div>

          <div className="form-group">
            <label>Event Detail Payload (JSON)</label>
            <textarea className="form-textarea" value={payloadStr} onChange={(e) => setPayloadStr(e.target.value)} required />
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
            <button type="submit" className="btn-primary" style={{ flex: 1 }}>
              <Send size={16} /> Publish Event
            </button>
            <button type="button" className="btn-secondary" onClick={() => handleBurstTrigger(15)} disabled={isBursting}>
              <Play size={16} color="var(--accent-cyan)" /> {isBursting ? 'Publishing Burst...' : 'Fire 15x Burst Traffic'}
            </button>
          </div>
        </form>
      </div>

      {/* Execution Response Inspector */}
      <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle size={18} color="var(--accent-green)" /> Ingestion & Routing Result
        </h3>

        {publishResult ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ background: 'var(--bg-surface)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Event ID:</span>
                <span className="badge badge-orange" style={{ fontFamily: 'var(--font-mono)' }}>{publishResult.result?.eventId}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Matched Rules Count:</span>
                <span className="badge badge-cyan" style={{ fontSize: '0.9rem' }}>{publishResult.result?.matchedRulesCount} Rule(s)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Routing Status:</span>
                <span className="badge badge-green">{publishResult.result?.status}</span>
              </div>
            </div>

            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-muted)', marginTop: '8px' }}>Matched Destination Queues:</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {publishResult.result?.matchedTargetQueues?.map((t, idx) => (
                <div key={idx} style={{ background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.3)', padding: '10px 14px', borderRadius: '6px', fontSize: '0.85rem' }}>
                  <div style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>Rule: "{t.ruleName}"</div>
                  <div style={{ color: 'var(--text-muted)', marginTop: '2px' }}>➡️ Target Queue: <strong>{t.queueName}</strong></div>
                </div>
              ))}
              {publishResult.result?.matchedRulesCount === 0 && (
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '12px', borderRadius: '6px', fontSize: '0.85rem', color: '#f87171' }}>
                  ⚠️ No active rules matched this event source/detail-type pattern. Message was not routed.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-dim)', textAlign: 'center', fontSize: '0.9rem' }}>
            Publish an event on the left form to inspect the routing output and target queues in real-time.
          </div>
        )}
      </div>
    </div>
  );
}
