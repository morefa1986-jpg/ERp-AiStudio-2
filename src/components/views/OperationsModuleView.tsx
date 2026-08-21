import React, { useMemo } from 'react';
import { Building2, ClipboardList, Factory, FlaskConical, Package, Snowflake, Users, Wrench } from 'lucide-react';
import { useFarm } from '../../context/FarmContext';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n';

export type OperationsModuleId =
  | 'farmHalls'
  | 'mortality'
  | 'treatments'
  | 'transfers'
  | 'nursery'
  | 'feedFactory'
  | 'laboratory'
  | 'coldStorage'
  | 'crm'
  | 'maintenance'
  | 'reports';

interface Props {
  moduleId: OperationsModuleId;
}

interface TableModel {
  titleKey: string;
  icon: React.ElementType;
  headers: string[];
  rows: React.ReactNode[][];
}

export const OperationsModuleView: React.FC<Props> = ({ moduleId }) => {
  const { t, formatNumber, formatDate, formatCurrency } = useI18n();
  const farm = useFarm();
  const { hasPermission } = useAuth();
  const exportModule = ({ farmHalls: 'halls', mortality: 'mortality', treatments: 'treatments', transfers: 'transfers', nursery: 'nursery', feedFactory: 'feed_factory', laboratory: 'laboratory', coldStorage: 'cold_storage', crm: 'crm', maintenance: 'settings', reports: 'reports' } as const)[moduleId];
  const canExport = hasPermission(exportModule, 'export');

  const model = useMemo<TableModel>(() => {
    switch (moduleId) {
      case 'farmHalls':
        return {
          titleKey: 'nav.farmHalls',
          icon: Building2,
          headers: [t('code'), t('name'), t('pond.count'), t('pond.biomass'), t('quantity'), t('status')],
          rows: farm.halls.map((hall) => [
            hall.number,
            hall.name,
            formatNumber(hall.pondCount),
            `${formatNumber(hall.totalBiomassKg)} kg`,
            formatNumber(hall.totalFishCount),
            hall.isActive ? t('active') : t('inactive'),
          ]),
        };
      case 'mortality':
        return {
          titleKey: 'nav.mortality',
          icon: ClipboardList,
          headers: [t('feeding.thPond'), t('quantity'), t('description'), t('details'), t('date')],
          rows: farm.mortalityRecords.map((row) => [row.pondName, formatNumber(row.count), row.reason, row.description, formatDate(row.timestamp)]),
        };
      case 'treatments':
        return {
          titleKey: 'nav.treatments',
          icon: ClipboardList,
          headers: [t('feeding.thPond'), t('name'), t('description'), t('status'), t('date')],
          rows: farm.treatments.map((row) => [row.pondName, row.drugName, row.diagnosis, row.status, formatDate(row.startDate)]),
        };
      case 'transfers':
        return {
          titleKey: 'nav.transfers',
          icon: ClipboardList,
          headers: [t('details'), t('quantity'), t('pond.biomass'), t('status'), t('date')],
          rows: farm.transfers.map((row) => [
            `${row.sourceName} → ${row.destinationName}`,
            formatNumber(row.fishCount),
            `${formatNumber(row.totalBiomassKg)} kg`,
            row.status,
            formatDate(row.date),
          ]),
        };
      case 'nursery':
        return {
          titleKey: 'nav.nursery',
          icon: Package,
          headers: [t('code'), t('quantity'), t('pond.avgWeight'), t('nav.feeding'), t('status')],
          rows: farm.nurseryTanks.map((row) => [
            row.code,
            formatNumber(row.fishCount),
            `${formatNumber(row.avgWeightGrams)} g`,
            `${formatNumber(row.dailyFeedGrams)} g`,
            row.status,
          ]),
        };
      case 'feedFactory': {
        const feeds = farm.inventory.filter((row) => row.category.includes('Feed'));
        return {
          titleKey: 'nav.feedFactory',
          icon: Factory,
          headers: [t('code'), t('name'), t('quantity'), t('price'), t('status')],
          rows: feeds.map((row) => [
            row.sku,
            row.name,
            `${formatNumber(row.quantity)} ${row.unit}`,
            formatCurrency(row.purchasePricePerUnit, row.currency),
            row.status,
          ]),
        };
      }
      case 'laboratory':
        return {
          titleKey: 'nav.laboratory',
          icon: FlaskConical,
          headers: [t('code'), t('details'), t('type'), t('status'), t('date')],
          rows: farm.labSamples.map((row) => [row.sampleCode, row.sourceName, row.testType, row.status, formatDate(row.collectionDate)]),
        };
      case 'coldStorage':
        return {
          titleKey: 'nav.coldStorage',
          icon: Snowflake,
          headers: [t('code'), t('type'), t('details'), t('quantity'), t('status')],
          rows: farm.coldStorage.map((row) => [
            row.slotCode,
            row.productType,
            row.batchCode,
            `${formatNumber(row.weightKg)} kg / ${formatNumber(row.temperatureC)}°C`,
            row.status,
          ]),
        };
      case 'crm':
        return {
          titleKey: 'nav.crm',
          icon: Users,
          headers: [t('name'), t('details'), t('status'), t('amount'), t('date')],
          rows: farm.customers.map((row) => [
            row.name,
            `${row.companyName} — ${row.city}, ${row.country}`,
            row.status,
            formatCurrency(row.outstandingBalance, row.currency),
            formatDate(row.createdAt),
          ]),
        };
      case 'maintenance':
        return {
          titleKey: 'nav.maintenance',
          icon: Wrench,
          headers: [t('code'), t('name'), t('details'), t('status'), t('date')],
          rows: farm.equipment.map((row) => [row.code, row.name, row.hallLocation, row.status, formatDate(row.nextServiceDate)]),
        };
      case 'reports':
      default:
        return {
          titleKey: 'nav.reports',
          icon: ClipboardList,
          headers: [t('date'), t('type'), t('details'), t('status')],
          rows: farm.auditLogs.slice(0, 250).map((row) => [formatDate(row.timestamp), row.action, row.details, row.entity]),
        };
    }
  }, [moduleId, farm, t, formatNumber, formatDate, formatCurrency]);

  const Icon = model.icon;
  const totalRows = model.rows.length;

  const exportCsv = () => {
    if (!canExport) return;
    const encode = (value: React.ReactNode) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csv = [model.headers.map(encode).join(','), ...model.rows.map((row) => row.map(encode).join(','))].join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${moduleId}-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5 animate-fadeIn pb-12">
      <div className="bg-[#121214] border border-[#27272A] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#18181B] border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] shrink-0">
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-black text-white truncate">{t(model.titleKey)}</h1>
            <p className="text-xs text-[#71717A] mt-1">{t('status')}: {formatNumber(totalRows)}</p>
          </div>
        </div>
        <button type="button" onClick={exportCsv} disabled={!canExport || totalRows === 0} className="px-4 py-2 rounded-xl bg-[#18181B] border border-[#D4AF37]/30 text-[#D4AF37] text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed">
          {t('exportExcel')}
        </button>
      </div>

      <div className="bg-[#121214] border border-[#27272A] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[#0C0C0E] text-[#71717A]">
              <tr>{model.headers.map((header, index) => <th key={`${header}-${index}`} className="p-3 text-start whitespace-nowrap">{header}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-[#27272A]">
              {model.rows.length === 0 ? (
                <tr><td colSpan={Math.max(model.headers.length, 1)} className="p-8 text-center text-[#71717A]">{t('noData')}</td></tr>
              ) : model.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="text-[#D4D4D8] hover:bg-[#18181B]/70 transition-colors">
                  {row.map((cell, cellIndex) => <td key={cellIndex} className="p-3 align-top max-w-sm">{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
