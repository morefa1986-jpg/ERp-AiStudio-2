import React, { useMemo, useState } from 'react';
import { Bot, Check, Copy, Lightbulb, RefreshCw, Send, Sparkles } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useFarm } from '../../context/FarmContext';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  time: string;
}

export const AiAssistantView: React.FC = () => {
  const { t, language, formatTime } = useI18n();
  const { ponds } = useFarm();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const suggestions = useMemo(() => [t('ai.q1'), t('ai.q2'), t('ai.q3'), t('ai.q4')], [t, language]);
  const greeting: ChatMessage = { role: 'assistant', text: t('ai.greetingText'), time: formatTime(new Date()) };
  const visibleMessages = [greeting, ...messages];

  const handleSendMessage = async (userText: string) => {
    const textToSend = userText || prompt;
    if (!textToSend.trim() || loading) return;
    const userMsg: ChatMessage = { role: 'user', text: textToSend.trim(), time: formatTime(new Date()) };
    setMessages((previous) => [...previous, userMsg]);
    setPrompt('');
    setLoading(true);

    try {
      const token = localStorage.getItem('fathi_aqua_session_token');
      const farmContext = {
        ponds: ponds.map((pond) => ({
          id: pond.id,
          name: pond.name,
          feedingStatus: pond.feedingStatus,
          fishCount: pond.fishCount,
          biomassKg: pond.biomassKg,
          fcr: pond.fcr,
          dissolvedOxygen: pond.dissolvedOxygen,
          waterTemperature: pond.waterTemperature,
          ph: pond.ph,
        })),
      };
      const response = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && !token.startsWith('lan_session_') ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ prompt: textToSend.trim(), language, farmContext }),
      });
      const data = await response.json().catch(() => ({}));
      const answer = response.ok && typeof data.answer === 'string' && data.answer.trim() ? data.answer : t('error');
      setMessages((previous) => [...previous, { role: 'assistant', text: answer, time: formatTime(new Date()) }]);
    } catch {
      setMessages((previous) => [...previous, { role: 'assistant', text: t('error'), time: formatTime(new Date()) }]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (text: string, index: number) => {
    try { await navigator.clipboard.writeText(text); } catch { return; }
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div><h1 className="text-xl font-black text-white flex items-center gap-2.5"><Bot className="w-6 h-6 text-purple-400" />{t('ai.assistantTitle')}</h1><p className="text-xs text-slate-400 mt-1">{t('ai.subtitle')}</p></div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 border border-purple-500/30 rounded-xl text-xs text-purple-300 font-bold"><Sparkles className="w-4 h-4" /><span>{t('systemStatus')}</span></div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm flex flex-col h-[580px] overflow-hidden">
        <div className="flex-1 p-5 overflow-y-auto space-y-4">
          {visibleMessages.map((msg, index) => {
            const isAi = msg.role === 'assistant';
            return <div key={`${index}-${msg.time}`} className={`flex items-start gap-3 ${isAi ? 'justify-start' : 'justify-end'}`}>
              {isAi && <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0"><Bot className="w-4 h-4" /></div>}
              <div className={`max-w-[82%] rounded-2xl p-4 text-xs leading-relaxed group ${isAi ? 'bg-slate-800/80 text-slate-200 border border-slate-700/80' : 'bg-amber-500 text-slate-950 font-medium'}`}>
                <div className="whitespace-pre-wrap">{msg.text}</div>
                <div className="flex items-center justify-between gap-3 mt-2 pt-1 border-t border-slate-700/40 text-[10px]"><span className={isAi ? 'text-slate-400' : 'text-slate-900'}>{msg.time}</span>{isAi && <button onClick={() => handleCopy(msg.text, index)} className="text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer">{copiedIndex === index ? <><Check className="w-3 h-3 text-emerald-400" /><span>{t('ai.copiedText')}</span></> : <><Copy className="w-3 h-3" /><span>{t('ai.copyBtn')}</span></>}</button>}</div>
              </div>
            </div>;
          })}
          {loading && <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center"><Bot className="w-4 h-4" /></div><div className="p-4 rounded-2xl bg-slate-800/80 text-xs text-slate-300 border border-slate-700 flex items-center gap-2"><RefreshCw className="w-4 h-4 text-purple-400 animate-spin" /><span>{t('ai.sending')}</span></div></div>}
        </div>

        <div className="p-3 bg-slate-950/80 border-t border-slate-800 flex items-center gap-2 overflow-x-auto"><span className="text-[11px] text-slate-400 flex items-center gap-1 shrink-0"><Lightbulb className="w-3.5 h-3.5 text-amber-400" />{t('ai.sampleQuestions')}</span>{suggestions.map((suggestion, index) => <button key={index} onClick={() => handleSendMessage(suggestion)} className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1 rounded-full whitespace-nowrap border border-slate-700">{suggestion}</button>)}</div>

        <form onSubmit={(event) => { event.preventDefault(); void handleSendMessage(prompt); }} className="p-4 bg-slate-950 border-t border-slate-800 flex items-center gap-2"><input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={t('ai.askPrompt')} className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-purple-500" disabled={loading} /><button type="submit" disabled={!prompt.trim() || loading} aria-label={t('ai.sendBtn')} className="p-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-xl"><Send className="w-4 h-4" /></button></form>
      </div>
    </div>
  );
};
