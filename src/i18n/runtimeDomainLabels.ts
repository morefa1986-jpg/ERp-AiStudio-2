import { LanguageCode } from '../types';

type LabelSet = Record<string, string>;

const labels: Record<LanguageCode, LabelSet> = {
  fa: {
    Purchase: 'خرید', Consumption: 'مصرف', Transfer: 'انتقال', Adjustment: 'تعدیل', Return: 'مرجوعی', Waste: 'ضایعات', Production: 'تولید', Sale: 'فروش',
    Calculated: 'محاسبه‌شده', Approved: 'تأییدشده', Paid: 'پرداخت‌شده', Present: 'حاضر', Late: 'تأخیر', Absent: 'غایب', 'Approved Leave': 'مرخصی تأییدشده',
    'Active VIP': 'VIP فعال', Regular: 'عادی', Lead: 'مشتری بالقوه', Inactive: 'غیرفعال', Draft: 'پیش‌نویس', Sent: 'ارسال‌شده', Accepted: 'پذیرفته‌شده', 'Converted to Invoice': 'تبدیل‌شده به فاکتور', Cancelled: 'لغوشده',
    Completed: 'تکمیل‌شده', Packaging: 'در حال بسته‌بندی', 'Stored In Cold Room': 'ذخیره‌شده در سردخانه', Stored: 'ذخیره‌شده', 'Pending Dispatch': 'در انتظار ارسال', Reserved: 'رزروشده',
    Female: 'ماده', Male: 'نر', Unknown: 'نامشخص', 'Active Broodstock': 'مولد فعال', Resting: 'استراحت', 'Selected For Spawning': 'انتخاب‌شده برای تکثیر', 'Post Spawning': 'پس از تکثیر', Retired: 'بازنشسته',
    Incubating: 'در حال انکوباسیون', Hatched: 'تفریخ‌شده', Failed: 'ناموفق', Active: 'فعال', Empty: 'خالی', Sanitizing: 'ضدعفونی', Cleaning: 'شست‌وشو', Pending: 'در انتظار', Rejected: 'ردشده', Normal: 'نرمال', Abnormal: 'غیرعادی', Critical: 'بحرانی',
  },
  en: {
    Purchase: 'Purchase', Consumption: 'Consumption', Transfer: 'Transfer', Adjustment: 'Adjustment', Return: 'Return', Waste: 'Waste', Production: 'Production', Sale: 'Sale',
    Calculated: 'Calculated', Approved: 'Approved', Paid: 'Paid', Present: 'Present', Late: 'Late', Absent: 'Absent', 'Approved Leave': 'Approved leave',
    'Active VIP': 'Active VIP', Regular: 'Regular', Lead: 'Lead', Inactive: 'Inactive', Draft: 'Draft', Sent: 'Sent', Accepted: 'Accepted', 'Converted to Invoice': 'Converted to invoice', Cancelled: 'Cancelled',
    Completed: 'Completed', Packaging: 'Packaging', 'Stored In Cold Room': 'Stored in cold room', Stored: 'Stored', 'Pending Dispatch': 'Pending dispatch', Reserved: 'Reserved',
    Female: 'Female', Male: 'Male', Unknown: 'Unknown', 'Active Broodstock': 'Active broodstock', Resting: 'Resting', 'Selected For Spawning': 'Selected for spawning', 'Post Spawning': 'Post spawning', Retired: 'Retired',
    Incubating: 'Incubating', Hatched: 'Hatched', Failed: 'Failed', Active: 'Active', Empty: 'Empty', Sanitizing: 'Sanitizing', Cleaning: 'Cleaning', Pending: 'Pending', Rejected: 'Rejected', Normal: 'Normal', Abnormal: 'Abnormal', Critical: 'Critical',
  },
  de: {
    Purchase: 'Einkauf', Consumption: 'Verbrauch', Transfer: 'Transfer', Adjustment: 'Bestandskorrektur', Return: 'Rückgabe', Waste: 'Verlust', Production: 'Produktion', Sale: 'Verkauf',
    Calculated: 'Berechnet', Approved: 'Freigegeben', Paid: 'Bezahlt', Present: 'Anwesend', Late: 'Verspätet', Absent: 'Abwesend', 'Approved Leave': 'Genehmigter Urlaub',
    'Active VIP': 'Aktiver VIP', Regular: 'Regulär', Lead: 'Interessent', Inactive: 'Inaktiv', Draft: 'Entwurf', Sent: 'Gesendet', Accepted: 'Akzeptiert', 'Converted to Invoice': 'In Rechnung umgewandelt', Cancelled: 'Storniert',
    Completed: 'Abgeschlossen', Packaging: 'Verpackung', 'Stored In Cold Room': 'Im Kühlraum gelagert', Stored: 'Gelagert', 'Pending Dispatch': 'Versand ausstehend', Reserved: 'Reserviert',
    Female: 'Weiblich', Male: 'Männlich', Unknown: 'Unbekannt', 'Active Broodstock': 'Aktiver Zuchtbestand', Resting: 'Ruhephase', 'Selected For Spawning': 'Für Laichen ausgewählt', 'Post Spawning': 'Nach dem Laichen', Retired: 'Ausgemustert',
    Incubating: 'In Inkubation', Hatched: 'Geschlüpft', Failed: 'Fehlgeschlagen', Active: 'Aktiv', Empty: 'Leer', Sanitizing: 'Desinfektion', Cleaning: 'Reinigung', Pending: 'Ausstehend', Rejected: 'Abgelehnt', Normal: 'Normal', Abnormal: 'Abnormal', Critical: 'Kritisch',
  },
  fr: {
    Purchase: 'Achat', Consumption: 'Consommation', Transfer: 'Transfert', Adjustment: 'Ajustement', Return: 'Retour', Waste: 'Perte', Production: 'Production', Sale: 'Vente',
    Calculated: 'Calculé', Approved: 'Approuvé', Paid: 'Payé', Present: 'Présent', Late: 'En retard', Absent: 'Absent', 'Approved Leave': 'Congé approuvé',
    'Active VIP': 'VIP actif', Regular: 'Régulier', Lead: 'Prospect', Inactive: 'Inactif', Draft: 'Brouillon', Sent: 'Envoyé', Accepted: 'Accepté', 'Converted to Invoice': 'Converti en facture', Cancelled: 'Annulé',
    Completed: 'Terminé', Packaging: 'Conditionnement', 'Stored In Cold Room': 'Stocké en chambre froide', Stored: 'Stocké', 'Pending Dispatch': 'En attente d’expédition', Reserved: 'Réservé',
    Female: 'Femelle', Male: 'Mâle', Unknown: 'Inconnu', 'Active Broodstock': 'Reproducteur actif', Resting: 'Repos', 'Selected For Spawning': 'Sélectionné pour reproduction', 'Post Spawning': 'Après reproduction', Retired: 'Retiré',
    Incubating: 'En incubation', Hatched: 'Éclos', Failed: 'Échec', Active: 'Actif', Empty: 'Vide', Sanitizing: 'Désinfection', Cleaning: 'Nettoyage', Pending: 'En attente', Rejected: 'Rejeté', Normal: 'Normal', Abnormal: 'Anormal', Critical: 'Critique',
  },
  es: {
    Purchase: 'Compra', Consumption: 'Consumo', Transfer: 'Transferencia', Adjustment: 'Ajuste', Return: 'Devolución', Waste: 'Merma', Production: 'Producción', Sale: 'Venta',
    Calculated: 'Calculado', Approved: 'Aprobado', Paid: 'Pagado', Present: 'Presente', Late: 'Tarde', Absent: 'Ausente', 'Approved Leave': 'Permiso aprobado',
    'Active VIP': 'VIP activo', Regular: 'Regular', Lead: 'Cliente potencial', Inactive: 'Inactivo', Draft: 'Borrador', Sent: 'Enviado', Accepted: 'Aceptado', 'Converted to Invoice': 'Convertido en factura', Cancelled: 'Cancelado',
    Completed: 'Completado', Packaging: 'Empaquetado', 'Stored In Cold Room': 'Almacenado en cámara fría', Stored: 'Almacenado', 'Pending Dispatch': 'Pendiente de envío', Reserved: 'Reservado',
    Female: 'Hembra', Male: 'Macho', Unknown: 'Desconocido', 'Active Broodstock': 'Reproductor activo', Resting: 'Reposo', 'Selected For Spawning': 'Seleccionado para desove', 'Post Spawning': 'Después del desove', Retired: 'Retirado',
    Incubating: 'Incubando', Hatched: 'Eclosionado', Failed: 'Fallido', Active: 'Activo', Empty: 'Vacío', Sanitizing: 'Desinfección', Cleaning: 'Limpieza', Pending: 'Pendiente', Rejected: 'Rechazado', Normal: 'Normal', Abnormal: 'Anormal', Critical: 'Crítico',
  },
  ru: {
    Purchase: 'Закупка', Consumption: 'Расход', Transfer: 'Перемещение', Adjustment: 'Корректировка', Return: 'Возврат', Waste: 'Потери', Production: 'Производство', Sale: 'Продажа',
    Calculated: 'Рассчитано', Approved: 'Одобрено', Paid: 'Оплачено', Present: 'Присутствует', Late: 'Опоздание', Absent: 'Отсутствует', 'Approved Leave': 'Отпуск одобрен',
    'Active VIP': 'Активный VIP', Regular: 'Обычный', Lead: 'Потенциальный клиент', Inactive: 'Неактивен', Draft: 'Черновик', Sent: 'Отправлено', Accepted: 'Принято', 'Converted to Invoice': 'Преобразовано в счёт', Cancelled: 'Отменено',
    Completed: 'Завершено', Packaging: 'Упаковка', 'Stored In Cold Room': 'На холодном хранении', Stored: 'Хранится', 'Pending Dispatch': 'Ожидает отправки', Reserved: 'Зарезервировано',
    Female: 'Самка', Male: 'Самец', Unknown: 'Неизвестно', 'Active Broodstock': 'Активный производитель', Resting: 'Отдых', 'Selected For Spawning': 'Выбран для нереста', 'Post Spawning': 'После нереста', Retired: 'Выведен',
    Incubating: 'Инкубация', Hatched: 'Вылуплено', Failed: 'Неудачно', Active: 'Активно', Empty: 'Пусто', Sanitizing: 'Дезинфекция', Cleaning: 'Очистка', Pending: 'Ожидается', Rejected: 'Отклонено', Normal: 'Норма', Abnormal: 'Отклонение', Critical: 'Критично',
  },
  ar: {
    Purchase: 'شراء', Consumption: 'استهلاك', Transfer: 'نقل', Adjustment: 'تسوية', Return: 'مرتجع', Waste: 'هدر', Production: 'إنتاج', Sale: 'بيع',
    Calculated: 'محسوب', Approved: 'معتمد', Paid: 'مدفوع', Present: 'حاضر', Late: 'متأخر', Absent: 'غائب', 'Approved Leave': 'إجازة معتمدة',
    'Active VIP': 'VIP نشط', Regular: 'عادي', Lead: 'عميل محتمل', Inactive: 'غير نشط', Draft: 'مسودة', Sent: 'مرسل', Accepted: 'مقبول', 'Converted to Invoice': 'محول إلى فاتورة', Cancelled: 'ملغي',
    Completed: 'مكتمل', Packaging: 'قيد التعبئة', 'Stored In Cold Room': 'مخزن في غرفة التبريد', Stored: 'مخزن', 'Pending Dispatch': 'بانتظار الإرسال', Reserved: 'محجوز',
    Female: 'أنثى', Male: 'ذكر', Unknown: 'غير معروف', 'Active Broodstock': 'أمهات وآباء نشطة', Resting: 'راحة', 'Selected For Spawning': 'مختار للتفريخ', 'Post Spawning': 'بعد التفريخ', Retired: 'متقاعد',
    Incubating: 'قيد الحضانة', Hatched: 'فاقس', Failed: 'فشل', Active: 'نشط', Empty: 'فارغ', Sanitizing: 'تعقيم', Cleaning: 'تنظيف', Pending: 'قيد الانتظار', Rejected: 'مرفوض', Normal: 'طبيعي', Abnormal: 'غير طبيعي', Critical: 'حرج',
  },
};

export function domainLabel(language: LanguageCode, value: string): string {
  const canonical = value.includes(' (') ? value.slice(0, value.indexOf(' (')) : value;
  const translated = labels[language]?.[canonical] || labels[language]?.[value];
  if (translated) return translated;
  if (language === 'fa') return value.match(/\((.*)\)/)?.[1] || canonical;
  return canonical;
}
