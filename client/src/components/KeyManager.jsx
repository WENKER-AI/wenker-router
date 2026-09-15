import React, { useState, useEffect } from 'react';
import { 
  Key, 
  Plus, 
  Copy, 
  Check, 
  Trash2, 
  ShieldCheck, 
  RefreshCw, 
  ToggleLeft, 
  ToggleRight,
  Lock,
  AlertCircle
} from 'lucide-react';
import { authFetch } from '../session';
import { useI18n } from '../i18n';

export default function KeyManager() {
  const { t } = useI18n();
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyForm, setNewKeyForm] = useState({
    name: '',
    role: 'admin',
    rateLimit: 1000
  });

  const fetchKeys = async () => {
    try {
      const res = await authFetch('/api/keys');
      const data = await res.json();
      setKeys(data || []);
    } catch (err) {
      console.error('Error fetching keys:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleCreateKey = async (e) => {
    e.preventDefault();
    try {
      const res = await authFetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newKeyForm)
      });
      const data = await res.json();
      if (data.success) {
        setShowCreateModal(false);
        setNewKeyForm({ name: '', role: 'admin', rateLimit: 1000 });
        fetchKeys();
      }
    } catch (err) {
      console.error('Failed to create key:', err);
    }
  };

  const handleDeleteKey = async (id) => {
    if (!confirm(t('keys.deleteConfirm'))) return;
    try {
      await authFetch(`/api/keys/${id}`, { method: 'DELETE' });
      fetchKeys();
    } catch (err) {
      console.error('Failed to delete key:', err);
    }
  };

  const handleToggleKey = async (id) => {
    try {
      const res = await authFetch(`/api/keys/${id}/toggle`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setKeys(prev => prev.map(k => k.id === id ? { ...k, isActive: data.key.isActive } : k));
      }
    } catch (err) {
      console.error('Failed to toggle key:', err);
    }
  };

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <Key className="w-6 h-6 text-cyan-400" />
            <span>{t('keys.title')}</span>
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            {t('keys.sub')}
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary text-xs self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{t('keys.create')}</span>
        </button>
      </div>

      {/* Info Alert */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-start gap-3 text-xs text-slate-300">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-white block mb-0.5">{t('keys.secTitle')}</strong>
          {t('keys.secBody')}
        </div>
      </div>

      {/* Keys Table / Cards */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
        </div>
      ) : (
        <div className="card-glass rounded-xl overflow-hidden border border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-5 py-3.5">{t('keys.colName')}</th>
                  <th className="px-5 py-3.5">{t('keys.colKey')}</th>
                  <th className="px-5 py-3.5">{t('keys.colRole')}</th>
                  <th className="px-5 py-3.5">{t('keys.colUsage')}</th>
                  <th className="px-5 py-3.5">{t('keys.colTokens')}</th>
                  <th className="px-5 py-3.5">{t('keys.colStatus')}</th>
                  <th className="px-5 py-3.5 text-right">{t('keys.colActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {keys.map(k => (
                  <tr key={k.id} className="hover:bg-slate-900/50 transition">
                    <td className="px-5 py-3.5 font-sans font-bold text-slate-200">
                      {k.name}
                    </td>
                    <td className="px-5 py-3.5 text-cyan-300 flex items-center gap-2">
                      <span>{k.key.slice(0, 16)}••••••••</span>
                      <button
                        onClick={() => handleCopy(k.key, k.id)}
                        className="text-slate-400 hover:text-cyan-400 transition"
                        title={t('keys.copyFullTitle')}
                      >
                        {copiedId === k.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-slate-800 text-slate-300 border border-slate-700">
                        {k.role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-300">
                      {k.usageCount || 0}
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 text-[11px]">
                      {(k.promptTokens || 0) + (k.completionTokens || 0)} tokens
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => handleToggleKey(k.id)}
                        className="flex items-center gap-1 font-sans text-[11px]"
                      >
                        {k.isActive ? (
                          <span className="text-emerald-400 flex items-center gap-1 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            {t('keys.active')}
                          </span>
                        ) : (
                          <span className="text-slate-500 flex items-center gap-1 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                            {t('keys.locked')}
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-right font-sans">
                      <button
                        onClick={() => handleDeleteKey(k.id)}
                        className="p-1 text-slate-500 hover:text-rose-400 transition"
                        title={t('keys.deleteTitle')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Create Key */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="card-glass bg-slate-900 border-slate-700 w-full max-w-md p-6 rounded-2xl shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <Plus className="w-5 h-5 text-cyan-400" />
              <span>{t('keys.createTitle')}</span>
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              {t('keys.createSub')}
            </p>

            <form onSubmit={handleCreateKey} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">{t('keys.nameLabel')}</label>
                <input
                  required
                  type="text"
                  value={newKeyForm.name}
                  onChange={(e) => setNewKeyForm({ ...newKeyForm, name: e.target.value })}
                  placeholder={t('keys.namePh')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">{t('keys.roleLabel')}</label>
                <select
                  value={newKeyForm.role}
                  onChange={(e) => setNewKeyForm({ ...newKeyForm, role: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:border-cyan-500 focus:outline-none"
                >
                  <option value="admin">{t('keys.roleAdmin')}</option>
                  <option value="user">{t('keys.roleUser')}</option>
                  <option value="read-only">{t('keys.roleRead')}</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">{t('keys.rateLabel')}</label>
                <input
                  type="number"
                  value={newKeyForm.rateLimit}
                  onChange={(e) => setNewKeyForm({ ...newKeyForm, rateLimit: parseInt(e.target.value) || 1000 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary text-xs"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs"
                >
                  {t('keys.generate')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
