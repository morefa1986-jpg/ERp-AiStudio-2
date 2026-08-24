import React, { useMemo, useState } from 'react';
import { Building2, Fish, Plus, Ruler, Save, Settings2, ToggleLeft, ToggleRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFarm } from '../../context/FarmContext';
import { useI18n } from '../../i18n';
import type { Hall, Pond } from '../../types';
import type { FarmSpeciesWithStatus, HallAdminInput, PondStructureAdminInput, SpeciesAdminInput } from '../../types/farmStructure';
import { pondWithManualSnapshot } from '../../types/pondSnapshot';

const textByLanguage = {
  fa: {
    title: 'ساختار مزرعه و تنظیمات ادمین', subtitle: 'مدیریت سالن‌ها، استخرها، ابعاد فیزیکی و گونه‌ها بدون تغییر کد',
    halls: 'سالن‌ها', ponds: 'استخرها', species: 'گونه‌ها', active: 'فعال', inactive: 'غیرفعال', edit: 'ویرایش', add: 'افزودن', save: 'ذخیره تغییرات', cancel: 'انصراف',
    hallNumber: 'شماره سالن', hallName: 'نام سالن', description: 'توضیحات', pondNumber: 'شماره استخر', pondName: 'نام استخر', hall: 'سالن', primarySpecies: 'گونه پایه', shape: 'شکل استخر', capacity: 'حجم اسمی (m³)', length: 'طول (m)', width: 'عرض (m)', depth: 'عمق (m)', diameter: 'قطر (m)', notes: 'یادداشت',
    circular: 'دایره‌ای', rectangular: 'مستطیلی', raceway: 'کانالی / Raceway', other: 'سایر', emptySafe: 'استخر جدید با موجودی صفر و خوراک قطع ایجاد می‌شود تا آمار اولیه و تله‌متری معتبر ثبت شود.',
    faName: 'نام فارسی', enName: 'نام انگلیسی', scientific: 'نام علمی', origin: 'منشأ', genetic: 'لاین ژنتیکی', tempMin: 'دمای بهینه حداقل', tempMax: 'دمای بهینه حداکثر', doMin: 'حداقل اکسیژن', phMin: 'pH حداقل', phMax: 'pH حداکثر', fcr: 'FCR استاندارد', feedCoeff: 'ضریب پروفایل خوراک', maturity: 'سن بلوغ خاویاری', deactivate: 'غیرفعال‌سازی', activate: 'فعال‌سازی', locked: 'فقط ادمین دارای مجوز settings.manage می‌تواند ساختار را تغییر دهد.',
    totalFish: 'کل ماهی', totalBiomass: 'کل بیوماس', configuredPonds: 'استخر تعریف‌شده', dimensions: 'ابعاد', noData: 'موردی ثبت نشده است.', speciesSafety: 'گونه‌ای که در استخر دارای ماهی استفاده می‌شود قابل غیرفعال‌سازی نیست.',
  },
  en: {
    title: 'Farm Structure & Admin Settings', subtitle: 'Manage halls, ponds, physical dimensions and species without code changes',
    halls: 'Halls', ponds: 'Ponds', species: 'Species', active: 'Active', inactive: 'Inactive', edit: 'Edit', add: 'Add', save: 'Save changes', cancel: 'Cancel',
    hallNumber: 'Hall number', hallName: 'Hall name', description: 'Description', pondNumber: 'Pond number', pondName: 'Pond name', hall: 'Hall', primarySpecies: 'Base species', shape: 'Pond shape', capacity: 'Nominal volume (m³)', length: 'Length (m)', width: 'Width (m)', depth: 'Depth (m)', diameter: 'Diameter (m)', notes: 'Notes',
    circular: 'Circular', rectangular: 'Rectangular', raceway: 'Raceway', other: 'Other', emptySafe: 'A new pond starts with zero stock and feeding stopped until initial stock and valid telemetry are recorded.',
    faName: 'Persian name', enName: 'English name', scientific: 'Scientific name', origin: 'Origin', genetic: 'Genetic line', tempMin: 'Optimum temp min', tempMax: 'Optimum temp max', doMin: 'Minimum oxygen', phMin: 'pH min', phMax: 'pH max', fcr: 'Standard FCR', feedCoeff: 'Feeding profile coefficient', maturity: 'Caviar maturity age', deactivate: 'Deactivate', activate: 'Activate', locked: 'Only an admin with settings.manage permission can change farm structure.',
    totalFish: 'Total fish', totalBiomass: 'Total biomass', configuredPonds: 'Configured ponds', dimensions: 'Dimensions', noData: 'No records.', speciesSafety: 'A species used by a stocked pond cannot be deactivated.',
  },
  de: { title: 'Farmstruktur & Admin-Einstellungen', subtitle: 'Hallen, Becken, Abmessungen und Arten ohne Codeänderungen verwalten', halls: 'Hallen', ponds: 'Becken', species: 'Arten', active: 'Aktiv', inactive: 'Inaktiv', edit: 'Bearbeiten', add: 'Hinzufügen', save: 'Änderungen speichern', cancel: 'Abbrechen', hallNumber: 'Hallennummer', hallName: 'Hallenname', description: 'Beschreibung', pondNumber: 'Beckennummer', pondName: 'Beckenname', hall: 'Halle', primarySpecies: 'Basisart', shape: 'Beckenform', capacity: 'Nennvolumen (m³)', length: 'Länge (m)', width: 'Breite (m)', depth: 'Tiefe (m)', diameter: 'Durchmesser (m)', notes: 'Notizen', circular: 'Rund', rectangular: 'Rechteckig', raceway: 'Raceway', other: 'Andere', emptySafe: 'Ein neues Becken startet mit Bestand 0 und gestoppter Fütterung bis Erstbestand und gültige Telemetrie erfasst sind.', faName: 'Persischer Name', enName: 'Englischer Name', scientific: 'Wissenschaftlicher Name', origin: 'Herkunft', genetic: 'Genetische Linie', tempMin: 'Optimale Temp. min', tempMax: 'Optimale Temp. max', doMin: 'Sauerstoff min', phMin: 'pH min', phMax: 'pH max', fcr: 'Standard-FCR', feedCoeff: 'Fütterungskoeffizient', maturity: 'Kaviarreifealter', deactivate: 'Deaktivieren', activate: 'Aktivieren', locked: 'Nur Admins mit settings.manage dürfen die Farmstruktur ändern.', totalFish: 'Fische gesamt', totalBiomass: 'Biomasse gesamt', configuredPonds: 'Definierte Becken', dimensions: 'Abmessungen', noData: 'Keine Einträge.', speciesSafety: 'Eine in besetzten Becken verwendete Art kann nicht deaktiviert werden.' },
  fr: { title: 'Structure de ferme & réglages admin', subtitle: 'Gérer halls, bassins, dimensions et espèces sans modifier le code', halls: 'Halls', ponds: 'Bassins', species: 'Espèces', active: 'Actif', inactive: 'Inactif', edit: 'Modifier', add: 'Ajouter', save: 'Enregistrer', cancel: 'Annuler', hallNumber: 'N° hall', hallName: 'Nom du hall', description: 'Description', pondNumber: 'N° bassin', pondName: 'Nom du bassin', hall: 'Hall', primarySpecies: 'Espèce de base', shape: 'Forme', capacity: 'Volume nominal (m³)', length: 'Longueur (m)', width: 'Largeur (m)', depth: 'Profondeur (m)', diameter: 'Diamètre (m)', notes: 'Notes', circular: 'Circulaire', rectangular: 'Rectangulaire', raceway: 'Raceway', other: 'Autre', emptySafe: 'Un nouveau bassin démarre à stock zéro et alimentation arrêtée jusqu’à la saisie du stock initial et d’une télémétrie valide.', faName: 'Nom persan', enName: 'Nom anglais', scientific: 'Nom scientifique', origin: 'Origine', genetic: 'Lignée génétique', tempMin: 'Temp. optimale min', tempMax: 'Temp. optimale max', doMin: 'Oxygène min', phMin: 'pH min', phMax: 'pH max', fcr: 'FCR standard', feedCoeff: 'Coefficient alimentation', maturity: 'Âge maturité caviar', deactivate: 'Désactiver', activate: 'Activer', locked: 'Seul un admin avec settings.manage peut modifier la structure.', totalFish: 'Poissons total', totalBiomass: 'Biomasse totale', configuredPonds: 'Bassins configurés', dimensions: 'Dimensions', noData: 'Aucun élément.', speciesSafety: 'Une espèce utilisée dans un bassin peuplé ne peut pas être désactivée.' },
  es: { title: 'Estructura de granja y ajustes admin', subtitle: 'Gestiona naves, estanques, dimensiones y especies sin cambiar código', halls: 'Naves', ponds: 'Estanques', species: 'Especies', active: 'Activo', inactive: 'Inactivo', edit: 'Editar', add: 'Añadir', save: 'Guardar cambios', cancel: 'Cancelar', hallNumber: 'N.º nave', hallName: 'Nombre de nave', description: 'Descripción', pondNumber: 'N.º estanque', pondName: 'Nombre del estanque', hall: 'Nave', primarySpecies: 'Especie base', shape: 'Forma', capacity: 'Volumen nominal (m³)', length: 'Largo (m)', width: 'Ancho (m)', depth: 'Profundidad (m)', diameter: 'Diámetro (m)', notes: 'Notas', circular: 'Circular', rectangular: 'Rectangular', raceway: 'Raceway', other: 'Otro', emptySafe: 'Un estanque nuevo comienza con stock cero y alimentación detenida hasta registrar stock inicial y telemetría válida.', faName: 'Nombre persa', enName: 'Nombre inglés', scientific: 'Nombre científico', origin: 'Origen', genetic: 'Línea genética', tempMin: 'Temp. óptima mín.', tempMax: 'Temp. óptima máx.', doMin: 'Oxígeno mín.', phMin: 'pH mín.', phMax: 'pH máx.', fcr: 'FCR estándar', feedCoeff: 'Coeficiente alimentación', maturity: 'Edad madurez caviar', deactivate: 'Desactivar', activate: 'Activar', locked: 'Solo un admin con settings.manage puede cambiar la estructura.', totalFish: 'Total peces', totalBiomass: 'Biomasa total', configuredPonds: 'Estanques configurados', dimensions: 'Dimensiones', noData: 'Sin registros.', speciesSafety: 'No se puede desactivar una especie usada en un estanque con peces.' },
  ru: { title: 'Структура фермы и настройки администратора', subtitle: 'Управление цехами, бассейнами, размерами и видами без изменения кода', halls: 'Цеха', ponds: 'Бассейны', species: 'Виды', active: 'Активен', inactive: 'Неактивен', edit: 'Изменить', add: 'Добавить', save: 'Сохранить', cancel: 'Отмена', hallNumber: 'Номер цеха', hallName: 'Название цеха', description: 'Описание', pondNumber: 'Номер бассейна', pondName: 'Название бассейна', hall: 'Цех', primarySpecies: 'Базовый вид', shape: 'Форма', capacity: 'Номинальный объём (м³)', length: 'Длина (м)', width: 'Ширина (м)', depth: 'Глубина (м)', diameter: 'Диаметр (м)', notes: 'Примечания', circular: 'Круглый', rectangular: 'Прямоугольный', raceway: 'Raceway', other: 'Другой', emptySafe: 'Новый бассейн создаётся с нулевым поголовьем и остановленным кормлением до ввода стартового поголовья и валидной телеметрии.', faName: 'Персидское имя', enName: 'Английское имя', scientific: 'Научное название', origin: 'Происхождение', genetic: 'Генетическая линия', tempMin: 'Оптимум T мин', tempMax: 'Оптимум T макс', doMin: 'Кислород мин', phMin: 'pH мин', phMax: 'pH макс', fcr: 'Стандарт FCR', feedCoeff: 'Коэф. кормления', maturity: 'Возраст зрелости икры', deactivate: 'Отключить', activate: 'Активировать', locked: 'Изменять структуру может только администратор с settings.manage.', totalFish: 'Всего рыб', totalBiomass: 'Общая биомасса', configuredPonds: 'Бассейнов', dimensions: 'Размеры', noData: 'Нет записей.', speciesSafety: 'Нельзя отключить вид, используемый в бассейне с рыбой.' },
  ar: { title: 'هيكل المزرعة وإعدادات المسؤول', subtitle: 'إدارة الصالات والأحواض والأبعاد والأنواع دون تعديل الكود', halls: 'الصالات', ponds: 'الأحواض', species: 'الأنواع', active: 'نشط', inactive: 'غير نشط', edit: 'تعديل', add: 'إضافة', save: 'حفظ التغييرات', cancel: 'إلغاء', hallNumber: 'رقم الصالة', hallName: 'اسم الصالة', description: 'الوصف', pondNumber: 'رقم الحوض', pondName: 'اسم الحوض', hall: 'الصالة', primarySpecies: 'النوع الأساسي', shape: 'شكل الحوض', capacity: 'الحجم الاسمي (م³)', length: 'الطول (م)', width: 'العرض (م)', depth: 'العمق (م)', diameter: 'القطر (م)', notes: 'ملاحظات', circular: 'دائري', rectangular: 'مستطيل', raceway: 'Raceway', other: 'أخرى', emptySafe: 'يُنشأ الحوض الجديد بمخزون صفر وتغذية متوقفة حتى تسجيل المخزون الأولي وقياسات موثوقة.', faName: 'الاسم الفارسي', enName: 'الاسم الإنجليزي', scientific: 'الاسم العلمي', origin: 'المنشأ', genetic: 'الخط الوراثي', tempMin: 'أدنى حرارة مثلى', tempMax: 'أعلى حرارة مثلى', doMin: 'أدنى أكسجين', phMin: 'أدنى pH', phMax: 'أعلى pH', fcr: 'FCR القياسي', feedCoeff: 'معامل التغذية', maturity: 'عمر نضج الكافيار', deactivate: 'تعطيل', activate: 'تفعيل', locked: 'يمكن فقط للمسؤول الذي لديه settings.manage تعديل الهيكل.', totalFish: 'إجمالي الأسماك', totalBiomass: 'إجمالي الكتلة', configuredPonds: 'الأحواض المعرفة', dimensions: 'الأبعاد', noData: 'لا توجد سجلات.', speciesSafety: 'لا يمكن تعطيل نوع مستخدم في حوض يحتوي على أسماك.' },
} as const;

type Copy = typeof textByLanguage.fa;
const fieldClass = 'w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500';
const labelClass = 'block text-[10px] font-bold text-slate-400 mb-1';

function pondDimensions(pond: Pond): string {
  const manual = pondWithManualSnapshot(pond);
  if (manual.pondShape === 'Circular') return `Ø ${manual.diameterMeters ?? '—'} × ${manual.depthMeters ?? '—'} m`;
  if (manual.pondShape === 'Rectangular' || manual.pondShape === 'Raceway') return `${manual.lengthMeters ?? '—'} × ${manual.widthMeters ?? '—'} × ${manual.depthMeters ?? '—'} m`;
  return `${pond.capacityCubicMeters} m³`;
}

const defaultSpecies: SpeciesAdminInput = {
  faName: '', enName: '', scientificName: '', origin: '', geneticLine: '',
  optimumTempMin: 12, optimumTempMax: 22, optimumDOMin: 5, optimumpHMin: 6.8, optimumpHMax: 8.2,
  standardFCR: 1.2, feedingProfileCoeff: 1, caviarMaturityYears: 8, description: '', isActive: true,
};

export const FarmStructureView: React.FC = () => {
  const { language, formatNumber } = useI18n();
  const copy: Copy = (textByLanguage[language] || textByLanguage.en) as Copy;
  const { hasPermission } = useAuth();
  const {
    halls, ponds, species, createHallStructure, updateHallStructure, createPondStructure, updatePondStructure,
    createSpeciesDefinition, setSpeciesActive,
  } = useFarm();
  const canManage = hasPermission('settings', 'manage');
  const [error, setError] = useState('');
  const [hallForm, setHallForm] = useState<HallAdminInput>({ number: '', name: '', description: '' });
  const [editingHallId, setEditingHallId] = useState<string | null>(null);
  const [pondForm, setPondForm] = useState<PondStructureAdminInput>({ number: '', name: '', hallId: '', speciesId: '', pondShape: 'Other', capacityCubicMeters: 1, notes: '' });
  const [editingPondId, setEditingPondId] = useState<string | null>(null);
  const [speciesForm, setSpeciesForm] = useState<SpeciesAdminInput>(defaultSpecies);

  const activeSpecies = species.filter((item) => (item as FarmSpeciesWithStatus).isActive !== false);
  const totalFish = ponds.reduce((sum, pond) => sum + pond.fishCount, 0);
  const totalBiomass = ponds.reduce((sum, pond) => sum + pond.biomassKg, 0);
  const hallsById = useMemo(() => new Map(halls.map((hall) => [hall.id, hall])), [halls]);
  const speciesById = useMemo(() => new Map(species.map((item) => [item.id, item])), [species]);

  const showError = (result: { success: boolean; error?: string }) => {
    if (!result.success) setError(result.error || 'OPERATION_FAILED');
    else setError('');
    return result.success;
  };

  const submitHall = (event: React.FormEvent) => {
    event.preventDefault();
    const result = editingHallId
      ? updateHallStructure(editingHallId, hallForm)
      : createHallStructure(hallForm);
    if (!showError(result)) return;
    setHallForm({ number: '', name: '', description: '' });
    setEditingHallId(null);
  };

  const editHall = (hall: Hall) => {
    setEditingHallId(hall.id);
    setHallForm({ number: hall.number, name: hall.name, description: hall.description });
  };

  const submitPond = (event: React.FormEvent) => {
    event.preventDefault();
    const result = editingPondId
      ? updatePondStructure(editingPondId, pondForm)
      : createPondStructure(pondForm);
    if (!showError(result)) return;
    setPondForm({ number: '', name: '', hallId: halls.find((hall) => hall.isActive)?.id || '', speciesId: activeSpecies[0]?.id || '', pondShape: 'Other', capacityCubicMeters: 1, notes: '' });
    setEditingPondId(null);
  };

  const editPond = (pond: Pond) => {
    const manual = pondWithManualSnapshot(pond);
    setEditingPondId(pond.id);
    setPondForm({
      number: pond.number, name: pond.name, hallId: pond.hallId, speciesId: pond.speciesId,
      pondShape: manual.pondShape || 'Other', capacityCubicMeters: pond.capacityCubicMeters,
      lengthMeters: manual.lengthMeters, widthMeters: manual.widthMeters, depthMeters: manual.depthMeters,
      diameterMeters: manual.diameterMeters, notes: pond.notes || '',
    });
  };

  const submitSpecies = (event: React.FormEvent) => {
    event.preventDefault();
    const result = createSpeciesDefinition(speciesForm);
    if (!showError(result)) return;
    setSpeciesForm(defaultSpecies);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-3 bg-amber-500/15 border border-amber-500/30 rounded-2xl"><Settings2 className="w-6 h-6 text-amber-400" /></div>
          <div><h1 className="text-xl font-black text-white">{copy.title}</h1><p className="text-xs text-slate-400 mt-1">{copy.subtitle}</p></div>
        </div>
        <div className="grid grid-cols-3 gap-2 min-w-[320px]">
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3"><span className="block text-[10px] text-slate-500">{copy.halls}</span><strong className="text-white">{formatNumber(halls.length)}</strong></div>
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3"><span className="block text-[10px] text-slate-500">{copy.configuredPonds}</span><strong className="text-white">{formatNumber(ponds.length)}</strong></div>
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3"><span className="block text-[10px] text-slate-500">{copy.species}</span><strong className="text-white">{formatNumber(species.length)}</strong></div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4"><Building2 className="w-5 h-5 text-violet-300 mb-2"/><span className="block text-[10px] text-slate-500">{copy.halls}</span><strong className="text-lg text-white">{halls.filter((h) => h.isActive).length}</strong></div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4"><Fish className="w-5 h-5 text-cyan-300 mb-2"/><span className="block text-[10px] text-slate-500">{copy.configuredPonds}</span><strong className="text-lg text-white">{ponds.length}</strong></div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4"><Fish className="w-5 h-5 text-amber-300 mb-2"/><span className="block text-[10px] text-slate-500">{copy.totalFish}</span><strong className="text-lg text-white">{formatNumber(totalFish)}</strong></div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4"><Ruler className="w-5 h-5 text-emerald-300 mb-2"/><span className="block text-[10px] text-slate-500">{copy.totalBiomass}</span><strong className="text-lg text-white">{formatNumber(Number(totalBiomass.toFixed(2)))} kg</strong></div>
      </div>

      {!canManage && <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs">{copy.locked}</div>}
      {error && <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs font-mono">{error}</div>}

      <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center gap-2"><Building2 className="w-5 h-5 text-violet-300"/><h2 className="font-black text-white text-sm">{copy.halls}</h2></div>
        {canManage && <form onSubmit={submitHall} className="p-4 grid grid-cols-1 md:grid-cols-4 gap-2 bg-slate-950/40">
          <div><label className={labelClass}>{copy.hallNumber}</label><input className={fieldClass} value={hallForm.number} onChange={(e) => setHallForm((p) => ({ ...p, number: e.target.value }))} required /></div>
          <div><label className={labelClass}>{copy.hallName}</label><input className={fieldClass} value={hallForm.name} onChange={(e) => setHallForm((p) => ({ ...p, name: e.target.value }))} required /></div>
          <div><label className={labelClass}>{copy.description}</label><input className={fieldClass} value={hallForm.description} onChange={(e) => setHallForm((p) => ({ ...p, description: e.target.value }))} /></div>
          <div className="flex items-end gap-2"><button className="flex-1 py-2.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-black flex items-center justify-center gap-1"><Save className="w-4 h-4"/>{editingHallId ? copy.save : copy.add}</button>{editingHallId && <button type="button" onClick={() => { setEditingHallId(null); setHallForm({ number: '', name: '', description: '' }); }} className="px-3 py-2.5 rounded-xl bg-slate-800 text-xs text-slate-300">{copy.cancel}</button>}</div>
        </form>}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-4">
          {halls.length ? halls.map((hall) => <div key={hall.id} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
            <div className="flex justify-between gap-2"><div><strong className="text-white text-sm">{hall.number} — {hall.name}</strong><p className="text-[10px] text-slate-500 mt-1">{hall.description}</p></div><span className={`h-fit text-[10px] px-2 py-1 rounded-full border ${hall.isActive ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' : 'text-slate-400 border-slate-700'}`}>{hall.isActive ? copy.active : copy.inactive}</span></div>
            <div className="grid grid-cols-3 gap-1 mt-3 text-[10px]"><span className="bg-slate-900 p-2 rounded-lg text-slate-400">{copy.ponds}: <b className="text-white">{hall.pondCount}</b></span><span className="bg-slate-900 p-2 rounded-lg text-slate-400">{copy.totalFish}: <b className="text-white">{formatNumber(hall.totalFishCount)}</b></span><span className="bg-slate-900 p-2 rounded-lg text-slate-400">kg: <b className="text-white">{formatNumber(hall.totalBiomassKg)}</b></span></div>
            {canManage && <div className="flex gap-2 mt-3"><button onClick={() => editHall(hall)} className="flex-1 py-2 rounded-lg bg-slate-800 text-xs text-slate-200">{copy.edit}</button><button onClick={() => showError(updateHallStructure(hall.id, { isActive: !hall.isActive }))} className="flex-1 py-2 rounded-lg bg-slate-800 text-xs text-slate-200 flex items-center justify-center gap-1">{hall.isActive ? <ToggleRight className="w-4 h-4 text-emerald-300"/> : <ToggleLeft className="w-4 h-4"/>}{hall.isActive ? copy.deactivate : copy.activate}</button></div>}
          </div>) : <p className="text-xs text-slate-500">{copy.noData}</p>}
        </div>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center gap-2"><Fish className="w-5 h-5 text-cyan-300"/><h2 className="font-black text-white text-sm">{copy.ponds}</h2></div>
        {canManage && <form onSubmit={submitPond} className="p-4 bg-slate-950/40 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <div><label className={labelClass}>{copy.pondNumber}</label><input className={fieldClass} value={pondForm.number} onChange={(e) => setPondForm((p) => ({ ...p, number: e.target.value }))} required /></div>
            <div><label className={labelClass}>{copy.pondName}</label><input className={fieldClass} value={pondForm.name} onChange={(e) => setPondForm((p) => ({ ...p, name: e.target.value }))} required /></div>
            <div><label className={labelClass}>{copy.hall}</label><select className={fieldClass} value={pondForm.hallId} onChange={(e) => setPondForm((p) => ({ ...p, hallId: e.target.value }))} required><option value="">—</option>{halls.filter((hall) => hall.isActive).map((hall) => <option key={hall.id} value={hall.id}>{hall.number} — {hall.name}</option>)}</select></div>
            <div><label className={labelClass}>{copy.primarySpecies}</label><select className={fieldClass} value={pondForm.speciesId} onChange={(e) => setPondForm((p) => ({ ...p, speciesId: e.target.value }))} required><option value="">—</option>{activeSpecies.map((item) => <option key={item.id} value={item.id}>{item.faName} / {item.enName}</option>)}</select></div>
            <div><label className={labelClass}>{copy.shape}</label><select className={fieldClass} value={pondForm.pondShape} onChange={(e) => setPondForm((p) => ({ ...p, pondShape: e.target.value as PondStructureAdminInput['pondShape'] }))}><option value="Other">{copy.other}</option><option value="Circular">{copy.circular}</option><option value="Rectangular">{copy.rectangular}</option><option value="Raceway">{copy.raceway}</option></select></div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {pondForm.pondShape === 'Circular' ? <><div><label className={labelClass}>{copy.diameter}</label><input type="number" min="0.01" step="0.01" className={fieldClass} value={pondForm.diameterMeters ?? ''} onChange={(e) => setPondForm((p) => ({ ...p, diameterMeters: Number(e.target.value) }))} required /></div><div><label className={labelClass}>{copy.depth}</label><input type="number" min="0.01" step="0.01" className={fieldClass} value={pondForm.depthMeters ?? ''} onChange={(e) => setPondForm((p) => ({ ...p, depthMeters: Number(e.target.value) }))} required /></div></> : pondForm.pondShape === 'Rectangular' || pondForm.pondShape === 'Raceway' ? <><div><label className={labelClass}>{copy.length}</label><input type="number" min="0.01" step="0.01" className={fieldClass} value={pondForm.lengthMeters ?? ''} onChange={(e) => setPondForm((p) => ({ ...p, lengthMeters: Number(e.target.value) }))} required /></div><div><label className={labelClass}>{copy.width}</label><input type="number" min="0.01" step="0.01" className={fieldClass} value={pondForm.widthMeters ?? ''} onChange={(e) => setPondForm((p) => ({ ...p, widthMeters: Number(e.target.value) }))} required /></div><div><label className={labelClass}>{copy.depth}</label><input type="number" min="0.01" step="0.01" className={fieldClass} value={pondForm.depthMeters ?? ''} onChange={(e) => setPondForm((p) => ({ ...p, depthMeters: Number(e.target.value) }))} required /></div></> : <div><label className={labelClass}>{copy.capacity}</label><input type="number" min="0.01" step="0.01" className={fieldClass} value={pondForm.capacityCubicMeters ?? ''} onChange={(e) => setPondForm((p) => ({ ...p, capacityCubicMeters: Number(e.target.value) }))} required /></div>}
            <div className="md:col-span-2"><label className={labelClass}>{copy.notes}</label><input className={fieldClass} value={pondForm.notes || ''} onChange={(e) => setPondForm((p) => ({ ...p, notes: e.target.value }))} /></div>
            <div className="flex items-end gap-2"><button className="flex-1 py-2.5 rounded-xl bg-cyan-500 text-slate-950 text-xs font-black flex justify-center items-center gap-1"><Plus className="w-4 h-4"/>{editingPondId ? copy.save : copy.add}</button>{editingPondId && <button type="button" onClick={() => setEditingPondId(null)} className="px-3 py-2.5 rounded-xl bg-slate-800 text-xs text-slate-300">{copy.cancel}</button>}</div>
          </div>
          <p className="text-[10px] text-slate-500">{copy.emptySafe}</p>
        </form>}
        <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="bg-slate-950 text-slate-500"><th className="p-3 text-start">{copy.pondNumber}</th><th className="p-3 text-start">{copy.hall}</th><th className="p-3 text-start">{copy.primarySpecies}</th><th className="p-3 text-start">{copy.dimensions}</th><th className="p-3 text-end">{copy.totalFish}</th><th className="p-3 text-end">kg</th>{canManage && <th className="p-3"></th>}</tr></thead><tbody>{ponds.map((pond) => <tr key={pond.id} className="border-t border-slate-800"><td className="p-3 text-white font-bold">{pond.number} — {pond.name}</td><td className="p-3 text-slate-300">{hallsById.get(pond.hallId)?.number || '—'}</td><td className="p-3 text-slate-300">{speciesById.get(pond.speciesId)?.enName || '—'}</td><td className="p-3 text-violet-200">{pondDimensions(pond)}</td><td className="p-3 text-end text-white">{formatNumber(pond.fishCount)}</td><td className="p-3 text-end text-white">{formatNumber(pond.biomassKg)}</td>{canManage && <td className="p-3 text-end"><button onClick={() => editPond(pond)} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200">{copy.edit}</button></td>}</tr>)}</tbody></table></div>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center gap-2"><Fish className="w-5 h-5 text-amber-300"/><h2 className="font-black text-white text-sm">{copy.species}</h2></div>
        {canManage && <form onSubmit={submitSpecies} className="p-4 bg-slate-950/40 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2"><div><label className={labelClass}>{copy.faName}</label><input className={fieldClass} value={speciesForm.faName} onChange={(e) => setSpeciesForm((p) => ({ ...p, faName: e.target.value }))} required /></div><div><label className={labelClass}>{copy.enName}</label><input className={fieldClass} value={speciesForm.enName} onChange={(e) => setSpeciesForm((p) => ({ ...p, enName: e.target.value }))} required /></div><div><label className={labelClass}>{copy.scientific}</label><input className={fieldClass} value={speciesForm.scientificName} onChange={(e) => setSpeciesForm((p) => ({ ...p, scientificName: e.target.value }))} required /></div><div><label className={labelClass}>{copy.origin}</label><input className={fieldClass} value={speciesForm.origin} onChange={(e) => setSpeciesForm((p) => ({ ...p, origin: e.target.value }))} /></div><div><label className={labelClass}>{copy.genetic}</label><input className={fieldClass} value={speciesForm.geneticLine} onChange={(e) => setSpeciesForm((p) => ({ ...p, geneticLine: e.target.value }))} /></div></div>
          <div className="grid grid-cols-2 md:grid-cols-8 gap-2"><div><label className={labelClass}>{copy.tempMin}</label><input type="number" step="0.1" className={fieldClass} value={speciesForm.optimumTempMin} onChange={(e) => setSpeciesForm((p) => ({ ...p, optimumTempMin: Number(e.target.value) }))} /></div><div><label className={labelClass}>{copy.tempMax}</label><input type="number" step="0.1" className={fieldClass} value={speciesForm.optimumTempMax} onChange={(e) => setSpeciesForm((p) => ({ ...p, optimumTempMax: Number(e.target.value) }))} /></div><div><label className={labelClass}>{copy.doMin}</label><input type="number" step="0.1" className={fieldClass} value={speciesForm.optimumDOMin} onChange={(e) => setSpeciesForm((p) => ({ ...p, optimumDOMin: Number(e.target.value) }))} /></div><div><label className={labelClass}>{copy.phMin}</label><input type="number" step="0.1" className={fieldClass} value={speciesForm.optimumpHMin} onChange={(e) => setSpeciesForm((p) => ({ ...p, optimumpHMin: Number(e.target.value) }))} /></div><div><label className={labelClass}>{copy.phMax}</label><input type="number" step="0.1" className={fieldClass} value={speciesForm.optimumpHMax} onChange={(e) => setSpeciesForm((p) => ({ ...p, optimumpHMax: Number(e.target.value) }))} /></div><div><label className={labelClass}>{copy.fcr}</label><input type="number" step="0.01" className={fieldClass} value={speciesForm.standardFCR} onChange={(e) => setSpeciesForm((p) => ({ ...p, standardFCR: Number(e.target.value) }))} /></div><div><label className={labelClass}>{copy.feedCoeff}</label><input type="number" step="0.01" className={fieldClass} value={speciesForm.feedingProfileCoeff} onChange={(e) => setSpeciesForm((p) => ({ ...p, feedingProfileCoeff: Number(e.target.value) }))} /></div><div><label className={labelClass}>{copy.maturity}</label><input type="number" step="1" className={fieldClass} value={speciesForm.caviarMaturityYears} onChange={(e) => setSpeciesForm((p) => ({ ...p, caviarMaturityYears: Number(e.target.value) }))} /></div></div>
          <div className="flex gap-2"><input className={fieldClass} placeholder={copy.description} value={speciesForm.description} onChange={(e) => setSpeciesForm((p) => ({ ...p, description: e.target.value }))} /><button className="px-5 rounded-xl bg-amber-500 text-slate-950 text-xs font-black">{copy.add}</button></div>
          <p className="text-[10px] text-slate-500">{copy.speciesSafety}</p>
        </form>}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-4">{species.map((item) => { const status = (item as FarmSpeciesWithStatus).isActive !== false; const usedFish = ponds.filter((pond) => pond.speciesId === item.id).reduce((sum, pond) => sum + pond.fishCount, 0); return <div key={item.id} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"><div className="flex justify-between gap-2"><div><strong className="text-white text-sm">{item.faName} / {item.enName}</strong><p className="text-[10px] italic text-amber-300 mt-1">{item.scientificName}</p></div><span className={`h-fit text-[10px] px-2 py-1 rounded-full border ${status ? 'text-emerald-300 border-emerald-500/30' : 'text-slate-500 border-slate-700'}`}>{status ? copy.active : copy.inactive}</span></div><div className="mt-3 text-[10px] text-slate-400">{copy.totalFish}: <b className="text-white">{formatNumber(usedFish)}</b> · FCR: <b className="text-white">{item.standardFCR}</b> · T: <b className="text-white">{item.optimumTempMin}–{item.optimumTempMax}°C</b></div>{canManage && <button disabled={usedFish > 0 && status} onClick={() => showError(setSpeciesActive(item.id, !status))} className="mt-3 w-full py-2 rounded-lg bg-slate-800 disabled:opacity-30 text-xs text-slate-200">{status ? copy.deactivate : copy.activate}</button>}</div>; })}</div>
      </section>
    </div>
  );
};
