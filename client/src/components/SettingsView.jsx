import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Save, 
  Check, 
  RefreshCw, 
  Server, 
  ShieldCheck, 
  Sliders, 
  Info,
  Terminal,
  Laptop,
  Users
} from 'lucide-react';
import { authFetch } from '../session';
import { useI18n } from '../i18n';

export default function SettingsView() {
  const { t } = useI18n();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  const fetchSettings = async () => {
    try {
      const res = await authFetch('/api/settings');
      const data = await res.json();
      setSettings(data);
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const res = await authFetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (data.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (err) {
      console.error('Failed to update settings:', err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      <div>
        <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-cyan-400" />
          <span>{t('set.title')}</span>
        </h1>
        <p className="text-slate-400 text-xs mt-1">
          {t('set.sub')}
        </p>
      </div>

      {loading || !settings ? (
        <div className="flex justify-center items-center py-20">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          
          {/* Card: Core Settings */}
          <div className="card-glass p-6 rounded-xl space-y-4">
            <h2 className="font-bold text-sm text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-cyan-400" />
              <span>Máy Chủ Cục Bộ (Local Server)</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Cổng Lắng Nghe (Port):</label>
                <input
                  type="number"
                  value={settings.port || 3600}
                  onChange={(e) => setSettings({ ...settings, port: parseInt(e.target.value) || 3600 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">Khởi động lại server để áp dụng thay đổi cổng.</span>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Host Lắng Nghe:</label>
                <input
                  type="text"
                  value={settings.host || '0.0.0.0'}
                  onChange={(e) => setSettings({ ...settings, host: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">0.0.0.0 cho phép truy cập từ mạng LAN nội bộ.</span>
              </div>
            </div>

            <div className="pt-2">
              <label className="block text-slate-300 font-medium mb-1 text-xs">Mô Hình Mặc Định Khi Không Khai Báo:</label>
              <input
                type="text"
                value={settings.defaultModel || 'wenker-deepseek-r1-free'}
                onChange={(e) => setSettings({ ...settings, defaultModel: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono text-xs focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Card: Smart Fallback */}
          <div className="card-glass p-6 rounded-xl space-y-4">
            <h2 className="font-bold text-sm text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Cơ Chế Dự Phòng Thông Minh (Smart Failover)</span>
            </h2>

            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="smartFallbackCheck"
                checked={Boolean(settings.enableSmartFallback)}
                onChange={(e) => setSettings({ ...settings, enableSmartFallback: e.target.checked })}
                className="mt-1 rounded bg-slate-950 border-slate-800 text-cyan-500 focus:ring-cyan-500"
              />
              <div>
                <label htmlFor="smartFallbackCheck" className="text-slate-200 text-xs font-semibold cursor-pointer block">
                  Dự Phòng Khi Nguồn GỐC THỰC SỰ LỖI (429 / 5xx)
                </label>
                <p className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">
                  Khi bật: nếu nhà cung cấp bạn gọi trả lỗi upstream thật (hết hạn mức 429, sập 5xx), router đi theo chuỗi dự phòng trong tab <strong>Định Tuyến</strong> và <em>ghi rõ trong Nhật Ký</em> provider nào thực sự trả lời (nhãn "dự phòng"). <strong>Từ bản này, router KHÔNG âm thầm chuyển provider khi thiếu API Key nữa</strong> — thiếu key là trả lỗi 401 thật, để bạn không bị ảo tưởng model đó đang chạy.
                </p>
              </div>
            </div>
          </div>

          {/* Card: WENKER Cloud Quota */}
          <div className="card-glass p-6 rounded-xl space-y-4">
            <h2 className="font-bold text-sm text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" />
              <span>Hạn mức WENKER Cloud theo ngày</span>
            </h2>
            <div>
              <label className="block text-slate-300 font-medium mb-1 text-xs">
                Số lượt miễn phí cho mỗi tài khoản đăng nhập (mỗi ngày):
              </label>
              <input
                type="number"
                min="0"
                value={settings.wenkerCloudDailyLimit ?? 50}
                onChange={(e) => setSettings({ ...settings, wenkerCloudDailyLimit: Number(e.target.value) })}
                className="w-40 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono text-xs focus:border-cyan-500 focus:outline-none"
              />
              <p className="text-slate-400 text-[11px] mt-1.5 leading-relaxed">
                Áp dụng cho 9 tài khoản đăng nhập (mật khẩu 1&ndash;9) khi gọi model WENKER Cloud / Pollinations /
                DuckDuckGo. Khi hết lượt, API trả về <strong>409</strong> và người dùng có thể xem quảng cáo để nhận
                thêm 10 lượt (tối đa 30 lượt thưởng/ngày). Đặt <strong>0</strong> để không giới hạn. Giá trị mới có
                hiệu lực từ ngày kế tiếp với các tài khoản đã phát sinh hôm nay.
              </p>
            </div>
          </div>

          {/* Card: About */}
          <div className="card-glass p-6 rounded-xl space-y-3">
            <h2 className="font-bold text-sm text-white flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-400" />
              <span>Thông Tin Ứng Dụng</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-500 text-[10px] block">Phiên Bản</span>
                <span className="font-bold text-slate-200">{settings.version || '2.0.0'}</span>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-500 text-[10px] block">Bản Quyền</span>
                <span className="font-bold text-slate-200">Mã Nguồn Mở (MIT)</span>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-500 text-[10px] block">Giao Thức</span>
                <span className="font-bold text-cyan-400">OpenAI + Anthropic</span>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-500 text-[10px] block">Môi Trường</span>
                <span className="font-bold text-emerald-400">Local Zero-Latency</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="btn-primary text-xs"
            >
              {saved ? <Check className="w-4 h-4 text-emerald-300" /> : <Save className="w-4 h-4" />}
              <span>{saved ? 'Đã Lưu Thành Công' : 'Lưu Cấu Hình'}</span>
            </button>
          </div>

        </form>
      )}

    </div>
  );
}
