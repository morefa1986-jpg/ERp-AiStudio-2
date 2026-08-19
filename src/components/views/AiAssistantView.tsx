import React, { useState } from 'react';
import { useI18n } from '../../i18n';
import { useFarm } from '../../context/FarmContext';
import {
  Bot,
  Send,
  Sparkles,
  AlertTriangle,
  Lightbulb,
  ShieldCheck,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react';

export const AiAssistantView: React.FC = () => {
  const { t, language } = useI18n();
  const { ponds, broodstock, feedingRecords, coldStorage } = useFarm();

  const [prompt, setPrompt] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [messages, setMessages] = useState<
    Array<{ role: 'user' | 'assistant'; text: string; time: string }>
  >([
    {
      role: 'assistant',
      text: `سلام و درود! من دستیار هوشمند اختصاصی مزرعه خاویار فتحی (Fathi Aqua Intelligence) هستم. 
می‌توانم در زمینه‌های زیر به شما کمک کنم:
• تحلیل شاخص‌های اکسیژن، دما و ریسک هیپوکسی در استخرها
• بهینه‌سازی رژیم غذایی و تنظیم FCR فیل‌ماهی
• ارزیابی شجره‌نامه ژنتیکی و زمان بهینه استحصال خاویار با شاخص PI
• عارضه‌یابی بیماری‌ها و دستورالعمل‌های قرنطینه و امنیت زیستی`,
      time: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Quick prompt suggestions
  const suggestions = [
    'استخرهای با ریسک افت اکسیژن را بررسی و راهکار ارائه بده.',
    'چگونه می‌توانیم FCR استخر ۱۰۱ را از ۱.۱۵ به کمتر از ۱.۰۵ برسانیم؟',
    'زمان مناسب سونوگرافی و استحصال خاویار برای ماهیان با قطر تخمک بالای ۳.۵mm چیست؟',
    'پروتکل ضدعفونی بستر استخرها در صورت مشاهده تلفات چیست؟',
  ];

  const handleSendMessage = async (userText: string) => {
    const textToSend = userText || prompt;
    if (!textToSend.trim() || loading) return;

    const userMsg = {
      role: 'user' as const,
      text: textToSend,
      time: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setPrompt('');
    setLoading(true);

    try {
      // Build farm context payload
      const farmContextData = {
        totalPonds: ponds.length,
        stoppedPonds: ponds.filter((p) => p.feedingStatus === 'STOPPED').map((p) => ({
          name: p.name,
          reason: p.stopFeedingReason,
          do: p.dissolvedOxygen,
        })),
        avgDO: (ponds.reduce((s, p) => s + p.dissolvedOxygen, 0) / ponds.length).toFixed(2),
        avgTemp: (ponds.reduce((s, p) => s + p.waterTemperature, 0) / ponds.length).toFixed(1),
        caviarStockKg: coldStorage.filter((c) => c.productType.includes('Caviar')).reduce((s, c) => s + c.weightKg, 0),
        broodstockCount: broodstock.length,
      };

      const response = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: textToSend,
          language,
          farmContext: farmContextData,
        }),
      });

      const data = await response.json();

      const aiMsg = {
        role: 'assistant' as const,
        text: data.answer || 'پاسخی دریافت نشد.',
        time: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'خطا در ارتباط با سرور هوش مصنوعی. لطفاً از اتصال اینترنت یا کلید Gemini API اطمینان حاصل فرمایید.',
          time: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2.5">
            <Bot className="w-6 h-6 text-purple-400" />
            مشاور هوشمند پرورش و سلامت ماهیان خاویاری (Gemini AI)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            دستیار تصمیم‌یار اختصاصی مجهز به هوش مصنوعی با دسترسی زنده به تله‌متری استخرها و داده‌های شجره‌نامه مزرعه
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 border border-purple-500/30 rounded-xl text-xs text-purple-300 font-bold">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span>Gemini 2.5 Flash Server-Side Integration</span>
        </div>
      </div>

      {/* Main Chat Interface */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm flex flex-col h-[580px] overflow-hidden">
        {/* Messages Scroll Area */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4 scrollbar-thin scrollbar-thumb-slate-700">
          {messages.map((msg, index) => {
            const isAi = msg.role === 'assistant';

            return (
              <div
                key={index}
                className={`flex items-start gap-3 ${isAi ? 'justify-start' : 'justify-end'}`}
              >
                {isAi && (
                  <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0 mt-1">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[80%] rounded-2xl p-4 text-xs leading-relaxed relative group ${
                    isAi
                      ? 'bg-slate-800/80 text-slate-200 border border-slate-700/80'
                      : 'bg-amber-500 text-slate-950 font-medium'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.text}</div>

                  <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-700/40 text-[10px] text-slate-400">
                    <span className={isAi ? 'text-slate-400' : 'text-slate-900'}>{msg.time}</span>
                    {isAi && (
                      <button
                        onClick={() => handleCopy(msg.text, index)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                      >
                        {copiedIndex === index ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">کپی شد</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>کپی متن</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="p-4 rounded-2xl bg-slate-800/80 text-xs text-slate-300 border border-slate-700 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-purple-400 animate-spin" />
                <span>هوش مصنوعی در حال تحلیل داده‌های مزرعه و استخراج پاسخ تخصصی...</span>
              </div>
            </div>
          )}
        </div>

        {/* Quick Suggestion Chips */}
        <div className="p-3 bg-slate-950/80 border-t border-slate-800 flex items-center gap-2 overflow-x-auto">
          <span className="text-[11px] text-slate-400 flex items-center gap-1 shrink-0">
            <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
            پرسش‌های سریع:
          </span>
          {suggestions.map((sug, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(sug)}
              className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-1 rounded-full whitespace-nowrap border border-slate-700 transition-colors cursor-pointer"
            >
              {sug}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(prompt);
          }}
          className="p-4 bg-slate-950 border-t border-slate-800 flex items-center gap-2"
        >
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="پرسش خود را در مورد پرورش فیل‌ماهی، درمان، جیره یا تحلیل استخرها بنویسید..."
            className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-purple-500"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={!prompt.trim() || loading}
            className="p-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-colors cursor-pointer shadow-lg shadow-purple-600/30"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
