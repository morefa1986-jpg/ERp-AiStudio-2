import { LanguageCode } from '../types';

const ERROR_MESSAGES: Record<LanguageCode, Record<string, string>> = {
  fa: {
    AUTH_REQUIRED: 'برای انجام این عملیات ورود به حساب لازم است.',
    ACTION_NOT_ALLOWED: 'دسترسی شما برای این عملیات کافی نیست.',
    STATE_VERSION_CONFLICT: 'داده‌ها همزمان تغییر کرده‌اند؛ لطفاً صفحه را تازه‌سازی کنید.',
    STATE_SAVE_FAILED: 'ذخیره‌سازی پایدار انجام نشد.',
    SOCIAL_DRAFT_INPUT_INVALID: 'اطلاعات پیش‌نویس شبکه اجتماعی کامل نیست.',
    SOCIAL_PLATFORM_INVALID: 'شبکه اجتماعی انتخاب‌شده معتبر نیست.',
    FX_RATE_INVALID: 'نرخ تبدیل ارز معتبر نیست.',
    FX_SOURCE_BALANCE_INSUFFICIENT: 'موجودی حساب مبدا برای تبدیل ارز کافی نیست.',
    FATHI_LAN_TLS_CERT_AND_KEY_REQUIRED: 'برای حالت LAN باید گواهی و کلید TLS تنظیم شود.',
  },
  en: {
    AUTH_REQUIRED: 'Authentication is required for this action.',
    ACTION_NOT_ALLOWED: 'Your role is not allowed to perform this action.',
    STATE_VERSION_CONFLICT: 'The data changed concurrently; refresh and try again.',
    STATE_SAVE_FAILED: 'Durable save failed.',
    SOCIAL_DRAFT_INPUT_INVALID: 'The social media draft is incomplete.',
    SOCIAL_PLATFORM_INVALID: 'The selected social platform is invalid.',
    FX_RATE_INVALID: 'The FX conversion rate is invalid.',
    FX_SOURCE_BALANCE_INSUFFICIENT: 'The source account balance is insufficient for the FX conversion.',
    FATHI_LAN_TLS_CERT_AND_KEY_REQUIRED: 'LAN mode requires a TLS certificate and key.',
  },
  de: {
    AUTH_REQUIRED: 'Für diese Aktion ist eine Anmeldung erforderlich.',
    ACTION_NOT_ALLOWED: 'Ihre Rolle darf diese Aktion nicht ausführen.',
    STATE_VERSION_CONFLICT: 'Die Daten wurden gleichzeitig geändert; bitte aktualisieren.',
    STATE_SAVE_FAILED: 'Dauerhafte Speicherung fehlgeschlagen.',
    SOCIAL_DRAFT_INPUT_INVALID: 'Der Social-Media-Entwurf ist unvollständig.',
    SOCIAL_PLATFORM_INVALID: 'Die ausgewählte Plattform ist ungültig.',
    FX_RATE_INVALID: 'Der Wechselkurs ist ungültig.',
    FX_SOURCE_BALANCE_INSUFFICIENT: 'Das Quellkonto hat nicht genug Guthaben für die Umrechnung.',
    FATHI_LAN_TLS_CERT_AND_KEY_REQUIRED: 'Für den LAN-Modus sind TLS-Zertifikat und Schlüssel erforderlich.',
  },
  fr: {
    AUTH_REQUIRED: 'Une authentification est requise pour cette action.',
    ACTION_NOT_ALLOWED: 'Votre rôle ne permet pas cette action.',
    STATE_VERSION_CONFLICT: 'Les données ont changé simultanément ; actualisez puis réessayez.',
    STATE_SAVE_FAILED: 'L’enregistrement durable a échoué.',
    SOCIAL_DRAFT_INPUT_INVALID: 'Le brouillon social est incomplet.',
    SOCIAL_PLATFORM_INVALID: 'La plateforme sociale sélectionnée est invalide.',
    FX_RATE_INVALID: 'Le taux de change est invalide.',
    FX_SOURCE_BALANCE_INSUFFICIENT: 'Le compte source est insuffisant pour la conversion.',
    FATHI_LAN_TLS_CERT_AND_KEY_REQUIRED: 'Le mode LAN nécessite un certificat et une clé TLS.',
  },
  es: {
    AUTH_REQUIRED: 'Se requiere autenticación para esta acción.',
    ACTION_NOT_ALLOWED: 'Tu rol no permite realizar esta acción.',
    STATE_VERSION_CONFLICT: 'Los datos cambiaron al mismo tiempo; actualiza e inténtalo de nuevo.',
    STATE_SAVE_FAILED: 'Falló el guardado duradero.',
    SOCIAL_DRAFT_INPUT_INVALID: 'El borrador social está incompleto.',
    SOCIAL_PLATFORM_INVALID: 'La plataforma social seleccionada no es válida.',
    FX_RATE_INVALID: 'La tasa de cambio no es válida.',
    FX_SOURCE_BALANCE_INSUFFICIENT: 'La cuenta de origen no tiene saldo suficiente para la conversión.',
    FATHI_LAN_TLS_CERT_AND_KEY_REQUIRED: 'El modo LAN requiere certificado y clave TLS.',
  },
  ru: {
    AUTH_REQUIRED: 'Для этого действия требуется вход в систему.',
    ACTION_NOT_ALLOWED: 'Ваша роль не разрешает это действие.',
    STATE_VERSION_CONFLICT: 'Данные были изменены одновременно; обновите страницу и повторите.',
    STATE_SAVE_FAILED: 'Надежное сохранение не выполнено.',
    SOCIAL_DRAFT_INPUT_INVALID: 'Черновик для соцсетей заполнен не полностью.',
    SOCIAL_PLATFORM_INVALID: 'Выбранная социальная платформа недействительна.',
    FX_RATE_INVALID: 'Курс валюты недействителен.',
    FX_SOURCE_BALANCE_INSUFFICIENT: 'На исходном счете недостаточно средств для конвертации.',
    FATHI_LAN_TLS_CERT_AND_KEY_REQUIRED: 'Для режима LAN требуются TLS-сертификат и ключ.',
  },
  ar: {
    AUTH_REQUIRED: 'يلزم تسجيل الدخول لتنفيذ هذه العملية.',
    ACTION_NOT_ALLOWED: 'لا يملك دورك صلاحية تنفيذ هذه العملية.',
    STATE_VERSION_CONFLICT: 'تم تغيير البيانات بالتزامن؛ حدّث الصفحة ثم حاول مرة أخرى.',
    STATE_SAVE_FAILED: 'فشل الحفظ الدائم.',
    SOCIAL_DRAFT_INPUT_INVALID: 'مسودة التواصل الاجتماعي غير مكتملة.',
    SOCIAL_PLATFORM_INVALID: 'منصة التواصل المحددة غير صالحة.',
    FX_RATE_INVALID: 'سعر تحويل العملة غير صالح.',
    FX_SOURCE_BALANCE_INSUFFICIENT: 'رصيد الحساب المصدر غير كافٍ للتحويل.',
    FATHI_LAN_TLS_CERT_AND_KEY_REQUIRED: 'يتطلب وضع LAN شهادة ومفتاح TLS.',
  },
};

export function translateErrorCode(code: string, language: LanguageCode): string {
  const normalized = String(code || '').split(':')[0];
  return ERROR_MESSAGES[language]?.[normalized] || ERROR_MESSAGES.en[normalized] || normalized || ERROR_MESSAGES.en.STATE_SAVE_FAILED;
}

export function errorMessageKeys(): string[] {
  return Object.keys(ERROR_MESSAGES.en);
}

export function errorMessagesFor(language: LanguageCode): Record<string, string> {
  return ERROR_MESSAGES[language];
}
