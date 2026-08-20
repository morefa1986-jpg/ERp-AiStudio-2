import { LanguageCode } from '../types';

export type RuntimeMessageKey =
  | 'auth.required'
  | 'auth.invalidCredentials'
  | 'auth.cryptoUnavailable'
  | 'auth.passwordTooShort'
  | 'auth.usernameExists'
  | 'auth.roleNameRequired'
  | 'feeding.pondNotFound'
  | 'feeding.locked'
  | 'feeding.validationFailed'
  | 'feeding.insufficientInventory'
  | 'feeding.stopped'
  | 'feeding.stoppedReason'
  | 'feeding.activeTreatment'
  | 'feeding.unsafeWater'
  | 'feeding.invalidBiomass'
  | 'feeding.invalidAmount'
  | 'feeding.feedNotFound'
  | 'feeding.notFeedItem'
  | 'feeding.stockShortage'
  | 'sensor.timestampInvalid'
  | 'sensor.timestampFuture'
  | 'sensor.stale'
  | 'sensor.missing'
  | 'sensor.zeroOrNegative'
  | 'sensor.outOfPhysicalRange'
  | 'sensor.belowFeedingThreshold'
  | 'sensor.aboveFeedingThreshold'
  | 'sensor.warningRange'
  | 'sensor.unsafeRange'
  | 'sensor.outsideOptimal'
  | 'sensor.chemicalInvalid'
  | 'sensor.chemicalCritical'
  | 'sensor.chemicalWarning'
  | 'sensor.invalidOrExpired'
  | 'sensor.waterCritical';

type Messages = Record<RuntimeMessageKey, string>;

const M: Record<LanguageCode, Messages> = {
  fa: {
    'auth.required': 'نام کاربری و رمز عبور الزامی است.',
    'auth.invalidCredentials': 'نام کاربری یا رمز عبور اشتباه است.',
    'auth.cryptoUnavailable': 'سرویس رمزنگاری محلی در دسترس نیست.',
    'auth.passwordTooShort': 'رمز عبور باید حداقل ۸ کاراکتر باشد.',
    'auth.usernameExists': 'این نام کاربری قبلاً ثبت شده است.',
    'auth.roleNameRequired': 'نام نقش الزامی است.',
    'feeding.pondNotFound': 'استخر یافت نشد.',
    'feeding.locked': 'تغذیه قفل است.',
    'feeding.validationFailed': 'اعتبارسنجی خوراک ناموفق بود.',
    'feeding.insufficientInventory': 'موجودی خوراک کافی نیست.',
    'feeding.stopped': 'ثبت خوراک غیرمجاز است: وضعیت استخر قطع تغذیه است.',
    'feeding.stoppedReason': 'تغذیه این استخر قطع است ({reason}: {details})',
    'feeding.activeTreatment': 'استخر تحت درمان فعال {drug} قرار دارد و تغذیه ممنوع است.',
    'feeding.unsafeWater': 'شرایط کیفیت آب برای تغذیه ایمن نیست.',
    'feeding.invalidBiomass': 'بیومس استخر نامعتبر است.',
    'feeding.invalidAmount': 'مقدار خوراک باید عددی معتبر و بزرگ‌تر از صفر باشد.',
    'feeding.feedNotFound': 'خوراک با کد {sku} در انبار یافت نشد.',
    'feeding.notFeedItem': 'کالای انتخاب‌شده خوراک نیست.',
    'feeding.stockShortage': 'موجودی ناکافی: موجودی {name} برابر {stock} kg و مقدار درخواست {requested} kg است.',
    'sensor.timestampInvalid': 'زمان ثبت {label} نامعتبر است.',
    'sensor.timestampFuture': 'زمان ثبت {label} در آینده است.',
    'sensor.stale': 'داده {label} قدیمی است ({hours} ساعت قبل).',
    'sensor.missing': 'مقدار {label} نامعتبر یا موجود نیست.',
    'sensor.zeroOrNegative': 'مقدار {label} صفر یا منفی است.',
    'sensor.outOfPhysicalRange': '{label} {value}{unit} خارج از محدوده فیزیکی است.',
    'sensor.belowFeedingThreshold': '{label} {value}{unit} کمتر از حد مجاز تغذیه است.',
    'sensor.aboveFeedingThreshold': '{label} {value}{unit} بالاتر از محدوده ایمن تغذیه است.',
    'sensor.warningRange': '{label} {value}{unit} در محدوده هشدار است.',
    'sensor.unsafeRange': '{label} {value} خارج از محدوده ایمن {min}-{max} است.',
    'sensor.outsideOptimal': '{label} {value} خارج از محدوده بهینه است.',
    'sensor.chemicalInvalid': '{label} نامعتبر است.',
    'sensor.chemicalCritical': '{label} در محدوده بحرانی است.',
    'sensor.chemicalWarning': '{label} بالاتر از محدوده ایمن است.',
    'sensor.invalidOrExpired': 'داده سنسور نامعتبر یا منقضی است.',
    'sensor.waterCritical': 'یکی از پارامترهای آب در محدوده بحرانی است.',
  },
  en: {
    'auth.required': 'Username and password are required.', 'auth.invalidCredentials': 'Incorrect username or password.', 'auth.cryptoUnavailable': 'Local cryptography service is unavailable.', 'auth.passwordTooShort': 'Password must be at least 8 characters.', 'auth.usernameExists': 'This username already exists.', 'auth.roleNameRequired': 'Role name is required.',
    'feeding.pondNotFound': 'Pond not found.', 'feeding.locked': 'Feeding is locked.', 'feeding.validationFailed': 'Feed validation failed.', 'feeding.insufficientInventory': 'Insufficient feed inventory.', 'feeding.stopped': 'Feed entry is not allowed: pond feeding is stopped.', 'feeding.stoppedReason': 'Feeding is stopped for this pond ({reason}: {details})', 'feeding.activeTreatment': 'The pond has an active treatment ({drug}); feeding is prohibited.', 'feeding.unsafeWater': 'Water quality is not safe for feeding.', 'feeding.invalidBiomass': 'Pond biomass is invalid.', 'feeding.invalidAmount': 'Feed amount must be a valid number greater than zero.', 'feeding.feedNotFound': 'Feed SKU {sku} was not found in inventory.', 'feeding.notFeedItem': 'The selected inventory item is not feed.', 'feeding.stockShortage': 'Insufficient stock: {name} has {stock} kg available; requested {requested} kg.',
    'sensor.timestampInvalid': '{label} timestamp is invalid.', 'sensor.timestampFuture': '{label} timestamp is in the future.', 'sensor.stale': '{label} data is stale ({hours} hours old).', 'sensor.missing': '{label} value is invalid or unavailable.', 'sensor.zeroOrNegative': '{label} is zero or negative.', 'sensor.outOfPhysicalRange': '{label} {value}{unit} is outside the physical range.', 'sensor.belowFeedingThreshold': '{label} {value}{unit} is below the feeding threshold.', 'sensor.aboveFeedingThreshold': '{label} {value}{unit} is above the safe feeding range.', 'sensor.warningRange': '{label} {value}{unit} is in the warning range.', 'sensor.unsafeRange': '{label} {value} is outside the safe range {min}-{max}.', 'sensor.outsideOptimal': '{label} {value} is outside the optimal range.', 'sensor.chemicalInvalid': '{label} is invalid.', 'sensor.chemicalCritical': '{label} is in the critical range.', 'sensor.chemicalWarning': '{label} is above the safe range.', 'sensor.invalidOrExpired': 'Sensor data is invalid or expired.', 'sensor.waterCritical': 'One or more water parameters are critical.',
  },
  de: {
    'auth.required': 'Benutzername und Passwort sind erforderlich.', 'auth.invalidCredentials': 'Benutzername oder Passwort ist falsch.', 'auth.cryptoUnavailable': 'Lokaler Kryptografiedienst ist nicht verfügbar.', 'auth.passwordTooShort': 'Das Passwort muss mindestens 8 Zeichen lang sein.', 'auth.usernameExists': 'Dieser Benutzername existiert bereits.', 'auth.roleNameRequired': 'Der Rollenname ist erforderlich.',
    'feeding.pondNotFound': 'Becken nicht gefunden.', 'feeding.locked': 'Die Fütterung ist gesperrt.', 'feeding.validationFailed': 'Futterprüfung fehlgeschlagen.', 'feeding.insufficientInventory': 'Nicht genügend Futterbestand.', 'feeding.stopped': 'Futtereintrag nicht erlaubt: Die Fütterung des Beckens ist gestoppt.', 'feeding.stoppedReason': 'Die Fütterung dieses Beckens ist gestoppt ({reason}: {details})', 'feeding.activeTreatment': 'Das Becken wird aktiv behandelt ({drug}); Fütterung ist verboten.', 'feeding.unsafeWater': 'Die Wasserqualität ist für die Fütterung nicht sicher.', 'feeding.invalidBiomass': 'Die Biomasse des Beckens ist ungültig.', 'feeding.invalidAmount': 'Die Futtermenge muss eine gültige Zahl größer als null sein.', 'feeding.feedNotFound': 'Futter-SKU {sku} wurde im Lager nicht gefunden.', 'feeding.notFeedItem': 'Der ausgewählte Lagerartikel ist kein Futter.', 'feeding.stockShortage': 'Unzureichender Bestand: {name} hat {stock} kg; angefordert {requested} kg.',
    'sensor.timestampInvalid': 'Zeitstempel für {label} ist ungültig.', 'sensor.timestampFuture': 'Zeitstempel für {label} liegt in der Zukunft.', 'sensor.stale': '{label}-Daten sind veraltet ({hours} Stunden).', 'sensor.missing': '{label}-Wert ist ungültig oder nicht verfügbar.', 'sensor.zeroOrNegative': '{label} ist null oder negativ.', 'sensor.outOfPhysicalRange': '{label} {value}{unit} liegt außerhalb des physikalischen Bereichs.', 'sensor.belowFeedingThreshold': '{label} {value}{unit} liegt unter der Fütterungsgrenze.', 'sensor.aboveFeedingThreshold': '{label} {value}{unit} liegt über dem sicheren Fütterungsbereich.', 'sensor.warningRange': '{label} {value}{unit} liegt im Warnbereich.', 'sensor.unsafeRange': '{label} {value} liegt außerhalb des sicheren Bereichs {min}-{max}.', 'sensor.outsideOptimal': '{label} {value} liegt außerhalb des Optimalbereichs.', 'sensor.chemicalInvalid': '{label} ist ungültig.', 'sensor.chemicalCritical': '{label} liegt im kritischen Bereich.', 'sensor.chemicalWarning': '{label} liegt über dem sicheren Bereich.', 'sensor.invalidOrExpired': 'Sensordaten sind ungültig oder abgelaufen.', 'sensor.waterCritical': 'Mindestens ein Wasserparameter ist kritisch.',
  },
  fr: {
    'auth.required': "Le nom d’utilisateur et le mot de passe sont requis.", 'auth.invalidCredentials': "Nom d’utilisateur ou mot de passe incorrect.", 'auth.cryptoUnavailable': 'Le service cryptographique local est indisponible.', 'auth.passwordTooShort': 'Le mot de passe doit comporter au moins 8 caractères.', 'auth.usernameExists': "Ce nom d’utilisateur existe déjà.", 'auth.roleNameRequired': 'Le nom du rôle est requis.',
    'feeding.pondNotFound': 'Bassin introuvable.', 'feeding.locked': "L’alimentation est verrouillée.", 'feeding.validationFailed': 'Échec de validation de l’aliment.', 'feeding.insufficientInventory': "Stock d’aliment insuffisant.", 'feeding.stopped': "Enregistrement interdit : l’alimentation du bassin est arrêtée.", 'feeding.stoppedReason': "L’alimentation de ce bassin est arrêtée ({reason} : {details})", 'feeding.activeTreatment': 'Le bassin est sous traitement actif ({drug}) ; alimentation interdite.', 'feeding.unsafeWater': "La qualité de l’eau n’est pas sûre pour l’alimentation.", 'feeding.invalidBiomass': 'La biomasse du bassin est invalide.', 'feeding.invalidAmount': 'La quantité doit être un nombre valide supérieur à zéro.', 'feeding.feedNotFound': "L’aliment SKU {sku} est introuvable en stock.", 'feeding.notFeedItem': "L’article sélectionné n’est pas un aliment.", 'feeding.stockShortage': 'Stock insuffisant : {name} dispose de {stock} kg ; demande {requested} kg.',
    'sensor.timestampInvalid': "L’horodatage de {label} est invalide.", 'sensor.timestampFuture': "L’horodatage de {label} est dans le futur.", 'sensor.stale': 'Les données {label} sont périmées ({hours} h).', 'sensor.missing': 'La valeur {label} est invalide ou indisponible.', 'sensor.zeroOrNegative': '{label} est nul ou négatif.', 'sensor.outOfPhysicalRange': '{label} {value}{unit} est hors plage physique.', 'sensor.belowFeedingThreshold': '{label} {value}{unit} est sous le seuil d’alimentation.', 'sensor.aboveFeedingThreshold': '{label} {value}{unit} dépasse la plage sûre d’alimentation.', 'sensor.warningRange': '{label} {value}{unit} est dans la plage d’alerte.', 'sensor.unsafeRange': '{label} {value} est hors plage sûre {min}-{max}.', 'sensor.outsideOptimal': '{label} {value} est hors plage optimale.', 'sensor.chemicalInvalid': '{label} est invalide.', 'sensor.chemicalCritical': '{label} est dans la plage critique.', 'sensor.chemicalWarning': '{label} dépasse la plage sûre.', 'sensor.invalidOrExpired': 'Les données capteur sont invalides ou expirées.', 'sensor.waterCritical': 'Un ou plusieurs paramètres de l’eau sont critiques.',
  },
  es: {
    'auth.required': 'El usuario y la contraseña son obligatorios.', 'auth.invalidCredentials': 'Usuario o contraseña incorrectos.', 'auth.cryptoUnavailable': 'El servicio criptográfico local no está disponible.', 'auth.passwordTooShort': 'La contraseña debe tener al menos 8 caracteres.', 'auth.usernameExists': 'Este nombre de usuario ya existe.', 'auth.roleNameRequired': 'El nombre del rol es obligatorio.',
    'feeding.pondNotFound': 'Estanque no encontrado.', 'feeding.locked': 'La alimentación está bloqueada.', 'feeding.validationFailed': 'Falló la validación del alimento.', 'feeding.insufficientInventory': 'Inventario de alimento insuficiente.', 'feeding.stopped': 'No se permite registrar alimento: la alimentación del estanque está detenida.', 'feeding.stoppedReason': 'La alimentación de este estanque está detenida ({reason}: {details})', 'feeding.activeTreatment': 'El estanque tiene un tratamiento activo ({drug}); la alimentación está prohibida.', 'feeding.unsafeWater': 'La calidad del agua no es segura para alimentar.', 'feeding.invalidBiomass': 'La biomasa del estanque no es válida.', 'feeding.invalidAmount': 'La cantidad de alimento debe ser un número válido mayor que cero.', 'feeding.feedNotFound': 'No se encontró el alimento SKU {sku} en inventario.', 'feeding.notFeedItem': 'El artículo seleccionado no es alimento.', 'feeding.stockShortage': 'Stock insuficiente: {name} tiene {stock} kg; se solicitaron {requested} kg.',
    'sensor.timestampInvalid': 'La marca de tiempo de {label} no es válida.', 'sensor.timestampFuture': 'La marca de tiempo de {label} está en el futuro.', 'sensor.stale': 'Los datos de {label} están obsoletos ({hours} h).', 'sensor.missing': 'El valor de {label} no es válido o no está disponible.', 'sensor.zeroOrNegative': '{label} es cero o negativo.', 'sensor.outOfPhysicalRange': '{label} {value}{unit} está fuera del rango físico.', 'sensor.belowFeedingThreshold': '{label} {value}{unit} está por debajo del umbral de alimentación.', 'sensor.aboveFeedingThreshold': '{label} {value}{unit} supera el rango seguro de alimentación.', 'sensor.warningRange': '{label} {value}{unit} está en rango de advertencia.', 'sensor.unsafeRange': '{label} {value} está fuera del rango seguro {min}-{max}.', 'sensor.outsideOptimal': '{label} {value} está fuera del rango óptimo.', 'sensor.chemicalInvalid': '{label} no es válido.', 'sensor.chemicalCritical': '{label} está en rango crítico.', 'sensor.chemicalWarning': '{label} supera el rango seguro.', 'sensor.invalidOrExpired': 'Los datos del sensor no son válidos o han caducado.', 'sensor.waterCritical': 'Uno o más parámetros del agua son críticos.',
  },
  ru: {
    'auth.required': 'Требуются имя пользователя и пароль.', 'auth.invalidCredentials': 'Неверное имя пользователя или пароль.', 'auth.cryptoUnavailable': 'Локальная криптографическая служба недоступна.', 'auth.passwordTooShort': 'Пароль должен содержать не менее 8 символов.', 'auth.usernameExists': 'Это имя пользователя уже существует.', 'auth.roleNameRequired': 'Требуется название роли.',
    'feeding.pondNotFound': 'Бассейн не найден.', 'feeding.locked': 'Кормление заблокировано.', 'feeding.validationFailed': 'Проверка корма не пройдена.', 'feeding.insufficientInventory': 'Недостаточный запас корма.', 'feeding.stopped': 'Регистрация корма запрещена: кормление бассейна остановлено.', 'feeding.stoppedReason': 'Кормление этого бассейна остановлено ({reason}: {details})', 'feeding.activeTreatment': 'В бассейне проводится активное лечение ({drug}); кормление запрещено.', 'feeding.unsafeWater': 'Качество воды небезопасно для кормления.', 'feeding.invalidBiomass': 'Биомасса бассейна недействительна.', 'feeding.invalidAmount': 'Количество корма должно быть корректным числом больше нуля.', 'feeding.feedNotFound': 'Корм с SKU {sku} не найден на складе.', 'feeding.notFeedItem': 'Выбранная складская позиция не является кормом.', 'feeding.stockShortage': 'Недостаточный запас: {name} — {stock} кг; запрошено {requested} кг.',
    'sensor.timestampInvalid': 'Временная метка {label} недействительна.', 'sensor.timestampFuture': 'Временная метка {label} находится в будущем.', 'sensor.stale': 'Данные {label} устарели ({hours} ч).', 'sensor.missing': 'Значение {label} недействительно или отсутствует.', 'sensor.zeroOrNegative': '{label} равно нулю или отрицательно.', 'sensor.outOfPhysicalRange': '{label} {value}{unit} вне физического диапазона.', 'sensor.belowFeedingThreshold': '{label} {value}{unit} ниже порога кормления.', 'sensor.aboveFeedingThreshold': '{label} {value}{unit} выше безопасного диапазона кормления.', 'sensor.warningRange': '{label} {value}{unit} находится в зоне предупреждения.', 'sensor.unsafeRange': '{label} {value} вне безопасного диапазона {min}-{max}.', 'sensor.outsideOptimal': '{label} {value} вне оптимального диапазона.', 'sensor.chemicalInvalid': '{label} недействителен.', 'sensor.chemicalCritical': '{label} находится в критическом диапазоне.', 'sensor.chemicalWarning': '{label} выше безопасного диапазона.', 'sensor.invalidOrExpired': 'Данные датчика недействительны или устарели.', 'sensor.waterCritical': 'Один или несколько параметров воды критические.',
  },
  ar: {
    'auth.required': 'اسم المستخدم وكلمة المرور مطلوبان.', 'auth.invalidCredentials': 'اسم المستخدم أو كلمة المرور غير صحيحة.', 'auth.cryptoUnavailable': 'خدمة التشفير المحلية غير متاحة.', 'auth.passwordTooShort': 'يجب ألا تقل كلمة المرور عن 8 أحرف.', 'auth.usernameExists': 'اسم المستخدم هذا موجود مسبقًا.', 'auth.roleNameRequired': 'اسم الدور مطلوب.',
    'feeding.pondNotFound': 'الحوض غير موجود.', 'feeding.locked': 'التغذية مقفلة.', 'feeding.validationFailed': 'فشل التحقق من العلف.', 'feeding.insufficientInventory': 'مخزون العلف غير كافٍ.', 'feeding.stopped': 'لا يُسمح بتسجيل العلف: تغذية الحوض متوقفة.', 'feeding.stoppedReason': 'تغذية هذا الحوض متوقفة ({reason}: {details})', 'feeding.activeTreatment': 'الحوض تحت علاج نشط ({drug})؛ التغذية ممنوعة.', 'feeding.unsafeWater': 'جودة المياه غير آمنة للتغذية.', 'feeding.invalidBiomass': 'الكتلة الحيوية للحوض غير صالحة.', 'feeding.invalidAmount': 'يجب أن تكون كمية العلف رقمًا صالحًا أكبر من صفر.', 'feeding.feedNotFound': 'العلف ذو الرمز {sku} غير موجود في المخزون.', 'feeding.notFeedItem': 'الصنف المحدد ليس علفًا.', 'feeding.stockShortage': 'المخزون غير كافٍ: المتاح من {name} هو {stock} كجم والمطلوب {requested} كجم.',
    'sensor.timestampInvalid': 'وقت تسجيل {label} غير صالح.', 'sensor.timestampFuture': 'وقت تسجيل {label} في المستقبل.', 'sensor.stale': 'بيانات {label} قديمة ({hours} ساعة).', 'sensor.missing': 'قيمة {label} غير صالحة أو غير متاحة.', 'sensor.zeroOrNegative': 'قيمة {label} صفر أو سالبة.', 'sensor.outOfPhysicalRange': '{label} {value}{unit} خارج النطاق الفيزيائي.', 'sensor.belowFeedingThreshold': '{label} {value}{unit} أقل من حد التغذية.', 'sensor.aboveFeedingThreshold': '{label} {value}{unit} أعلى من نطاق التغذية الآمن.', 'sensor.warningRange': '{label} {value}{unit} ضمن نطاق التحذير.', 'sensor.unsafeRange': '{label} {value} خارج النطاق الآمن {min}-{max}.', 'sensor.outsideOptimal': '{label} {value} خارج النطاق الأمثل.', 'sensor.chemicalInvalid': '{label} غير صالح.', 'sensor.chemicalCritical': '{label} ضمن النطاق الحرج.', 'sensor.chemicalWarning': '{label} أعلى من النطاق الآمن.', 'sensor.invalidOrExpired': 'بيانات الحساس غير صالحة أو منتهية.', 'sensor.waterCritical': 'هناك عامل أو أكثر من عوامل المياه في النطاق الحرج.',
  },
};

const VALUE_LABELS: Record<LanguageCode, Record<string, string>> = {
  fa: { ACTIVE: 'فعال', STOPPED: 'قطع تغذیه', COMPLETED: 'تکمیل‌شده', CANCELLED: 'لغوشده', VALID: 'معتبر', INVALID: 'نامعتبر', WARNING: 'هشدار', CRITICAL: 'بحرانی', STALE: 'قدیمی', SENSOR_FAULT: 'خطای سنسور', DISCONNECTED: 'قطع ارتباط', Draft: 'پیش‌نویس', Review: 'در انتظار بررسی', Approved: 'تأییدشده', 'Ready to Publish': 'آماده انتشار', Published: 'منتشرشده', Adequate: 'کافی', 'Low Stock': 'موجودی کم', 'Critical Low': 'موجودی بحرانی', Expired: 'منقضی', Active: 'فعال', Inactive: 'غیرفعال' },
  en: { ACTIVE: 'Active', STOPPED: 'Feeding stopped', COMPLETED: 'Completed', CANCELLED: 'Cancelled', VALID: 'Valid', INVALID: 'Invalid', WARNING: 'Warning', CRITICAL: 'Critical', STALE: 'Stale', SENSOR_FAULT: 'Sensor fault', DISCONNECTED: 'Disconnected', Draft: 'Draft', Review: 'Review', Approved: 'Approved', 'Ready to Publish': 'Ready to publish', Published: 'Published', Adequate: 'Adequate', 'Low Stock': 'Low stock', 'Critical Low': 'Critical low', Expired: 'Expired', Active: 'Active', Inactive: 'Inactive' },
  de: { ACTIVE: 'Aktiv', STOPPED: 'Fütterung gestoppt', COMPLETED: 'Abgeschlossen', CANCELLED: 'Abgebrochen', VALID: 'Gültig', INVALID: 'Ungültig', WARNING: 'Warnung', CRITICAL: 'Kritisch', STALE: 'Veraltet', SENSOR_FAULT: 'Sensorfehler', DISCONNECTED: 'Getrennt', Draft: 'Entwurf', Review: 'Prüfung', Approved: 'Freigegeben', 'Ready to Publish': 'Veröffentlichungsbereit', Published: 'Veröffentlicht', Adequate: 'Ausreichend', 'Low Stock': 'Niedriger Bestand', 'Critical Low': 'Kritischer Bestand', Expired: 'Abgelaufen', Active: 'Aktiv', Inactive: 'Inaktiv' },
  fr: { ACTIVE: 'Actif', STOPPED: 'Alimentation arrêtée', COMPLETED: 'Terminé', CANCELLED: 'Annulé', VALID: 'Valide', INVALID: 'Invalide', WARNING: 'Alerte', CRITICAL: 'Critique', STALE: 'Périmé', SENSOR_FAULT: 'Défaut capteur', DISCONNECTED: 'Déconnecté', Draft: 'Brouillon', Review: 'Validation', Approved: 'Approuvé', 'Ready to Publish': 'Prêt à publier', Published: 'Publié', Adequate: 'Suffisant', 'Low Stock': 'Stock faible', 'Critical Low': 'Stock critique', Expired: 'Expiré', Active: 'Actif', Inactive: 'Inactif' },
  es: { ACTIVE: 'Activo', STOPPED: 'Alimentación detenida', COMPLETED: 'Completado', CANCELLED: 'Cancelado', VALID: 'Válido', INVALID: 'No válido', WARNING: 'Advertencia', CRITICAL: 'Crítico', STALE: 'Obsoleto', SENSOR_FAULT: 'Fallo de sensor', DISCONNECTED: 'Desconectado', Draft: 'Borrador', Review: 'Revisión', Approved: 'Aprobado', 'Ready to Publish': 'Listo para publicar', Published: 'Publicado', Adequate: 'Adecuado', 'Low Stock': 'Stock bajo', 'Critical Low': 'Stock crítico', Expired: 'Caducado', Active: 'Activo', Inactive: 'Inactivo' },
  ru: { ACTIVE: 'Активно', STOPPED: 'Кормление остановлено', COMPLETED: 'Завершено', CANCELLED: 'Отменено', VALID: 'Действительно', INVALID: 'Недействительно', WARNING: 'Предупреждение', CRITICAL: 'Критично', STALE: 'Устарело', SENSOR_FAULT: 'Ошибка датчика', DISCONNECTED: 'Отключено', Draft: 'Черновик', Review: 'На проверке', Approved: 'Одобрено', 'Ready to Publish': 'Готово к публикации', Published: 'Опубликовано', Adequate: 'Достаточно', 'Low Stock': 'Мало на складе', 'Critical Low': 'Критически мало', Expired: 'Просрочено', Active: 'Активно', Inactive: 'Неактивно' },
  ar: { ACTIVE: 'نشط', STOPPED: 'التغذية متوقفة', COMPLETED: 'مكتمل', CANCELLED: 'ملغي', VALID: 'صالح', INVALID: 'غير صالح', WARNING: 'تحذير', CRITICAL: 'حرج', STALE: 'قديم', SENSOR_FAULT: 'خلل حساس', DISCONNECTED: 'غير متصل', Draft: 'مسودة', Review: 'قيد المراجعة', Approved: 'معتمد', 'Ready to Publish': 'جاهز للنشر', Published: 'منشور', Adequate: 'كافٍ', 'Low Stock': 'مخزون منخفض', 'Critical Low': 'مخزون حرج', Expired: 'منتهي', Active: 'نشط', Inactive: 'غير نشط' },
};

const UNIT_LABELS: Record<LanguageCode, Record<string, string>> = {
  fa: { kg: 'کیلوگرم', g: 'گرم', gram: 'گرم', cup: 'پیمانه ۲۵۰ گرمی', cup250g: 'پیمانه ۲۵۰ گرمی', ton: 'تن', t: 'تن', bag_25kg: 'کیسه ۲۵ کیلوگرمی' },
  en: { kg: 'kg', g: 'g', gram: 'g', cup: '250 g scoop', cup250g: '250 g scoop', ton: 'ton', t: 'ton', bag_25kg: '25 kg bag' },
  de: { kg: 'kg', g: 'g', gram: 'g', cup: '250-g-Messbecher', cup250g: '250-g-Messbecher', ton: 'Tonne', t: 'Tonne', bag_25kg: '25-kg-Sack' },
  fr: { kg: 'kg', g: 'g', gram: 'g', cup: 'dose de 250 g', cup250g: 'dose de 250 g', ton: 'tonne', t: 'tonne', bag_25kg: 'sac de 25 kg' },
  es: { kg: 'kg', g: 'g', gram: 'g', cup: 'medida de 250 g', cup250g: 'medida de 250 g', ton: 'tonelada', t: 'tonelada', bag_25kg: 'saco de 25 kg' },
  ru: { kg: 'кг', g: 'г', gram: 'г', cup: 'мерка 250 г', cup250g: 'мерка 250 г', ton: 'т', t: 'т', bag_25kg: 'мешок 25 кг' },
  ar: { kg: 'كجم', g: 'جم', gram: 'جم', cup: 'مكيال 250 جم', cup250g: 'مكيال 250 جم', ton: 'طن', t: 'طن', bag_25kg: 'كيس 25 كجم' },
};

const SENSOR_LABELS: Record<LanguageCode, Record<string, string>> = {
  fa: { oxygen: 'اکسیژن', temperature: 'دما', ph: 'pH', ammonia: 'آمونیاک', nitrite: 'نیتریت' },
  en: { oxygen: 'Dissolved oxygen', temperature: 'Temperature', ph: 'pH', ammonia: 'Ammonia', nitrite: 'Nitrite' },
  de: { oxygen: 'Gelöster Sauerstoff', temperature: 'Temperatur', ph: 'pH', ammonia: 'Ammoniak', nitrite: 'Nitrit' },
  fr: { oxygen: 'Oxygène dissous', temperature: 'Température', ph: 'pH', ammonia: 'Ammoniac', nitrite: 'Nitrite' },
  es: { oxygen: 'Oxígeno disuelto', temperature: 'Temperatura', ph: 'pH', ammonia: 'Amoníaco', nitrite: 'Nitrito' },
  ru: { oxygen: 'Растворённый кислород', temperature: 'Температура', ph: 'pH', ammonia: 'Аммиак', nitrite: 'Нитрит' },
  ar: { oxygen: 'الأكسجين المذاب', temperature: 'درجة الحرارة', ph: 'pH', ammonia: 'الأمونيا', nitrite: 'النتريت' },
};

export function runtimeMessage(language: LanguageCode, key: RuntimeMessageKey, params?: Record<string, string | number>): string {
  const template = (M[language] || M.en)[key] || M.en[key] || key;
  if (!params) return template;
  return Object.entries(params).reduce((text, [name, value]) => text.replace(new RegExp(`{${name}}`, 'g'), String(value)), template);
}

export function runtimeValueLabel(language: LanguageCode, value: string): string {
  return VALUE_LABELS[language]?.[value] || VALUE_LABELS.en[value] || value;
}

export function runtimeUnitLabel(language: LanguageCode, unit: string): string {
  return UNIT_LABELS[language]?.[unit] || UNIT_LABELS.en[unit] || unit;
}

export function runtimeSensorLabel(language: LanguageCode, sensor: 'oxygen' | 'temperature' | 'ph' | 'ammonia' | 'nitrite'): string {
  return SENSOR_LABELS[language]?.[sensor] || SENSOR_LABELS.en[sensor] || sensor;
}

export const RUNTIME_LOCALES: LanguageCode[] = ['fa', 'en', 'de', 'fr', 'es', 'ru', 'ar'];
