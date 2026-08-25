import React, { useMemo, useState } from 'react';
import { Fish, Plus, Ruler, Save, ShieldAlert, Thermometer, Trash2, X } from 'lucide-react';
import type { Pond, SturgeonSpecies } from '../../types';
import {
  PondManualSnapshotInput,
  PondShape,
  PondSpeciesManualGroup,
  pondWithManualSnapshot,
} from '../../types/pondSnapshot';

interface EditableGroup extends PondSpeciesManualGroup {
  chipText: string;
}

interface PondManualSnapshotModalProps {
  pond: Pond;
  species: SturgeonSpecies[];
  onClose: () => void;
  onSave: (input: PondManualSnapshotInput) => { success: boolean; error?: string };
}

function parseChips(text: string): string[] {
  return Array.from(new Set(text.split(/[,،\n]+/).map((value) => value.trim()).filter(Boolean)));
}

function toEditableGroups(pond: Pond): EditableGroup[] {
  const manual = pondWithManualSnapshot(pond);
  const existing = Array.isArray(manual.speciesMix) && manual.speciesMix.length > 0
    ? manual.speciesMix
    : [{
      speciesId: pond.speciesId,
      count: pond.fishCount,
      avgWeightKg: pond.averageWeightKg,
      maleCount: 0,
      femaleCount: 0,
      unknownSexCount: pond.fishCount,
      chipNumbers: [],
    }];

  return existing.map((group) => {
    const male = Number.isInteger(group.maleCount) && group.maleCount >= 0 ? group.maleCount : 0;
    const female = Number.isInteger(group.femaleCount) && group.femaleCount >= 0 ? group.femaleCount : 0;
    const unknown = Number.isInteger(group.unknownSexCount) && group.unknownSexCount >= 0
      ? group.unknownSexCount
      : Math.max(0, group.count - male - female);
    return {
      speciesId: group.speciesId,
      count: group.count,
      avgWeightKg: group.avgWeightKg,
      maleCount: male,
      femaleCount: female,
      unknownSexCount: unknown,
      chipNumbers: group.chipNumbers || [],
      chipText: (group.chipNumbers || []).join(', '),
    };
  });
}

const inputClass = 'w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500';
const labelClass = 'block text-[11px] font-bold text-slate-300 mb-1';

export const PondManualSnapshotModal: React.FC<PondManualSnapshotModalProps> = ({ pond, species, onClose, onSave }) => {
  const manual = pondWithManualSnapshot(pond);
  const [groups, setGroups] = useState<EditableGroup[]>(() => toEditableGroups(pond));
  const [manualTemperature, setManualTemperature] = useState<number>(manual.manualWaterTemperature ?? pond.waterTemperature);
  const [pondShape, setPondShape] = useState<PondShape>(manual.pondShape || 'Other');
  const [lengthMeters, setLengthMeters] = useState<number | undefined>(manual.lengthMeters);
  const [widthMeters, setWidthMeters] = useState<number | undefined>(manual.widthMeters);
  const [depthMeters, setDepthMeters] = useState<number | undefined>(manual.depthMeters);
  const [diameterMeters, setDiameterMeters] = useState<number | undefined>(manual.diameterMeters);
  const [stopFeeding, setStopFeeding] = useState(false);
  const [notes, setNotes] = useState(manual.manualSnapshotNotes || '');
  const [error, setError] = useState<string>('');

  const totals = useMemo(() => {
    const fish = groups.reduce((sum, group) => sum + (Number.isFinite(group.count) ? group.count : 0), 0);
    const biomass = groups.reduce((sum, group) => sum + (Number.isFinite(group.count) && Number.isFinite(group.avgWeightKg) ? group.count * group.avgWeightKg : 0), 0);
    return {
      fish,
      biomass: Number(biomass.toFixed(2)),
      averageWeight: fish > 0 ? Number((biomass / fish).toFixed(3)) : 0,
      male: groups.reduce((sum, group) => sum + group.maleCount, 0),
      female: groups.reduce((sum, group) => sum + group.femaleCount, 0),
      unknown: groups.reduce((sum, group) => sum + group.unknownSexCount, 0),
      chips: groups.reduce((sum, group) => sum + parseChips(group.chipText).length, 0),
    };
  }, [groups]);

  const updateGroup = <K extends keyof EditableGroup>(index: number, key: K, value: EditableGroup[K]) => {
    setGroups((previous) => previous.map((group, groupIndex) => groupIndex === index ? { ...group, [key]: value } : group));
  };

  const addGroup = () => {
    const unusedSpecies = species.find((item) => !groups.some((group) => group.speciesId === item.id));
    if (!unusedSpecies) return;
    setGroups((previous) => [...previous, {
      speciesId: unusedSpecies.id,
      count: 0,
      avgWeightKg: 0,
      maleCount: 0,
      femaleCount: 0,
      unknownSexCount: 0,
      chipNumbers: [],
      chipText: '',
    }]);
  };

  const removeGroup = (index: number) => {
    if (groups.length <= 1) return;
    setGroups((previous) => previous.filter((_, groupIndex) => groupIndex !== index));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!Number.isFinite(manualTemperature) || manualTemperature < 0 || manualTemperature > 40) {
      setError('دمای دستی آب باید بین ۰ تا ۴۰ درجه سانتی‌گراد باشد.');
      return;
    }
    if (notes.trim().length < 3) {
      setError('برای ثبت اصلاح دستی، توضیح/دلیل حداقل سه کاراکتر وارد کنید.');
      return;
    }
    if (!groups.length) {
      setError('حداقل یک ردیف نژاد/گونه لازم است.');
      return;
    }

    const seenSpecies = new Set<string>();
    const seenChips = new Set<string>();
    const normalizedGroups: PondSpeciesManualGroup[] = [];
    for (const group of groups) {
      if (!group.speciesId || seenSpecies.has(group.speciesId)) {
        setError('هر گونه فقط یک‌بار می‌تواند در ترکیب استخر ثبت شود.');
        return;
      }
      if (!Number.isInteger(group.count) || group.count < 0 || !Number.isFinite(group.avgWeightKg) || group.avgWeightKg < 0) {
        setError('تعداد و میانگین وزن هر گونه باید معتبر و غیرمنفی باشد.');
        return;
      }
      if (![group.maleCount, group.femaleCount, group.unknownSexCount].every((value) => Number.isInteger(value) && value >= 0) || group.maleCount + group.femaleCount + group.unknownSexCount !== group.count) {
        setError('جمع نر + ماده + نامشخص باید دقیقاً برابر تعداد همان گونه باشد.');
        return;
      }
      const chips = parseChips(group.chipText);
      if (chips.length > group.count || chips.some((chip) => seenChips.has(chip))) {
        setError('شماره چیپ‌ها نباید تکراری باشند و تعداد آن‌ها نمی‌تواند از تعداد ماهی بیشتر باشد.');
        return;
      }
      chips.forEach((chip) => seenChips.add(chip));
      seenSpecies.add(group.speciesId);
      normalizedGroups.push({
        speciesId: group.speciesId,
        count: group.count,
        avgWeightKg: Number(group.avgWeightKg),
        maleCount: group.maleCount,
        femaleCount: group.femaleCount,
        unknownSexCount: group.unknownSexCount,
        chipNumbers: chips,
      });
    }

    if (pondShape === 'Circular' && (!diameterMeters || diameterMeters <= 0 || !depthMeters || depthMeters <= 0)) {
      setError('برای استخر دایره‌ای، قطر و عمق باید وارد شوند.');
      return;
    }
    if ((pondShape === 'Rectangular' || pondShape === 'Raceway') && (!lengthMeters || lengthMeters <= 0 || !widthMeters || widthMeters <= 0 || !depthMeters || depthMeters <= 0)) {
      setError('برای استخر مستطیلی/کانالی، طول، عرض و عمق باید وارد شوند.');
      return;
    }

    const result = onSave({
      speciesMix: normalizedGroups,
      manualWaterTemperature: Number(manualTemperature),
      pondShape,
      lengthMeters,
      widthMeters,
      depthMeters,
      diameterMeters,
      stopFeeding,
      notes: notes.trim(),
    });
    if (!result.success) {
      setError(result.error || 'ثبت آمار دستی انجام نشد.');
      return;
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-3 md:p-6 backdrop-blur-sm">
      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl w-full max-w-5xl max-h-[94vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/15 rounded-xl border border-amber-500/30">
              <Fish className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">ثبت آمار دستی {pond.name}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Snapshot حسابرسی‌شده موجودی، جنسیت، وزن، دمای دستی، چیپ و ابعاد استخر</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl" aria-label="بستن">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3"><span className="block text-[10px] text-slate-500">کل ماهی</span><strong className="text-white text-sm">{totals.fish}</strong></div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3"><span className="block text-[10px] text-slate-500">بیوماس</span><strong className="text-white text-sm">{totals.biomass} kg</strong></div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3"><span className="block text-[10px] text-slate-500">میانگین وزن</span><strong className="text-amber-300 text-sm">{totals.averageWeight} kg</strong></div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3"><span className="block text-[10px] text-slate-500">نر / ماده</span><strong className="text-white text-sm">{totals.male} / {totals.female}</strong></div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3"><span className="block text-[10px] text-slate-500">نامشخص</span><strong className="text-white text-sm">{totals.unknown}</strong></div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3"><span className="block text-[10px] text-slate-500">چیپ ثبت‌شده</span><strong className="text-cyan-300 text-sm">{totals.chips}</strong></div>
          </div>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-black text-white">ترکیب گونه، جنسیت و میانگین وزن</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">برای هر گونه، جمع تعداد نر + ماده + نامشخص باید با تعداد کل همان ردیف برابر باشد.</p>
              </div>
              <button type="button" onClick={addGroup} disabled={groups.length >= species.length} className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-amber-300 font-bold flex items-center gap-1.5 disabled:opacity-40">
                <Plus className="w-3.5 h-3.5" /> افزودن گونه
              </button>
            </div>

            <div className="space-y-3">
              {groups.map((group, index) => (
                <div key={`${group.speciesId}-${index}`} className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3 md:p-4">
                  <div className="grid grid-cols-2 md:grid-cols-7 gap-2 items-end">
                    <div className="col-span-2 md:col-span-2">
                      <label className={labelClass}>گونه / نژاد</label>
                      <select value={group.speciesId} onChange={(event) => updateGroup(index, 'speciesId', event.target.value)} className={inputClass}>
                        {species.map((item) => <option key={item.id} value={item.id}>{item.faName} — {item.enName}</option>)}
                      </select>
                    </div>
                    <div><label className={labelClass}>تعداد</label><input type="number" min="0" step="1" value={group.count} onChange={(event) => updateGroup(index, 'count', Number(event.target.value))} className={inputClass} /></div>
                    <div><label className={labelClass}>میانگین وزن kg</label><input type="number" min="0" step="0.001" value={group.avgWeightKg} onChange={(event) => updateGroup(index, 'avgWeightKg', Number(event.target.value))} className={inputClass} /></div>
                    <div><label className={labelClass}>نر</label><input type="number" min="0" step="1" value={group.maleCount} onChange={(event) => updateGroup(index, 'maleCount', Number(event.target.value))} className={inputClass} /></div>
                    <div><label className={labelClass}>ماده</label><input type="number" min="0" step="1" value={group.femaleCount} onChange={(event) => updateGroup(index, 'femaleCount', Number(event.target.value))} className={inputClass} /></div>
                    <div className="flex gap-1 items-end"><div className="flex-1"><label className={labelClass}>نامشخص</label><input type="number" min="0" step="1" value={group.unknownSexCount} onChange={(event) => updateGroup(index, 'unknownSexCount', Number(event.target.value))} className={inputClass} /></div><button type="button" onClick={() => removeGroup(index)} disabled={groups.length <= 1} className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 disabled:opacity-30"><Trash2 className="w-4 h-4" /></button></div>
                  </div>
                  <div className="mt-2">
                    <label className={labelClass}>شماره چیپ‌ها — اختیاری (با ویرگول یا Enter جدا کنید)</label>
                    <textarea rows={2} value={group.chipText} onChange={(event) => updateGroup(index, 'chipText', event.target.value)} className={inputClass} placeholder="CHIP-001, CHIP-002" />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-cyan-300"><Thermometer className="w-4 h-4" /><h4 className="text-xs font-black">دمای دستی آب</h4></div>
              <div>
                <label className={labelClass}>دمای ثبت‌شده توسط اپراتور (°C)</label>
                <input type="number" min="0" max="40" step="0.1" value={manualTemperature} onChange={(event) => setManualTemperature(Number(event.target.value))} className={inputClass} />
              </div>
              <p className="text-[10px] leading-5 text-slate-500">این مقدار برای مشاهده و گزارش ذخیره می‌شود و جای تله‌متری معتبر مورد استفاده در قفل ایمنی خوراک را نمی‌گیرد.</p>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-violet-300"><Ruler className="w-4 h-4" /><h4 className="text-xs font-black">شکل و ابعاد استخر</h4></div>
              <div><label className={labelClass}>نوع استخر</label><select value={pondShape} onChange={(event) => setPondShape(event.target.value as PondShape)} className={inputClass}><option value="Other">سایر / بدون ابعاد</option><option value="Circular">دایره‌ای</option><option value="Rectangular">مستطیلی</option><option value="Raceway">کانالی / Raceway</option></select></div>
              {pondShape === 'Circular' && <div className="grid grid-cols-2 gap-2"><div><label className={labelClass}>قطر (m)</label><input type="number" min="0" step="0.01" value={diameterMeters ?? ''} onChange={(event) => setDiameterMeters(event.target.value === '' ? undefined : Number(event.target.value))} className={inputClass} /></div><div><label className={labelClass}>عمق (m)</label><input type="number" min="0" step="0.01" value={depthMeters ?? ''} onChange={(event) => setDepthMeters(event.target.value === '' ? undefined : Number(event.target.value))} className={inputClass} /></div></div>}
              {(pondShape === 'Rectangular' || pondShape === 'Raceway') && <div className="grid grid-cols-3 gap-2"><div><label className={labelClass}>طول (m)</label><input type="number" min="0" step="0.01" value={lengthMeters ?? ''} onChange={(event) => setLengthMeters(event.target.value === '' ? undefined : Number(event.target.value))} className={inputClass} /></div><div><label className={labelClass}>عرض (m)</label><input type="number" min="0" step="0.01" value={widthMeters ?? ''} onChange={(event) => setWidthMeters(event.target.value === '' ? undefined : Number(event.target.value))} className={inputClass} /></div><div><label className={labelClass}>عمق (m)</label><input type="number" min="0" step="0.01" value={depthMeters ?? ''} onChange={(event) => setDepthMeters(event.target.value === '' ? undefined : Number(event.target.value))} className={inputClass} /></div></div>}
              <p className="text-[10px] text-slate-500">حجم اسمی استخر از ابعاد معتبر به‌صورت خودکار محاسبه می‌شود.</p>
            </div>
          </section>

          <section className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
            <label className={labelClass}>توضیح / دلیل ثبت دستی</label>
            <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} className={inputClass} placeholder="مثلاً: شمارش دستی پایان شیفت، بیومتری و بازبینی موجودی..." />
            {pond.feedingStatus === 'ACTIVE' ? (
              <label className="flex items-start gap-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 cursor-pointer">
                <input type="checkbox" checked={stopFeeding} onChange={(event) => setStopFeeding(event.target.checked)} className="mt-0.5" />
                <span><strong className="block text-xs text-rose-200">همزمان تغذیه این استخر را قطع کن</strong><span className="text-[10px] text-rose-300/70">این عملیات فقط توقف را مجاز می‌کند؛ وصل مجدد خوراک همچنان نیازمند مسیر تأیید و تله‌متری ایمن است.</span></span>
              </label>
            ) : (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-200 text-xs"><ShieldAlert className="w-4 h-4 shrink-0" /><span>تغذیه این استخر از قبل متوقف است. Snapshot دستی اجازه فعال‌سازی مجدد خوراک را ندارد.</span></div>
            )}
          </section>

          {error && <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs">{error}</div>}

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold">انصراف</button>
            <button type="submit" className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"><Save className="w-4 h-4" /> ثبت Snapshot استخر</button>
          </div>
        </form>
      </div>
    </div>
  );
};
