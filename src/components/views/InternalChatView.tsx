import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image as ImageIcon, MessageSquare, Mic, Paperclip, Phone, PhoneOff, Plus, Send, Users, Video } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFarm } from '../../context/FarmContext';
import { useI18n } from '../../i18n';
import { FileAttachment, InternalChatThread, User } from '../../types';
import { sizeLabel, uploadLocalAttachment } from '../../services/localFileService';
import { getStoredSessionToken } from '../../context/AuthContext';
import { createChatCall, endChatCall, listChatCalls, listChatSignals, postChatSignal } from '../../services/chatCallService';

export const InternalChatView: React.FC = () => {
  const { currentUser, usersList, hasPermission } = useAuth();
  const { chatThreads, chatMessages, createChatThread, sendChatMessage } = useFarm();
  const { formatDate } = useI18n();
  const [selectedThreadId, setSelectedThreadId] = useState(chatThreads[0]?.id || '');
  const [newThreadTitle, setNewThreadTitle] = useState('');
  const [newThreadType, setNewThreadType] = useState<InternalChatThread['type']>('Direct');
  const [selectedUsers, setSelectedUsers] = useState<string[]>(currentUser?.id ? [currentUser.id] : []);
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [chatUsers, setChatUsers] = useState<User[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [activeCallId, setActiveCallId] = useState('');
  const [callType, setCallType] = useState<'audio' | 'video'>('audio');
  const [callStatus, setCallStatus] = useState('');
  const [lastSignalId, setLastSignalId] = useState(0);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    const token = getStoredSessionToken();
    if (!token) return;
    fetch('/api/chat/users', { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((payload) => { if (Array.isArray(payload.users)) setChatUsers(payload.users); })
      .catch(() => {});
  }, [currentUser?.id]);

  const users = useMemo(() => {
    const known = chatUsers.length ? chatUsers : usersList.length ? usersList : currentUser ? [currentUser] : [];
    return [...known].sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [chatUsers, currentUser, usersList]);
  const visibleThreads = useMemo(() => chatThreads
    .filter((thread) => currentUser?.role === 'Super Admin' || currentUser?.role === 'Farm Owner' || thread.participantUserIds.includes(currentUser?.id || ''))
    .sort((a, b) => new Date(b.lastMessageAt || b.createdAt).getTime() - new Date(a.lastMessageAt || a.createdAt).getTime()), [chatThreads, currentUser]);
  const activeThread = visibleThreads.find((thread) => thread.id === selectedThreadId) || visibleThreads[0];
  const activeMessages = useMemo(() => chatMessages.filter((row) => row.threadId === activeThread?.id), [chatMessages, activeThread?.id]);
  const canCreate = hasPermission('chat', 'create');

  useEffect(() => {
    if (!activeThread) return;
    const timer = window.setInterval(() => {
      listChatCalls(activeThread.id).then((calls) => {
        const incoming = calls.find((call) => call.startedByUserId !== currentUser?.id);
        if (incoming && !activeCallId) { setActiveCallId(incoming.id); setCallType(incoming.callType); setCallStatus(`${incoming.startedByName} تماس ${incoming.callType === 'video' ? 'تصویری' : 'صوتی'} شروع کرده است.`); }
      }).catch(() => {});
    }, 4000);
    return () => window.clearInterval(timer);
  }, [activeThread?.id, activeCallId, currentUser?.id]);

  useEffect(() => {
    if (!activeCallId || !peerRef.current) return;
    const timer = window.setInterval(async () => {
      try {
        const signals = await listChatSignals(activeCallId, lastSignalId);
        if (signals.length) setLastSignalId(Math.max(...signals.map((signal) => signal.id)));
        for (const signal of signals) {
          if (signal.type === 'offer') {
            await peerRef.current?.setRemoteDescription(signal.payload as RTCSessionDescriptionInit);
            const answer = await peerRef.current?.createAnswer();
            if (answer) { await peerRef.current?.setLocalDescription(answer); await postChatSignal(activeCallId, 'answer', answer); }
          } else if (signal.type === 'answer') {
            await peerRef.current?.setRemoteDescription(signal.payload as RTCSessionDescriptionInit);
          } else if (signal.type === 'ice' && signal.payload) {
            await peerRef.current?.addIceCandidate(signal.payload as RTCIceCandidateInit);
          } else if (signal.type === 'hangup') {
            stopCall(false);
          }
        }
      } catch { /* polling is best-effort */ }
    }, 1500);
    return () => window.clearInterval(timer);
  }, [activeCallId, lastSignalId]);

  const toggleUser = (id: string) => setSelectedUsers((previous) => previous.includes(id) ? previous.filter((row) => row !== id) : [...previous, id]);
  const createThread = () => {
    const title = newThreadTitle.trim() || (newThreadType === 'Direct' ? 'گفتگوی فردی' : 'گروه داخلی');
    const result = createChatThread({ title, type: newThreadType, participantUserIds: selectedUsers });
    if (result.success && result.id) { setSelectedThreadId(result.id); setNewThreadTitle(''); setMessage('گفتگو ساخته شد.'); }
    else setMessage(result.error || 'ساخت گفتگو انجام نشد.');
  };
  const attachFiles = async (files?: FileList | null) => {
    if (!files?.length) return;
    setBusy(true); setMessage('');
    try {
      const uploaded = await Promise.all([...files].slice(0, 6).map((file) => uploadLocalAttachment('chat', file, currentUser?.fullName || currentUser?.username)));
      setAttachments((previous) => [...previous, ...uploaded]);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'ارسال پیوست انجام نشد.'); }
    finally { setBusy(false); }
  };
  const submitMessage = () => {
    if (!activeThread) return;
    const result = sendChatMessage({ threadId: activeThread.id, text, attachments });
    if (result.success) { setText(''); setAttachments([]); setMessage('پیام ثبت شد.'); }
    else setMessage(result.error || 'ارسال پیام انجام نشد.');
  };
  const preparePeer = async (mediaType: 'audio' | 'video', callId: string) => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: mediaType === 'video' });
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    const peer = new RTCPeerConnection({ iceServers: [] });
    peer.onicecandidate = (event) => { if (event.candidate) void postChatSignal(callId, 'ice', event.candidate.toJSON()); };
    peer.ontrack = (event) => { if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0]; };
    stream.getTracks().forEach((track) => peer.addTrack(track, stream));
    peerRef.current = peer;
    return peer;
  };
  const startCall = async (mediaType: 'audio' | 'video') => {
    if (!activeThread) return;
    try {
      setBusy(true); setCallStatus('در حال آماده‌سازی تماس...');
      const call = await createChatCall(activeThread.id, mediaType);
      setActiveCallId(call.id); setCallType(mediaType); setLastSignalId(0);
      const peer = await preparePeer(mediaType, call.id);
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await postChatSignal(call.id, 'offer', offer);
      setCallStatus('تماس شروع شد؛ طرف مقابل می‌تواند از همین گفتگو پاسخ دهد.');
    } catch (error) { setCallStatus(error instanceof Error ? error.message : 'شروع تماس انجام نشد.'); }
    finally { setBusy(false); }
  };
  const answerCall = async () => {
    if (!activeCallId) return;
    try {
      setBusy(true); setCallStatus('در حال پاسخ به تماس...');
      await preparePeer(callType, activeCallId);
      setLastSignalId(0);
      setCallStatus('تماس برقرار شد.');
    } catch (error) { setCallStatus(error instanceof Error ? error.message : 'پاسخ تماس انجام نشد.'); }
    finally { setBusy(false); }
  };
  const stopCall = (notify = true) => {
    if (notify && activeCallId) { void postChatSignal(activeCallId, 'hangup', null); void endChatCall(activeCallId); }
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    peerRef.current?.close();
    localStreamRef.current = null; peerRef.current = null; setActiveCallId(''); setCallStatus('تماس پایان یافت.');
  };

  return <div className="space-y-5 pb-12 animate-fadeIn">
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
      <div><h1 className="text-xl font-black text-white flex items-center gap-2"><MessageSquare className="w-6 h-6 text-amber-400" />چت داخلی مجموعه</h1><p className="text-xs text-slate-400 mt-1">گفتگوی فردی/گروهی با پیوست فایل، عکس و فیلم؛ فایل‌ها کنار دیتابیس برنامه ذخیره و در آرشیو فعالیت ثبت می‌شوند.</p></div>
      <span className="text-[11px] text-slate-400">{visibleThreads.length} گفتگو · {chatMessages.length} پیام</span>
    </div>
    {message && <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-200">{message}</div>}
    <div className="grid xl:grid-cols-[340px_1fr] gap-5">
      <div className="space-y-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="font-bold text-white text-sm flex items-center gap-2"><Plus className="w-4 h-4 text-amber-400" />گفتگوی جدید</div>
          <input value={newThreadTitle} onChange={(e) => setNewThreadTitle(e.target.value)} placeholder="عنوان گفتگو / گروه" className="field w-full" />
          <select value={newThreadType} onChange={(e) => setNewThreadType(e.target.value as InternalChatThread['type'])} className="field w-full"><option value="Direct">فردی</option><option value="Group">گروهی</option></select>
          <div className="max-h-40 overflow-auto space-y-1 rounded-xl border border-slate-800 p-2">{users.map((user) => <label key={user.id} className="flex items-center gap-2 text-xs text-slate-300 p-1.5 rounded-lg hover:bg-slate-800"><input type="checkbox" checked={selectedUsers.includes(user.id)} onChange={() => toggleUser(user.id)} />{user.fullName}<span className="text-slate-500">{user.role}</span></label>)}</div>
          <button disabled={!canCreate || selectedUsers.length < 2} onClick={createThread} className="w-full rounded-xl bg-amber-500 text-slate-950 font-bold text-xs py-2 disabled:opacity-40">ساخت گفتگو</button>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden"><div className="p-3 border-b border-slate-800 font-bold text-white text-sm flex items-center gap-2"><Users className="w-4 h-4 text-amber-400" />گفتگوها</div><div className="divide-y divide-slate-800 max-h-[520px] overflow-auto">{visibleThreads.length ? visibleThreads.map((thread) => <button key={thread.id} onClick={() => setSelectedThreadId(thread.id)} className={`w-full text-start p-3 ${activeThread?.id === thread.id ? 'bg-amber-500/10' : 'hover:bg-slate-800/60'}`}><div className="text-sm font-bold text-white">{thread.title}</div><div className="text-[11px] text-slate-500 mt-1">{thread.type === 'Group' ? 'گروهی' : 'فردی'} · {thread.participantUserIds.length} عضو · {formatDate(thread.lastMessageAt || thread.createdAt)}</div></button>) : <div className="p-8 text-center text-xs text-slate-500">گفتگویی ساخته نشده است.</div>}</div></div>
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl min-h-[640px] flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3"><div><div className="font-black text-white">{activeThread?.title || 'گفتگو انتخاب نشده'}</div><div className="text-[11px] text-slate-500 mt-1">{activeThread ? `${activeThread.participantUserIds.length} عضو` : 'برای شروع یک گفتگو بسازید.'}</div></div><div className="flex gap-2"><button disabled={!activeThread || busy} onClick={() => void startCall('audio')} className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold disabled:opacity-40 flex items-center gap-1"><Phone className="w-4 h-4" />صوتی</button><button disabled={!activeThread || busy} onClick={() => void startCall('video')} className="px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold disabled:opacity-40 flex items-center gap-1"><Video className="w-4 h-4" />تصویری</button></div></div>
        {(activeCallId || callStatus) && <div className="m-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 space-y-3"><div className="flex flex-wrap items-center justify-between gap-2 text-xs"><span className="text-emerald-100 flex items-center gap-1"><Mic className="w-4 h-4" />{callStatus || 'تماس فعال است.'}</span><div className="flex gap-2">{activeCallId && !peerRef.current && <button onClick={() => void answerCall()} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold">پاسخ</button>}{activeCallId && <button onClick={() => stopCall()} className="px-3 py-1.5 rounded-lg bg-red-600 text-white font-bold flex items-center gap-1"><PhoneOff className="w-3.5 h-3.5" />قطع</button>}</div></div><div className="grid md:grid-cols-2 gap-2"><video ref={localVideoRef} autoPlay muted playsInline className="w-full max-h-52 rounded-xl bg-black object-cover" /><video ref={remoteVideoRef} autoPlay playsInline className="w-full max-h-52 rounded-xl bg-black object-cover" /></div><div className="text-[10px] text-emerald-200/80">برای موبایل، سایت داخلی را با HTTPS/LAN باز کنید تا مرورگر اجازه دوربین و میکروفن بدهد.</div></div>}
        <div className="flex-1 overflow-auto p-4 space-y-3">{activeMessages.length ? activeMessages.map((row) => <div key={row.id} className={`max-w-[86%] rounded-2xl p-3 ${row.senderUserId === currentUser?.id ? 'mr-auto bg-amber-500/15 border border-amber-500/30' : 'bg-slate-950 border border-slate-800'}`}><div className="flex justify-between gap-3 text-[10px] text-slate-500"><span>{row.senderName}</span><span>{formatDate(row.createdAt)}</span></div>{row.text && <p className="text-sm text-slate-100 mt-2 whitespace-pre-wrap">{row.text}</p>}{row.attachments.length ? <div className="grid sm:grid-cols-2 gap-2 mt-3">{row.attachments.map((file) => <a key={file.id} href={file.downloadUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-700 bg-slate-950 p-2 text-xs text-slate-300 hover:border-amber-500/60">{file.mimeType.startsWith('image/') && file.downloadUrl ? <img src={file.downloadUrl} alt={file.fileName} className="w-full h-28 object-cover rounded-lg mb-2" /> : file.mimeType.startsWith('video/') && file.downloadUrl ? <video src={file.downloadUrl} controls className="w-full h-28 rounded-lg mb-2" /> : <ImageIcon className="w-5 h-5 text-slate-500 mb-2" />}<div className="font-bold text-white truncate">{file.fileName}</div><div className="text-slate-500">{sizeLabel(file.sizeBytes)}</div></a>)}</div> : null}</div>) : <div className="h-full flex items-center justify-center text-xs text-slate-500">پیامی در این گفتگو نیست.</div>}</div>
        <div className="p-4 border-t border-slate-800 space-y-2"><textarea disabled={!activeThread || busy} value={text} onChange={(e) => setText(e.target.value)} placeholder="پیام..." className="field w-full min-h-20" />{attachments.length ? <div className="flex flex-wrap gap-2">{attachments.map((file) => <span key={file.id} className="px-2 py-1 rounded-lg bg-slate-800 text-[11px] text-slate-300">{file.fileName} · {sizeLabel(file.sizeBytes)}</span>)}</div> : null}<div className="flex justify-between gap-2"><label className="px-3 py-2 rounded-xl bg-slate-800 text-xs text-slate-200 cursor-pointer flex items-center gap-1"><Paperclip className="w-4 h-4" />پیوست فایل/عکس/فیلم<input type="file" multiple className="hidden" onChange={(e) => void attachFiles(e.target.files)} /></label><button disabled={!canCreate || !activeThread || busy || (!text.trim() && !attachments.length)} onClick={submitMessage} className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold disabled:opacity-40 flex items-center gap-1"><Send className="w-4 h-4" />ارسال</button></div></div>
      </div>
    </div>
    <style>{`.field{background:#0f172a;border:1px solid #334155;border-radius:.75rem;padding:.625rem;color:white;font-size:.75rem}.field::placeholder{color:#64748b}`}</style>
  </div>;
};
