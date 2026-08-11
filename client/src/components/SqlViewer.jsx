import React, { useState, useEffect } from 'react';
import { Database, FileCode, CheckCircle, Copy, BookOpen } from 'lucide-react';

export default function SqlViewer() {
  const [sqlContent, setSqlContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [viewTab, setViewTab] = useState('full'); // 'full', 'ddl', 'crud'

  useEffect(() => {
    fetchSqlFile();
  }, []);

  const fetchSqlFile = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sql-file');
      const data = await res.json();
      if (data.success) {
        setSqlContent(data.sqlContent);
      }
    } catch (e) {
      console.error('Error fetching SQL file:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(sqlContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner */}
      <div className="glass-card" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database size={20} color="var(--primary-orange)" /> Central SQL Database Catalog (`database.sql`)
          </h3>
          <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Contains all database DDL schemas, indexes, seed data, and explicit CRUD query catalog used across the platform.
          </div>
        </div>

        <button className="btn-secondary" onClick={handleCopy}>
          {copied ? <CheckCircle size={16} color="var(--accent-green)" /> : <Copy size={16} />}
          {copied ? 'Copied to Clipboard!' : 'Copy SQL File'}
        </button>
      </div>

      {/* Code Viewer Container */}
      <div className="glass-card" style={{ padding: '24px' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading database.sql from server...</div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-mono)', fontSize: '0.875rem', color: 'var(--primary-orange)' }}>
                <FileCode size={16} /> database.sql (c:\Users\ADMIN\Desktop\bb_pj\database.sql)
              </div>
              <span className="badge badge-green">Validated DDL & CRUD</span>
            </div>

            <pre className="code-block" style={{ maxHeight: '650px', overflowY: 'auto' }}>
              {sqlContent}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
