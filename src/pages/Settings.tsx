import { useState } from 'react';
import { Save } from 'lucide-react';
import { useSafety } from '../context/SafetyContext';
import { SystemSettings } from '../types';

const ruleFields: Array<[keyof SystemSettings, string]> = [
  ['helmetRequired', 'Helmet required'],
  ['vestRequired', 'Safety vest required'],
  ['glovesRequired', 'Gloves required'],
  ['shoesRequired', 'Protective footwear required'],
  ['maskRequired', 'Face mask required'],
  ['gogglesRequired', 'Safety goggles / eye protection required'],
];

export default function Settings() {
  const { settings, updateSettings } = useSafety();
  const [saved, setSaved] = useState(false);
  const saveSettings = () => { updateSettings(settings); setSaved(true); window.setTimeout(() => setSaved(false), 2000); };

  const handleAlertToggle = async (key: 'audioAlert' | 'browserNotification', checked: boolean) => {
    if (key === 'browserNotification' && checked) {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        const permission = await Notification.requestPermission();
        updateSettings({ browserNotification: permission === 'granted' });
        return;
      }
    }
    updateSettings({ [key]: checked });
  };

  return <div className="mx-auto max-w-3xl space-y-6 pb-12">
    <header><p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">CONFIGURATION</p><h1 className="mt-2 text-3xl font-bold text-white">Settings</h1><p className="mt-1 text-sm text-slate-400">Configure rules, alerts, and the current input source.</p></header>
    <section className="space-y-6 rounded-xl border border-slate-800 bg-slate-900/70 p-6">
      <fieldset><legend className="text-sm font-semibold text-white">Safety rules</legend><div className="mt-4 grid gap-3 sm:grid-cols-2">{ruleFields.map(([key, label]) => <label key={key} className="flex items-center gap-3 text-sm text-slate-300"><input type="checkbox" checked={Boolean(settings[key])} onChange={(event) => updateSettings({ [key]: event.target.checked })} className="h-4 w-4 accent-blue-600" />{label}</label>)}</div></fieldset>
      <fieldset className="border-t border-slate-800 pt-6"><legend className="text-sm font-semibold text-white">AI settings</legend><label className="mt-4 block text-sm text-slate-300">Confidence threshold<input type="number" min="0" max="1" step="0.05" value={settings.confidenceThreshold} onChange={(event) => updateSettings({ confidenceThreshold: Number(event.target.value) })} className="mt-2 block w-32 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label></fieldset>
      <fieldset className="border-t border-slate-800 pt-6"><legend className="text-sm font-semibold text-white">Alerts</legend><div className="mt-4 space-y-3">{([['audioAlert', 'Audio alert'], ['browserNotification', 'Browser notification']] as const).map(([key, label]) => <label key={key} className="flex items-center gap-3 text-sm text-slate-300"><input type="checkbox" checked={Boolean(settings[key])} onChange={(event) => void handleAlertToggle(key, event.target.checked)} className="h-4 w-4 accent-blue-600" />{label}</label>)}</div></fieldset>
      <fieldset className="border-t border-slate-800 pt-6"><legend className="text-sm font-semibold text-white">Camera settings</legend><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm text-slate-300">Camera name<input value={settings.cameraName} onChange={(event) => updateSettings({ cameraName: event.target.value })} className="mt-2 block w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label><label className="text-sm text-slate-300">Source type<select value={settings.sourceType} onChange={(event) => updateSettings({ sourceType: event.target.value as SystemSettings['sourceType'] })} className="mt-2 block w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="LIVE_CAMERA">Live Camera</option><option value="RECORDED_VIDEO">Recorded Video</option><option value="IMAGE">Image</option><option value="RTSP_STREAM">RTSP/IP Camera (future)</option></select></label></div></fieldset>
      <div className="flex items-center justify-between border-t border-slate-800 pt-5"><span className="text-xs text-slate-500">Settings are stored locally. RTSP, email, SMS, MQTT, and PLC integrations are not connected.</span><button onClick={saveSettings} className="inline-flex shrink-0 items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"><Save size={15} />{saved ? 'Settings Saved' : 'Save Settings'}</button></div>
    </section>
  </div>;
}
