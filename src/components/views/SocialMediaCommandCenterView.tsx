import React, { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../i18n';
import { useAuth } from '../../context/AuthContext';
import {
  CheckCircle2,
  ClipboardCheck,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  Library,
  Link2,
  LogIn,
  Pencil,
  PlayCircle,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
  Video,
} from 'lucide-react';
import {
  createEditedImageVersion,
  deleteMediaAsset,
  listMediaAssets,
  LocalMediaAsset,
  saveMediaFile,
} from '../../services/localMediaLibrary';
import {
  copyCampaignCaption,
  deleteSocialDraft,
  formatCaption,
  listSocialConnections,
  listSocialDrafts,
  openPlatformComposer,
  openPlatformLogin,
  saveSocialDraft,
  setSocialConnection,
  shareCampaignFiles,
  SOCIAL_PLATFORMS,
  SocialCampaignDraft,
  SocialConnectionState,
  SocialPlatformId,
  updateSocialDraft,
} from '../../services/socialMediaCommandService';

type TabId = 'overview' | 'accounts' | 'library' | 'composer' | 'queue';

const COPY = {
  fa: {
    title: 'مرکز فرماندهی شبکه‌های اجتماعی', subtitle: 'مدیریت عکس، ویدئو، کپشن، تأیید مدیر و انتشار بدون ذخیره رمز عبور و بدون API اجباری',
    overview: 'داشبورد', accounts: 'اتصال حساب‌ها', library: 'کتابخانه رسانه', composer: 'ساخت و ویرایش پست', queue: 'صف تأیید و انتشار',
    noApi: 'حالت امن بدون API: رمز عبور هیچ شبکه‌ای در ERP ذخیره نمی‌شود. ورود در سایت رسمی همان شبکه انجام می‌شود.',
    internalStats: 'آمار داخلی ERP', connectedAccounts: 'حساب متصل', pendingApproval: 'در انتظار تأیید', approvedReady: 'تأییدشده/آماده', published: 'منتشرشده',
    connected: 'متصل', notConnected: 'متصل نیست', login: 'باز کردن صفحه ورود', confirmConnection: 'تأیید اتصال', disconnect: 'قطع اتصال',
    upload: 'افزودن عکس یا ویدئو', noMedia: 'هنوز رسانه‌ای ذخیره نشده است.', editImage: 'ویرایش تصویر', videoDesktop: 'ویرایش کامل ویدئو در نسخه دسکتاپ محلی',
    titleLabel: 'عنوان داخلی', captionLabel: 'کپشن', hashtagsLabel: 'هشتگ‌ها', scheduleLabel: 'زمان پیشنهادی انتشار', channelsLabel: 'شبکه‌های هدف', selectMedia: 'انتخاب رسانه',
    saveDraft: 'ذخیره پیش‌نویس', requestApproval: 'ارسال برای تأیید مدیر', approvalRequired: 'هیچ انتشار واقعی بدون تأیید مدیر انجام نمی‌شود.',
    approve: 'تأیید مدیر', reject: 'رد', edit: 'ویرایش', prepare: 'آماده‌سازی انتشار دستی', markPublished: 'ثبت تأیید انتشار خارجی', openPlatform: 'باز کردن شبکه', copyCaption: 'کپی کپشن', delete: 'حذف',
    noDrafts: 'صف محتوا خالی است.', saved: 'ذخیره شد.', mediaSaved: 'رسانه در کتابخانه آفلاین ذخیره شد.', imageSaved: 'نسخه ویرایش‌شده تصویر ذخیره شد.',
  },
  en: {
    title: 'Social Media Command Center', subtitle: 'Manage media, captions, approval and assisted publishing without storing social passwords or requiring an API',
    overview: 'Dashboard', accounts: 'Account connections', library: 'Media library', composer: 'Create & edit post', queue: 'Approval & publishing queue',
    noApi: 'Safe no-API mode: the ERP never stores social-network passwords. Sign-in happens on each platform’s official website.',
    internalStats: 'ERP internal stats', connectedAccounts: 'Connected accounts', pendingApproval: 'Pending approval', approvedReady: 'Approved / ready', published: 'Published',
    connected: 'Connected', notConnected: 'Not connected', login: 'Open sign-in page', confirmConnection: 'Confirm connection', disconnect: 'Disconnect',
    upload: 'Add photos or videos', noMedia: 'No media saved yet.', editImage: 'Edit image', videoDesktop: 'Full video editing uses the local desktop encoder',
    titleLabel: 'Internal title', captionLabel: 'Caption', hashtagsLabel: 'Hashtags', scheduleLabel: 'Suggested publish time', channelsLabel: 'Target channels', selectMedia: 'Select media',
    saveDraft: 'Save draft', requestApproval: 'Request admin approval', approvalRequired: 'Nothing is actually published without admin approval.',
    approve: 'Admin approve', reject: 'Reject', edit: 'Edit', prepare: 'Prepare assisted publishing', markPublished: 'Record external publication confirmation', openPlatform: 'Open platform', copyCaption: 'Copy caption', delete: 'Delete',
    noDrafts: 'Content queue is empty.', saved: 'Saved.', mediaSaved: 'Media saved to the offline library.', imageSaved: 'Edited image version saved.',
  },
  de: {
    title: 'Social-Media-Kommandozentrale', subtitle: 'Medien, Texte, Freigaben und assistierte Veröffentlichung ohne gespeicherte Passwörter oder Pflicht-API',
    overview: 'Übersicht', accounts: 'Konten', library: 'Medienbibliothek', composer: 'Beitrag erstellen', queue: 'Freigabe & Veröffentlichung', noApi: 'Sicherer Modus ohne API: ERP speichert keine Passwörter. Anmeldung erfolgt auf der offiziellen Plattform.', internalStats: 'Interne ERP-Statistik', connectedAccounts: 'Verbundene Konten', pendingApproval: 'Wartet auf Freigabe', approvedReady: 'Freigegeben / bereit', published: 'Veröffentlicht', connected: 'Verbunden', notConnected: 'Nicht verbunden', login: 'Anmeldung öffnen', confirmConnection: 'Verbindung bestätigen', disconnect: 'Trennen', upload: 'Foto oder Video hinzufügen', noMedia: 'Noch keine Medien gespeichert.', editImage: 'Bild bearbeiten', videoDesktop: 'Vollständige Videobearbeitung lokal in der Desktop-Version', titleLabel: 'Interner Titel', captionLabel: 'Text', hashtagsLabel: 'Hashtags', scheduleLabel: 'Vorgesehene Zeit', channelsLabel: 'Zielkanäle', selectMedia: 'Medien wählen', saveDraft: 'Entwurf speichern', requestApproval: 'Freigabe anfordern', approvalRequired: 'Keine echte Veröffentlichung ohne Admin-Freigabe.', approve: 'Freigeben', reject: 'Ablehnen', edit: 'Bearbeiten', prepare: 'Veröffentlichung vorbereiten', markPublished: 'Als veröffentlicht markieren', openPlatform: 'Plattform öffnen', copyCaption: 'Text kopieren', delete: 'Löschen', noDrafts: 'Warteschlange ist leer.', saved: 'Gespeichert.', mediaSaved: 'Medien offline gespeichert.', imageSaved: 'Bearbeitete Bildversion gespeichert.',
  },
  fr: {
    title: 'Centre de commande des réseaux sociaux', subtitle: 'Gestion des médias, textes, validations et publication assistée sans mot de passe stocké ni API obligatoire',
    overview: 'Tableau de bord', accounts: 'Comptes', library: 'Médiathèque', composer: 'Créer / modifier', queue: 'Validation & publication', noApi: 'Mode sécurisé sans API : aucun mot de passe social n’est stocké. La connexion se fait sur le site officiel.', internalStats: 'Statistiques internes ERP', connectedAccounts: 'Comptes connectés', pendingApproval: 'En attente', approvedReady: 'Validé / prêt', published: 'Publié', connected: 'Connecté', notConnected: 'Non connecté', login: 'Ouvrir la connexion', confirmConnection: 'Confirmer la connexion', disconnect: 'Déconnecter', upload: 'Ajouter photo ou vidéo', noMedia: 'Aucun média enregistré.', editImage: 'Modifier l’image', videoDesktop: 'Montage vidéo complet via le moteur local Desktop', titleLabel: 'Titre interne', captionLabel: 'Légende', hashtagsLabel: 'Hashtags', scheduleLabel: 'Heure prévue', channelsLabel: 'Canaux cibles', selectMedia: 'Choisir les médias', saveDraft: 'Enregistrer le brouillon', requestApproval: 'Demander validation', approvalRequired: 'Aucune publication réelle sans validation administrateur.', approve: 'Valider', reject: 'Refuser', edit: 'Modifier', prepare: 'Préparer la publication', markPublished: 'Marquer publié', openPlatform: 'Ouvrir la plateforme', copyCaption: 'Copier la légende', delete: 'Supprimer', noDrafts: 'La file est vide.', saved: 'Enregistré.', mediaSaved: 'Média enregistré hors ligne.', imageSaved: 'Version modifiée enregistrée.',
  },
  es: {
    title: 'Centro de mando de redes sociales', subtitle: 'Gestión de medios, textos, aprobación y publicación asistida sin guardar contraseñas ni exigir API',
    overview: 'Panel', accounts: 'Cuentas', library: 'Biblioteca', composer: 'Crear / editar', queue: 'Aprobación y publicación', noApi: 'Modo seguro sin API: el ERP no guarda contraseñas. El inicio de sesión ocurre en el sitio oficial.', internalStats: 'Estadísticas internas ERP', connectedAccounts: 'Cuentas conectadas', pendingApproval: 'Pendiente de aprobación', approvedReady: 'Aprobado / listo', published: 'Publicado', connected: 'Conectado', notConnected: 'No conectado', login: 'Abrir inicio de sesión', confirmConnection: 'Confirmar conexión', disconnect: 'Desconectar', upload: 'Añadir foto o vídeo', noMedia: 'Aún no hay medios.', editImage: 'Editar imagen', videoDesktop: 'Edición completa de vídeo con el motor local Desktop', titleLabel: 'Título interno', captionLabel: 'Texto', hashtagsLabel: 'Hashtags', scheduleLabel: 'Hora sugerida', channelsLabel: 'Canales objetivo', selectMedia: 'Seleccionar medios', saveDraft: 'Guardar borrador', requestApproval: 'Solicitar aprobación', approvalRequired: 'Nada se publica realmente sin aprobación del administrador.', approve: 'Aprobar', reject: 'Rechazar', edit: 'Editar', prepare: 'Preparar publicación', markPublished: 'Marcar publicado', openPlatform: 'Abrir plataforma', copyCaption: 'Copiar texto', delete: 'Eliminar', noDrafts: 'La cola está vacía.', saved: 'Guardado.', mediaSaved: 'Medio guardado sin conexión.', imageSaved: 'Versión editada guardada.',
  },
  ru: {
    title: 'Центр управления соцсетями', subtitle: 'Медиа, тексты, согласование и публикация без хранения паролей и обязательного API',
    overview: 'Панель', accounts: 'Аккаунты', library: 'Медиатека', composer: 'Создать / изменить', queue: 'Согласование и публикация', noApi: 'Безопасный режим без API: ERP не хранит пароли. Вход выполняется на официальном сайте платформы.', internalStats: 'Внутренняя статистика ERP', connectedAccounts: 'Подключено', pendingApproval: 'На согласовании', approvedReady: 'Одобрено / готово', published: 'Опубликовано', connected: 'Подключено', notConnected: 'Не подключено', login: 'Открыть вход', confirmConnection: 'Подтвердить подключение', disconnect: 'Отключить', upload: 'Добавить фото или видео', noMedia: 'Медиа пока нет.', editImage: 'Редактировать изображение', videoDesktop: 'Полный видеомонтаж — локальный Desktop-движок', titleLabel: 'Внутреннее название', captionLabel: 'Подпись', hashtagsLabel: 'Хэштеги', scheduleLabel: 'Планируемое время', channelsLabel: 'Каналы', selectMedia: 'Выбрать медиа', saveDraft: 'Сохранить черновик', requestApproval: 'Отправить на согласование', approvalRequired: 'Без одобрения администратора реальная публикация невозможна.', approve: 'Одобрить', reject: 'Отклонить', edit: 'Изменить', prepare: 'Подготовить публикацию', markPublished: 'Отметить опубликованным', openPlatform: 'Открыть платформу', copyCaption: 'Копировать текст', delete: 'Удалить', noDrafts: 'Очередь пуста.', saved: 'Сохранено.', mediaSaved: 'Медиа сохранено локально.', imageSaved: 'Отредактированная версия сохранена.',
  },
  ar: {
    title: 'مركز قيادة شبكات التواصل', subtitle: 'إدارة الصور والفيديو والنصوص والموافقة والنشر المساعد دون حفظ كلمات المرور أو فرض API',
    overview: 'لوحة التحكم', accounts: 'الحسابات', library: 'مكتبة الوسائط', composer: 'إنشاء وتعديل', queue: 'الموافقة والنشر', noApi: 'وضع آمن دون API: لا يحفظ ERP كلمات مرور الشبكات، ويتم تسجيل الدخول في الموقع الرسمي.', internalStats: 'إحصاءات ERP الداخلية', connectedAccounts: 'حسابات متصلة', pendingApproval: 'بانتظار الموافقة', approvedReady: 'موافق عليه / جاهز', published: 'منشور', connected: 'متصل', notConnected: 'غير متصل', login: 'فتح صفحة الدخول', confirmConnection: 'تأكيد الاتصال', disconnect: 'فصل الاتصال', upload: 'إضافة صورة أو فيديو', noMedia: 'لا توجد وسائط محفوظة بعد.', editImage: 'تعديل الصورة', videoDesktop: 'تحرير الفيديو الكامل عبر المحرك المحلي لنسخة سطح المكتب', titleLabel: 'العنوان الداخلي', captionLabel: 'النص', hashtagsLabel: 'الوسوم', scheduleLabel: 'وقت النشر المقترح', channelsLabel: 'القنوات المستهدفة', selectMedia: 'اختيار الوسائط', saveDraft: 'حفظ مسودة', requestApproval: 'طلب موافقة المدير', approvalRequired: 'لا يتم أي نشر فعلي دون موافقة المدير.', approve: 'موافقة المدير', reject: 'رفض', edit: 'تعديل', prepare: 'تجهيز النشر', markPublished: 'تسجيل كمنشور', openPlatform: 'فتح الشبكة', copyCaption: 'نسخ النص', delete: 'حذف', noDrafts: 'قائمة المحتوى فارغة.', saved: 'تم الحفظ.', mediaSaved: 'تم حفظ الوسائط محلياً.', imageSaved: 'تم حفظ النسخة المعدلة.',
  },
} as const;

const STATUS_STYLE: Record<SocialCampaignDraft['status'], string> = {
  DRAFT: 'border-slate-700 text-slate-300 bg-slate-800/60',
  PENDING_APPROVAL: 'border-amber-500/40 text-amber-300 bg-amber-500/10',
  APPROVED: 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10',
  READY_TO_PUBLISH: 'border-cyan-500/40 text-cyan-300 bg-cyan-500/10',
  PUBLISHED: 'border-green-500/40 text-green-300 bg-green-500/10',
  REJECTED: 'border-rose-500/40 text-rose-300 bg-rose-500/10',
};

const MediaPreview: React.FC<{ asset: LocalMediaAsset; className?: string }> = ({ asset, className = '' }) => {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const next = URL.createObjectURL(asset.blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [asset]);
  if (!url) return <div className={`bg-slate-800 ${className}`} />;
  if (asset.mimeType.startsWith('image/')) return <img src={url} alt={asset.name} className={`object-cover ${className}`} />;
  if (asset.mimeType.startsWith('video/')) return <video src={url} controls className={`object-cover bg-black ${className}`} />;
  return <div className={`bg-slate-800 flex items-center justify-center ${className}`}><Library className="w-6 h-6" /></div>;
};

export const SocialMediaCommandCenterView: React.FC = () => {
  const { language, dir } = useI18n();
  const { currentUser, hasPermission } = useAuth();
  const c = COPY[language as keyof typeof COPY] || COPY.en;
  const canCreate = hasPermission('media', 'create');
  const canEdit = hasPermission('media', 'edit');
  const canApprove = hasPermission('media', 'approve');
  const canDelete = hasPermission('media', 'delete');
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [connections, setConnections] = useState<SocialConnectionState[]>([]);
  const [assets, setAssets] = useState<LocalMediaAsset[]>([]);
  const [drafts, setDrafts] = useState<SocialCampaignDraft[]>([]);
  const [message, setMessage] = useState('');
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [schedule, setSchedule] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatformId[]>(['instagram', 'linkedin']);
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [editingAsset, setEditingAsset] = useState<LocalMediaAsset | null>(null);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);

  const refreshAssets = async () => setAssets(await listMediaAssets());
  useEffect(() => {
    void refreshAssets();
    void Promise.all([listSocialConnections(), listSocialDrafts()]).then(([nextConnections, nextDrafts]) => { setConnections(nextConnections); setDrafts(nextDrafts); });
  }, []);

  const connectedCount = connections.filter((item) => item.connected).length;
  const pendingCount = drafts.filter((item) => item.status === 'PENDING_APPROVAL').length;
  const readyCount = drafts.filter((item) => ['APPROVED', 'READY_TO_PUBLISH'].includes(item.status)).length;
  const publishedCount = drafts.filter((item) => item.status === 'PUBLISHED').length;

  const platformMap = useMemo(() => new Map(SOCIAL_PLATFORMS.map((item) => [item.id, item])), []);

  const flash = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 3200);
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) continue;
      await saveMediaFile(file);
    }
    await refreshAssets();
    flash(c.mediaSaved);
  };

  const togglePlatform = (id: SocialPlatformId) => {
    setSelectedPlatforms((previous) => previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id]);
  };

  const toggleAsset = (id: string) => {
    setSelectedAssets((previous) => previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id]);
  };

  const parseHashtags = () => hashtags.split(/[\s,]+/).map((tag) => tag.trim()).filter(Boolean);

  const resetComposer = () => {
    setTitle(''); setCaption(''); setHashtags(''); setSchedule(''); setSelectedAssets([]); setEditingDraftId(null);
  };

  const saveComposer = async (status: 'DRAFT' | 'PENDING_APPROVAL') => {
    if (editingDraftId ? !canEdit : !canCreate) return;
    if (!title.trim() || !caption.trim() || selectedPlatforms.length === 0) return;
    const payload = {
      title: title.trim(), caption: caption.trim(), hashtags: parseHashtags(), platformIds: selectedPlatforms,
      mediaAssetIds: selectedAssets, scheduledAt: schedule || undefined,
    };
    if (editingDraftId) {
      setDrafts(await updateSocialDraft(editingDraftId, { ...payload, status }));
    } else {
      setDrafts(await saveSocialDraft({ ...payload, status }));
    }
    resetComposer();
    setActiveTab('queue');
    flash(c.saved);
  };

  const editDraft = (draft: SocialCampaignDraft) => {
    if (!canEdit) return;
    setEditingDraftId(draft.id); setTitle(draft.title); setCaption(draft.caption); setHashtags(draft.hashtags.join(' '));
    setSchedule(draft.scheduledAt || ''); setSelectedPlatforms(draft.platformIds); setSelectedAssets(draft.mediaAssetIds); setActiveTab('composer');
  };

  const approveDraft = async (draft: SocialCampaignDraft) => {
    if (!canApprove) return;
    if (!window.confirm(`${c.approve}: ${draft.title}?`)) return;
    setDrafts(await updateSocialDraft(draft.id, { status: 'APPROVED', approvedAt: new Date().toISOString(), approvedBy: currentUser?.fullName || '' }));
  };

  const rejectDraft = async (draft: SocialCampaignDraft) => {
    if (!canApprove) return;
    if (!window.confirm(`${c.reject}: ${draft.title}?`)) return;
    setDrafts(await updateSocialDraft(draft.id, { status: 'REJECTED' }));
  };

  const prepareDraft = async (draft: SocialCampaignDraft) => {
    if (!canApprove) return;
    if (!['APPROVED', 'READY_TO_PUBLISH'].includes(draft.status)) return;
    const text = formatCaption(draft.caption, draft.hashtags);
    await copyCampaignCaption(text);
    const files = assets.filter((asset) => draft.mediaAssetIds.includes(asset.id)).map((asset) => new File([asset.blob], asset.name, { type: asset.mimeType }));
    const shared = await shareCampaignFiles(files, draft.title, text);
    setDrafts(await updateSocialDraft(draft.id, { status: 'READY_TO_PUBLISH' }));
    flash(shared === 'SHARED' ? c.saved : c.copyCaption);
  };

  const markPublished = async (draft: SocialCampaignDraft) => {
    if (!canApprove) return;
    if (draft.status !== 'READY_TO_PUBLISH' && draft.status !== 'APPROVED') return;
    if (!window.confirm(`${c.markPublished}: ${draft.title}?`)) return;
    setDrafts(await updateSocialDraft(draft.id, { status: 'PUBLISHED', publishedAt: new Date().toISOString() }));
  };

  const connectPlatform = async (platformId: SocialPlatformId) => {
    if (!canEdit) return;
    const label = window.prompt('Account / page label (optional):') || undefined;
    setConnections(await setSocialConnection(platformId, false, label));
  };

  const saveEditedImage = async () => {
    if (!canEdit) return;
    if (!editingAsset) return;
    await createEditedImageVersion(editingAsset, { brightness, contrast, rotation, quality: 0.9 });
    setEditingAsset(null); setBrightness(100); setContrast(100); setRotation(0); await refreshAssets(); flash(c.imageSaved);
  };

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: c.overview, icon: ShieldCheck }, { id: 'accounts', label: c.accounts, icon: Link2 },
    { id: 'library', label: c.library, icon: Library }, { id: 'composer', label: c.composer, icon: Pencil }, { id: 'queue', label: c.queue, icon: ClipboardCheck },
  ];

  return (
    <div dir={dir} className="space-y-5 animate-fadeIn pb-12">
      <div className="bg-[#121214] border border-[#1F1F22] rounded-2xl p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{c.title}</h1>
            <p className="text-xs text-[#A1A1AA] mt-1 max-w-3xl">{c.subtitle}</p>
          </div>
          <div className="px-3 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> No-API Safe Mode
          </div>
        </div>
        <div className="mt-4 p-3 rounded-xl bg-[#18181B] border border-[#27272A] text-[11px] text-[#A1A1AA]">{c.noApi}</div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setActiveTab(id)} className={`px-3 py-2 rounded-xl border text-xs flex items-center gap-2 whitespace-nowrap ${activeTab === id ? 'bg-[#D4AF37] text-black border-[#D4AF37]' : 'bg-[#18181B] text-[#A1A1AA] border-[#27272A]'}`}><Icon className="w-4 h-4" />{label}</button>)}
      </div>

      {message && <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs">{message}</div>}

      {activeTab === 'overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[[c.connectedAccounts, connectedCount], [c.pendingApproval, pendingCount], [c.approvedReady, readyCount], [c.published, publishedCount]].map(([label, value]) => <div key={String(label)} className="bg-[#121214] border border-[#1F1F22] rounded-2xl p-4"><div className="text-[10px] text-[#71717A] uppercase">{label}</div><div className="text-3xl text-white mt-1">{value}</div></div>)}
          </div>
          <div className="bg-[#121214] border border-[#1F1F22] rounded-2xl p-5">
            <h3 className="text-sm font-bold text-white">{c.internalStats}</h3>
            <p className="text-xs text-[#71717A] mt-2">These counters come only from ERP workflow records. Likes, reach, followers, comments and direct messages are not fabricated when no official platform integration is available.</p>
          </div>
        </div>
      )}

      {activeTab === 'accounts' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {SOCIAL_PLATFORMS.map((platform) => {
            const connection = connections.find((item) => item.platformId === platform.id);
            return <div key={platform.id} className="bg-[#121214] border border-[#1F1F22] rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-[#18181B] border border-[#27272A] flex items-center justify-center text-xs font-bold text-[#D4AF37]">{platform.colorHint}</div><div><div className="text-sm font-bold text-white">{platform.name}</div><div className={`text-[10px] ${connection?.connected ? 'text-emerald-400' : 'text-[#71717A]'}`}>{connection?.connected ? c.connected : c.notConnected}{connection?.accountLabel ? ` · ${connection.accountLabel}` : ''}</div></div></div>{connection?.connected && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}</div>
              <div className="grid grid-cols-2 gap-2"><button onClick={() => openPlatformLogin(platform.id)} className="py-2 rounded-lg bg-[#18181B] border border-[#27272A] text-xs text-white flex items-center justify-center gap-1"><LogIn className="w-3.5 h-3.5" />{c.login}</button>{connection?.connected ? <button onClick={() => void setSocialConnection(platform.id, false).then(setConnections)} className="py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">{c.disconnect}</button> : <button onClick={() => void connectPlatform(platform.id)} className="py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300">{c.confirmConnection}</button>}</div>
            </div>;
          })}
        </div>
      )}

      {activeTab === 'library' && (
        <div className="space-y-4">
          <label className="flex items-center justify-center gap-2 p-5 border border-dashed border-[#3F3F46] rounded-2xl bg-[#121214] text-sm text-[#D4AF37] cursor-pointer"><Upload className="w-5 h-5" />{c.upload}<input type="file" accept="image/*,video/*" multiple className="hidden" onChange={(event) => void handleFiles(event.target.files)} /></label>
          {assets.length === 0 ? <div className="text-center text-xs text-[#71717A] py-12">{c.noMedia}</div> : <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">{assets.map((asset) => <div key={asset.id} className="bg-[#121214] border border-[#1F1F22] rounded-2xl overflow-hidden"><MediaPreview asset={asset} className="w-full h-40" /><div className="p-3"><div className="text-xs text-white truncate">{asset.name}</div><div className="text-[10px] text-[#71717A] mt-1">{(asset.size / 1024 / 1024).toFixed(2)} MB</div><div className="flex gap-2 mt-3">{asset.mimeType.startsWith('image/') ? <button disabled={!canEdit} onClick={() => setEditingAsset(asset)} className="flex-1 py-1.5 rounded-lg bg-[#18181B] border border-[#27272A] text-[10px] text-[#D4AF37] disabled:opacity-40">{c.editImage}</button> : <button disabled className="flex-1 py-1.5 rounded-lg bg-[#18181B] border border-[#27272A] text-[10px] text-[#71717A]" title={c.videoDesktop}><Video className="w-3 h-3 inline mr-1" />Desktop</button>}<button disabled={!canDelete} onClick={async () => { if (window.confirm(`${c.delete}: ${asset.name}?`)) { await deleteMediaAsset(asset.id); await refreshAssets(); } }} className="px-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 disabled:opacity-40"><Trash2 className="w-3.5 h-3.5" /></button></div></div></div>)}</div>}
        </div>
      )}

      {activeTab === 'composer' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <div className="bg-[#121214] border border-[#1F1F22] rounded-2xl p-5 space-y-4">
            <div><label className="text-xs text-[#A1A1AA]">{c.titleLabel}</label><input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full bg-[#18181B] border border-[#27272A] rounded-xl p-3 text-sm text-white" /></div>
            <div><label className="text-xs text-[#A1A1AA]">{c.captionLabel}</label><textarea rows={7} value={caption} onChange={(e) => setCaption(e.target.value)} className="mt-1 w-full bg-[#18181B] border border-[#27272A] rounded-xl p-3 text-sm text-white" /></div>
            <div><label className="text-xs text-[#A1A1AA]">{c.hashtagsLabel}</label><input value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder="#FathiCaviar #Sturgeon" className="mt-1 w-full bg-[#18181B] border border-[#27272A] rounded-xl p-3 text-sm text-white" /></div>
            <div><label className="text-xs text-[#A1A1AA]">{c.scheduleLabel}</label><input type="datetime-local" value={schedule} onChange={(e) => setSchedule(e.target.value)} className="mt-1 w-full bg-[#18181B] border border-[#27272A] rounded-xl p-3 text-sm text-white" /></div>
            <div><div className="text-xs text-[#A1A1AA] mb-2">{c.channelsLabel}</div><div className="flex flex-wrap gap-2">{SOCIAL_PLATFORMS.map((platform) => <button type="button" key={platform.id} onClick={() => togglePlatform(platform.id)} className={`px-2.5 py-1.5 rounded-lg border text-[11px] ${selectedPlatforms.includes(platform.id) ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-[#D4AF37]' : 'border-[#27272A] bg-[#18181B] text-[#71717A]'}`}>{platform.name}</button>)}</div></div>
            <div className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">{c.approvalRequired}</div>
              <div className="grid grid-cols-2 gap-2"><button disabled={editingDraftId ? !canEdit : !canCreate} onClick={() => void saveComposer('DRAFT')} className="py-2.5 rounded-xl bg-[#18181B] border border-[#27272A] text-white text-xs disabled:opacity-40">{c.saveDraft}</button><button disabled={editingDraftId ? !canEdit : !canCreate} onClick={() => void saveComposer('PENDING_APPROVAL')} className="py-2.5 rounded-xl bg-[#D4AF37] text-black font-bold text-xs disabled:opacity-40">{c.requestApproval}</button></div>
          </div>
          <div className="bg-[#121214] border border-[#1F1F22] rounded-2xl p-5"><div className="text-xs text-[#A1A1AA] mb-3">{c.selectMedia}</div><div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[620px] overflow-y-auto">{assets.map((asset) => <button key={asset.id} onClick={() => toggleAsset(asset.id)} className={`relative rounded-xl overflow-hidden border ${selectedAssets.includes(asset.id) ? 'border-[#D4AF37] ring-1 ring-[#D4AF37]' : 'border-[#27272A]'}`}><MediaPreview asset={asset} className="w-full h-28" />{selectedAssets.includes(asset.id) && <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#D4AF37] text-black flex items-center justify-center"><CheckCircle2 className="w-4 h-4" /></div>}</button>)}</div></div>
        </div>
      )}

      {activeTab === 'queue' && (
        <div className="space-y-3">
          {drafts.length === 0 ? <div className="text-center text-xs text-[#71717A] py-12">{c.noDrafts}</div> : drafts.map((draft) => <div key={draft.id} className="bg-[#121214] border border-[#1F1F22] rounded-2xl p-4 space-y-3">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-3"><div><div className="text-sm font-bold text-white">{draft.title}</div><div className="text-[10px] text-[#71717A] mt-1">{draft.platformIds.map((id) => platformMap.get(id)?.name || id).join(' · ')}{draft.scheduledAt ? ` · ${draft.scheduledAt}` : ''}</div></div><span className={`px-2.5 py-1 rounded-lg border text-[10px] font-mono ${STATUS_STYLE[draft.status]}`}>{draft.status}</span></div>
            <div className="text-xs text-[#A1A1AA] whitespace-pre-wrap line-clamp-4">{formatCaption(draft.caption, draft.hashtags)}</div>
            <div className="flex flex-wrap gap-2">
              <button disabled={!canEdit} onClick={() => editDraft(draft)} className="px-2.5 py-1.5 rounded-lg bg-[#18181B] border border-[#27272A] text-[10px] text-white disabled:opacity-40"><Pencil className="w-3 h-3 inline mr-1" />{c.edit}</button>
              <button onClick={() => void copyCampaignCaption(formatCaption(draft.caption, draft.hashtags))} className="px-2.5 py-1.5 rounded-lg bg-[#18181B] border border-[#27272A] text-[10px] text-white"><Copy className="w-3 h-3 inline mr-1" />{c.copyCaption}</button>
              {draft.status === 'PENDING_APPROVAL' && <><button disabled={!canApprove} onClick={() => void approveDraft(draft)} className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[10px] text-emerald-300 disabled:opacity-40">{c.approve}</button><button disabled={!canApprove} onClick={() => void rejectDraft(draft)} className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-[10px] text-rose-300 disabled:opacity-40">{c.reject}</button></>}
              {['APPROVED', 'READY_TO_PUBLISH'].includes(draft.status) && <button disabled={!canApprove} onClick={() => void prepareDraft(draft)} className="px-2.5 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-[10px] text-cyan-300 disabled:opacity-40"><Send className="w-3 h-3 inline mr-1" />{c.prepare}</button>}
              {['APPROVED', 'READY_TO_PUBLISH'].includes(draft.status) && <button disabled={!canApprove} onClick={() => void markPublished(draft)} className="px-2.5 py-1.5 rounded-lg bg-green-500/10 border border-green-500/30 text-[10px] text-green-300 disabled:opacity-40">{c.markPublished}</button>}
              <button disabled={!canDelete} onClick={() => { if (window.confirm(`${c.delete}: ${draft.title}?`)) void deleteSocialDraft(draft.id).then(setDrafts); }} className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-[10px] text-rose-300 disabled:opacity-40"><Trash2 className="w-3 h-3 inline mr-1" />{c.delete}</button>
            </div>
            {draft.status === 'READY_TO_PUBLISH' && <div className="flex flex-wrap gap-2 pt-2 border-t border-[#1F1F22]">{draft.platformIds.map((id) => <button key={id} onClick={() => openPlatformComposer(id)} className="px-2.5 py-1.5 rounded-lg bg-[#18181B] border border-[#27272A] text-[10px] text-[#D4AF37] flex items-center gap-1"><ExternalLink className="w-3 h-3" />{c.openPlatform}: {platformMap.get(id)?.name || id}</button>)}</div>}
          </div>)}
        </div>
      )}

      {editingAsset && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"><div className="w-full max-w-xl bg-[#121214] border border-[#27272A] rounded-2xl p-5 space-y-4"><div className="flex items-center justify-between"><h3 className="text-sm font-bold text-white">{c.editImage}</h3><button type="button" aria-label="Close image editor" onClick={() => setEditingAsset(null)} className="text-[#71717A]">×</button></div><MediaPreview asset={editingAsset} className="w-full max-h-72 rounded-xl" /><div><label className="text-xs text-[#A1A1AA]">Brightness: {brightness}%</label><input type="range" min="40" max="160" value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} className="w-full" /></div><div><label className="text-xs text-[#A1A1AA]">Contrast: {contrast}%</label><input type="range" min="40" max="160" value={contrast} onChange={(e) => setContrast(Number(e.target.value))} className="w-full" /></div><div className="flex gap-2">{([0, 90, 180, 270] as const).map((deg) => <button type="button" key={deg} onClick={() => setRotation(deg)} className={`flex-1 py-2 rounded-lg border text-xs ${rotation === deg ? 'border-[#D4AF37] text-[#D4AF37]' : 'border-[#27272A] text-[#A1A1AA]'}`}>{deg}°</button>)}</div><button type="button" onClick={() => void saveEditedImage()} className="w-full py-2.5 rounded-xl bg-[#D4AF37] text-black font-bold text-xs">Save edited copy</button></div></div>
      )}
    </div>
  );
};
