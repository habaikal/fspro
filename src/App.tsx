import React, { useState, useRef, useEffect } from 'react';
import {
  CheckCircle, AlertCircle, TrendingUp, Zap, Loader2,
  Briefcase, File as FileIcon, RefreshCw, Download,
  Bookmark, Layers, Globe, ChevronDown, Printer, Upload
} from 'lucide-react';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer
} from 'recharts';

// ============================================================
// 설정 파일 임포트 (확장성 개선)
// ============================================================
import {
  LANGUAGES,
  TRANSLATIONS,
  type LanguageCode
} from './config/languages';
import {
  INDUSTRY_RULESETS,
  generateSystemPrompt,
  calculateWeightedScore,
  type IndustryType
} from './config/evaluationRules';

/**
 * GEMINI API CONFIGURATION
 * API Key is managed in App state
 */

// --- Types & Interfaces ---

interface EvaluationResult {
  businessName: string;
  summary: string;
  totalScore: number;
  dimensions: {
    id: string;
    name: string;
    score: number;
    grade: string;
    weight: number;
    reasoning: string;
    improvements: string;
  }[];
  expertCommentary: {
    technical: string;
    market: string;
    financial: string;
    policy: string;
  };
  recommendations: string[];
}

// --- Translations 및 Languages는 src/config에서 관리 ---
// TRANSLATIONS, LANGUAGES 참조 페이지: src/config/languages.ts

// --- Main Application Component ---

export default function App() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [apiKey, setApiKey] = useState('');
  const [tempApiKey, setTempApiKey] = useState('');
  const [temperature, setTemperature] = useState<number>(0.0);
  const [selectedIndustry, setSelectedIndustry] = useState<IndustryType>('General/Other');
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [file, setFile] = useState<File | null>(null);
  const [textInput, setTextInput] = useState<string>('');
  const [inputType, setInputType] = useState<'file' | 'text'>('file');
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [libStatus, setLibStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const langMenuRef = useRef<HTMLDivElement>(null);

  // Load external scripts for PDF generation with Promise control
  useEffect(() => {
    const loadScript = (src: string) => {
      return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
          resolve(true);
          return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => resolve(true);
        script.onerror = () => reject(false);
        document.body.appendChild(script);
      });
    };

    Promise.all([
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'),
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')
    ])
      .then(() => setLibStatus('ready'))
      .catch(() => setLibStatus('error'));
  }, []);

  // Handle outside click to close language menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setIsLangMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // --- Handlers ---

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleAnalyze = async () => {
    if (inputType === 'file' && !file) {
      setError("Please upload a file.");
      return;
    }
    if (inputType === 'text' && textInput.length < 50) {
      setError("Please enter enough text (min 50 chars).");
      return;
    }

    setStep(2);
    setError(null);

    try {
      let contentPart: any = {};

      if (inputType === 'text') {
        contentPart = { text: textInput };
      } else if (file) {
        if (file.type === 'application/pdf') {
          const base64Data = await fileToBase64(file);
          contentPart = {
            inlineData: {
              mimeType: "application/pdf",
              data: base64Data
            }
          };
        } else if (file.type === 'text/plain' || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
          const textData = await fileToText(file);
          contentPart = { text: textData };
        } else {
          throw new Error("Browser only supports direct PDF/TXT/MD analysis.");
        }
      }

      // Dynamic Prompt based on Language & Industry
      const selectedLangName = LANGUAGES.find(l => l.code === language)?.name || 'English';
      const industryRuleset = INDUSTRY_RULESETS[selectedIndustry];

      const systemPrompt = generateSystemPrompt(selectedIndustry, selectedLangName, industryRuleset);

      const response = await callGeminiAPI(systemPrompt, contentPart);
      const jsonText = response.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedResult = JSON.parse(jsonText);

      // ============================================================
      // ✅ totalScore를 가중 평균(Weighted Average)으로 계산
      // ============================================================
      // 
      // 기존 방식 (수정 전):
      // - 단순 평균: (82+85+74+80+70) ÷ 5개 = 78.2점
      // 
      // 개선된 방식 (현재):
      // - 가중 평균: 
      //   기술(82)×0.30 + 시장(85)×0.25 + 재무(74)×0.20 + 사업모델(80)×0.15 + 리스크(70)×0.10
      //   = 24.6 + 21.25 + 14.8 + 12.0 + 7.0 = 79.65 ≈ 79.7점
      //
      // ✅ 타당성: 
      // - 무조건적인 상향이 아니며 수학적으로 정확함
      // - 비즈니스에서 모든 지표가 동등하지 않다는 원칙 반영
      // - 기술/시장 점수가 높으면 전체 점수도 올바르게 상향
      // - 리스크/재무 점수가 낮아도 전체 점수에 과도한 영향을 주지 않음
      // - McKinsey/BCG 등 컨설팅 표준 방식 적용
      //
      // 차원 수 변경 시에도 자동 계산됨 (동적 지원)
      // ============================================================
      if (parsedResult.dimensions && parsedResult.dimensions.length > 0) {
        const weightedScore = calculateWeightedScore(parsedResult.dimensions);
        parsedResult.totalScore = weightedScore;
      }

      setResult(parsedResult);
      setStep(3);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Analysis failed. Please try again.");
      setStep(1);
    }
  };

  const handleReset = () => {
    setFile(null);
    setTextInput('');
    setResult(null);
    setStep(1);
    setError(null);
  };

  // --- Helpers ---
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  const fileToText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsText(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const callGeminiAPI = async (systemPrompt: string, contentPart: any) => {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: "Analyze this business plan and output valid JSON." },
                contentPart
              ]
            }],
            systemInstruction: {
              parts: [{ text: systemPrompt }]
            },
            generationConfig: {
              responseMimeType: "application/json",
              temperature: temperature,
            }
          }),
        }
      );

      if (!response.ok) {
        let errorMsg = response.statusText;
        try {
          const errData = await response.json();
          if (errData.error && errData.error.message) {
            errorMsg = errData.error.message;
          }
        } catch (e) {}
        throw new Error(`API Error [${response.status}]: ${errorMsg}`);
      }

      const data = await response.json();
      return data.candidates[0].content.parts[0].text;
    } catch (error) {
      throw error;
    }
  };

  const t = TRANSLATIONS[language];

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 print:bg-white">
      {/* App Navigation Bar */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50 shadow-lg print:hidden">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-inner">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-wide">
              {t.app_name} <span className="text-indigo-400 font-light">{t.app_sub}</span>
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:block text-xs font-medium text-slate-400 uppercase tracking-widest">
              {t.app_desc}
            </div>
            {/* Language Selector */}
            <div className="relative" ref={langMenuRef}>
              <button
                onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm border transition-all duration-200
                  ${isLangMenuOpen
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md ring-2 ring-indigo-200 ring-offset-1 ring-offset-slate-900'
                    : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700 hover:border-slate-600'
                  }`}
              >
                <Globe className="w-4 h-4" />
                <span className="font-medium">{LANGUAGES.find(l => l.code === language)?.flag}</span>
                <span className="hidden sm:inline font-medium">{LANGUAGES.find(l => l.code === language)?.name}</span>
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isLangMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {isLangMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="py-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                    {LANGUAGES.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          setLanguage(lang.code);
                          setIsLangMenuOpen(false);
                        }}
                        className={`w-full text-left px-4 py-3 text-sm flex items-center gap-3 transition-colors
                          ${language === lang.code
                            ? 'bg-indigo-50 text-indigo-700 font-bold border-l-4 border-indigo-600'
                            : 'text-slate-700 hover:bg-slate-50 border-l-4 border-transparent'
                          }
                        `}
                      >
                        <span className="text-lg">{lang.flag}</span>
                        <span>{lang.name}</span>
                        {language === lang.code && <CheckCircle className="w-4 h-4 ml-auto" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-12 print:p-0">
        {!apiKey && (
          <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg border border-slate-200 p-8 text-center animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6 text-indigo-600">
              <Zap className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Welcome to FS Pro</h2>
            <p className="text-slate-500 mb-6">
              {language === 'ko' ? '서비스 이용을 위해 Gemini API Key를 입력해주세요.' : 'Please enter your Gemini API Key to continue.'}
            </p>

            <div className="space-y-4 text-left">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Gemini API Key</label>
                <input
                  type="password"
                  value={tempApiKey}
                  onChange={(e) => setTempApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                />
              </div>

              <button
                onClick={() => {
                  if (tempApiKey.trim().length > 10) {
                    setApiKey(tempApiKey.trim());
                  } else {
                    alert("Please enter a valid API Key");
                  }
                }}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {language === 'ko' ? '시작하기' : 'Start Analysis'} <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
              </button>

              <p className="text-xs text-center text-slate-400 mt-4">
                Get a key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-500 hover:underline">Google AI Studio</a>.
              </p>
            </div>
          </div>
        )}

        {apiKey && step === 1 && (
          <UploadSection
            t={t}
            industry={selectedIndustry}
            setIndustry={setSelectedIndustry}
            inputType={inputType}
            setInputType={setInputType}
            file={file}
            handleFileUpload={handleFileUpload}
            textInput={textInput}
            setTextInput={setTextInput}
            error={error}
            onAnalyze={handleAnalyze}
            temperature={temperature}
            setTemperature={setTemperature}
          />
        )}

        {apiKey && step === 2 && (
          <AnalyzingSection industry={selectedIndustry} t={t} />
        )}

        {apiKey && step === 3 && result && (
          <ResultSection
            result={result}
            industry={selectedIndustry}
            onReset={handleReset}
            isDownloading={isDownloading}
            setIsDownloading={setIsDownloading}
            libStatus={libStatus}
            t={t}
          />
        )}
      </main>

      {/* Footer */}
      <div className="py-8 text-center text-slate-400 text-xs print:hidden">
        &copy; 2025 FS Pro. All Rights Reserved. Powered by Gemini.
      </div>
    </div>
  );
}

// --- Sub-Components ---

function UploadSection({
  t, industry, setIndustry, inputType, setInputType,
  file, handleFileUpload, textInput, setTextInput, error, onAnalyze,
  temperature, setTemperature
}: any) {

  // 동적으로 INDUSTRY_RULESETS에서 업계 목록 가져오기
  const industries = Object.keys(INDUSTRY_RULESETS) as IndustryType[];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-12 max-w-4xl mx-auto print:hidden">
      <div className="text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-900/10 text-indigo-700 rounded-full text-xs font-bold tracking-wider uppercase mb-2 border border-indigo-100">
          <Zap className="w-3 h-3" />
          {t.hero_badge}
        </div>
        <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-900 leading-tight font-serif">
          {t.hero_title} <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-700 to-blue-600">
            {t.hero_highlight}
          </span>
        </h2>
        <p className="text-slate-600 max-w-2xl mx-auto text-lg leading-relaxed">
          {t.hero_desc}
        </p>
      </div>

      <div className="bg-white rounded-3xl shadow-2xl shadow-slate-200 border border-slate-100 overflow-hidden">
        {/* Step 1: Industry */}
        <div className="p-8 border-b border-slate-100 bg-slate-50/50">
          <label className="block text-sm font-bold text-slate-900 mb-4 flex items-center gap-2 uppercase tracking-wide">
            <Briefcase className="w-4 h-4 text-indigo-600" />
            {t.label_industry}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {industries.map((ind) => (
              <button
                key={ind}
                onClick={() => setIndustry(ind)}
                className={`px-3 py-3 rounded-xl text-xs font-bold transition-all text-center border-2 truncate
                  ${industry === ind
                    ? 'bg-slate-800 text-white border-slate-800 shadow-lg transform scale-105'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400 hover:text-slate-700'
                  }`}
              >
                {t.industries[ind]}
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Input */}
        <div className="p-8">
          <label className="block text-sm font-bold text-slate-900 mb-4 flex items-center gap-2 uppercase tracking-wide">
            <FileIcon className="w-4 h-4 text-indigo-600" />
            {t.label_upload}
          </label>

          <div className="flex border-b border-slate-200 mb-6">
            <button
              onClick={() => setInputType('file')}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-bold border-b-2 transition-colors ${inputType === 'file'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
            >
              {t.tab_file}
            </button>
            <button
              onClick={() => setInputType('text')}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-bold border-b-2 transition-colors ${inputType === 'text'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
            >
              {t.tab_text}
            </button>
          </div>

          <div className="min-h-[220px]">
            {inputType === 'file' ? (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-slate-300 rounded-2xl p-12 text-center hover:bg-indigo-50/30 hover:border-indigo-300 transition-all group relative cursor-pointer">
                  <input
                    type="file"
                    accept=".pdf,.txt,.md"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center justify-center space-y-4 pointer-events-none">
                    <div className="w-16 h-16 bg-white text-slate-700 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center group-hover:scale-110 group-hover:text-indigo-600 transition-all">
                      <Upload className="w-8 h-8" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-bold text-slate-900 text-lg">{t.drop_title}</p>
                      <p className="text-sm text-slate-500 font-medium">{t.drop_desc}</p>
                    </div>
                  </div>
                </div>

                {file && (
                  <div className="flex items-center p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-900 animate-in fade-in slide-in-from-top-2">
                    <FileIcon className="w-5 h-5 mr-3 text-indigo-600" />
                    <span className="font-bold truncate flex-1">{file.name}</span>
                    <span className="text-xs bg-white/60 px-2 py-1 rounded font-mono text-indigo-700">{(file.size / 1024).toFixed(1)} KB</span>
                    <CheckCircle className="w-5 h-5 ml-3 text-emerald-500" />
                  </div>
                )}

                <div className="flex items-start gap-3 text-xs text-slate-500 bg-slate-100 p-4 rounded-xl">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
                  <p>
                    {t.drop_desc}. (PPT/DOC → PDF)
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder={t.text_placeholder}
                  className="w-full h-64 p-5 border border-slate-300 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all resize-none text-slate-700 leading-relaxed font-mono text-sm"
                />
                <div className="text-right text-xs text-slate-400 font-medium">
                  {textInput.length}
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-6 p-4 bg-rose-50 text-rose-700 text-sm rounded-xl flex items-center gap-3 border border-rose-100 shadow-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* Temperature Control */}
          <div className="mt-8 pt-8 border-t border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                AI Creativity (Temperature)
              </label>
              <span className="text-xs font-mono font-bold bg-slate-100 px-2 py-1 rounded text-slate-600">
                {temperature.toFixed(1)}
              </span>
            </div>
            <input
              type="range"
              min="0.0"
              max="2.0"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-2 font-medium uppercase tracking-wide">
              <span>Precise (0.0)</span>
              <span>Balanced (1.0)</span>
              <span>Creative (2.0)</span>
            </div>
          </div>

          <button
            onClick={onAnalyze}
            className="w-full mt-8 py-5 bg-slate-900 text-white rounded-xl font-bold text-lg hover:bg-slate-800 transition-all active:scale-[0.99] shadow-xl flex items-center justify-center gap-3 group"
          >
            <Zap className="w-5 h-5 text-yellow-400 group-hover:animate-pulse" />
            {t.btn_analyze}
          </button>
        </div>
      </div>
    </div>
  );
}

function AnalyzingSection({ industry, t }: { industry: string, t: any }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 98) return prev;
        return prev + 0.5;
      });
    }, 80);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[600px] text-center space-y-12 animate-in fade-in duration-700 print:hidden">
      <div className="relative w-40 h-40">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="80"
            cy="80"
            r="70"
            stroke="#e2e8f0"
            strokeWidth="8"
            fill="transparent"
          />
          <circle
            cx="80"
            cy="80"
            r="70"
            stroke="#4f46e5"
            strokeWidth="8"
            fill="transparent"
            strokeDasharray={440}
            strokeDashoffset={440 - (440 * progress) / 100}
            className="transition-all duration-300 ease-linear"
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center flex-col">
          <span className="text-4xl font-black text-slate-800">{Math.round(progress)}%</span>
        </div>
      </div>

      <div className="space-y-4 max-w-lg">
        <h3 className="text-2xl font-bold text-slate-900 font-serif">{t.analyzing_title}</h3>
        <div className="h-8 flex items-center justify-center">
          <p className="text-indigo-600 font-medium animate-pulse">{t.industries[industry]}...</p>
        </div>
      </div>
    </div>
  );
}

// --- Custom Tick Component for Radar Chart ---
const CustomRadarTick = (props: any) => {
  const { x, y, payload } = props;
  const { value } = payload;

  // Try to wrap text if it's too long (simple split by space)
  const words = value.split(' ');

  return (
    <text x={x} y={y} textAnchor="middle" fill="#334155" fontSize={10} fontWeight={700}>
      {words.length > 2 ? (
        <>
          <tspan x={x} dy="-0.5em">{words.slice(0, Math.ceil(words.length / 2)).join(' ')}</tspan>
          <tspan x={x} dy="1.2em">{words.slice(Math.ceil(words.length / 2)).join(' ')}</tspan>
        </>
      ) : (
        value
      )}
    </text>
  );
};


function ResultSection({ result, industry, onReset, isDownloading, setIsDownloading, libStatus, t }: {
  result: EvaluationResult,
  industry: string,
  onReset: () => void,
  isDownloading: boolean,
  setIsDownloading: (val: boolean) => void,
  libStatus: 'loading' | 'ready' | 'error',
  t: any
}) {



  const getGradeStyle = (grade: string) => {
    const styles: Record<string, string> = {
      'S': 'bg-slate-900 text-white border-slate-900',
      'A': 'bg-indigo-900 text-white border-indigo-900',
      'B': 'bg-white text-indigo-900 border-indigo-900',
      'C': 'bg-white text-slate-600 border-slate-400',
      'D': 'bg-white text-rose-600 border-rose-200',
    };
    return styles[grade[0]] || styles['C'];
  };

  const chartData = result.dimensions.map(d => ({
    subject: d.name,
    A: d.score,
    fullMark: 100,
  }));

  const handleDownloadPDF = async () => {
    const html2canvas = (window as any).html2canvas;
    const jsPDF = (window as any).jspdf?.jsPDF;

    // --- CRITICAL FALLBACK MECHANISM ---
    if (!html2canvas || !jsPDF || libStatus !== 'ready') {
      console.warn("PDF libraries missing. Executing browser print fallback.");
      window.print();
      return;
    }

    setIsDownloading(true);

    setTimeout(async () => {
      try {
        const element = document.getElementById('report-section');
        if (!element) throw new Error("Report element not found");

        const canvas = await html2canvas(element, {
          scale: 1.5, // Reduced scale for stability
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/png');
        const imgWidth = 210;
        const pageHeight = 297;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        const pdf = new jsPDF('p', 'mm', [imgWidth, Math.max(imgHeight, pageHeight) + 10]);
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

        const safeName = result.businessName.replace(/[^a-zA-Z0-9가-힣\s_-]/g, '').trim();
        const fileName = safeName ? `${safeName}_Report.pdf` : 'Report.pdf';

        pdf.save(fileName);

      } catch (error) {
        console.error("PDF Fail:", error);
        // Alert user and triggering fallback print
        alert("PDF 생성에 실패하여 인쇄 모드로 전환합니다. 인쇄 창에서 'PDF로 저장'을 선택해주세요.");
        window.print();
      } finally {
        setIsDownloading(false);
      }
    }, 500);
  };

  return (
    <div className="flex flex-col items-center">
      {/* Report Container - Mimics A4 Paper */}
      <div id="report-section" className="bg-white text-slate-800 w-full max-w-[210mm] min-h-[297mm] shadow-2xl p-10 sm:p-14 relative mx-auto my-8 print:shadow-none print:my-0 print:w-full print:max-w-none">

        {/* Top Decorative Bar */}
        <div className="absolute top-0 left-0 right-0 h-3 bg-slate-900 print:hidden"></div>
        <div className="absolute top-3 right-10 w-24 h-2 bg-indigo-600 print:hidden"></div>

        {/* 1. Report Header */}
        <div className="flex justify-between items-end border-b-2 border-slate-900 pb-6 mb-10 mt-4">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2">
              {t.report_title}
            </div>
            <h1 className="text-3xl sm:text-4xl font-serif font-bold text-slate-900 leading-tight">
              {result.businessName}
            </h1>
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-sm font-bold text-indigo-800">{t.industries[industry]}</div>
            <div className="text-xs text-slate-500 mt-1">{new Date().toLocaleDateString()}</div>
          </div>
        </div>

        {/* 2. Executive Dashboard */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12 print:block print:space-y-8">

          {/* Score Card */}
          <div className="lg:col-span-1 bg-slate-50 p-6 border-l-4 border-indigo-900 flex flex-col justify-between print:break-inside-avoid print:mb-8">
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">{t.overall_rating}</h3>
              <div className="flex items-baseline gap-2">
                <span className={`text-6xl font-serif font-black ${result.totalScore >= 80 ? 'text-slate-900' : 'text-slate-700'}`}>
                  {result.totalScore}
                </span>
                <span className="text-xl text-slate-400 font-light">/100</span>
              </div>
            </div>

            <div className="mt-6">
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden print:hidden">
                <div
                  className={`h-full ${result.totalScore >= 80 ? 'bg-emerald-600' : result.totalScore >= 60 ? 'bg-indigo-600' : 'bg-amber-500'}`}
                  style={{ width: `${result.totalScore}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-medium">
                <span>Risk</span>
                <span>Stable</span>
                <span>Investable</span>
              </div>
            </div>
          </div>

          {/* Executive Summary Text */}
          <div className="lg:col-span-2 print:break-inside-avoid">
            <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2 font-serif">
              <Bookmark className="w-5 h-5 text-indigo-700" />
              {t.exec_summary}
            </h3>
            <p className="text-slate-600 leading-relaxed text-sm sm:text-base text-justify font-serif">
              {result.summary}
            </p>
          </div>
        </div>

        {/* 3. Detailed Analysis (Radar + Factors) */}
        <div className="mb-12 print:break-inside-avoid">
          <h3 className="text-lg font-bold text-slate-900 mb-6 border-b border-slate-200 pb-2 font-serif">
            {t.factor_analysis}
          </h3>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 print:block">
            {/* Radar Chart - Often problematic in PDF/Print, handled by html2canvas or hidden in print css if needed */}
            <div className="lg:col-span-1 flex items-center justify-center bg-slate-50 rounded-xl py-6 border border-slate-100 print:mb-8">
              <div className="w-full h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
                    <PolarGrid stroke="#cbd5e1" />
                    <PolarAngleAxis
                      dataKey="subject"
                      tick={<CustomRadarTick />}
                    />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar
                      name="Score"
                      dataKey="A"
                      stroke="#312e81"
                      strokeWidth={2.5}
                      fill="#4f46e5"
                      fillOpacity={0.15}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Factor Table */}
            <div className="lg:col-span-2 space-y-5 print:space-y-4">
              {result.dimensions.map((dim) => (
                <div key={dim.id} className="group print:break-inside-avoid">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border ${getGradeStyle(dim.grade)}`}>
                        {dim.grade}
                      </div>
                      <div>
                        <span className="font-bold text-slate-900 text-sm block">{dim.name}</span>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-slate-700">{dim.score} pts</span>
                  </div>

                  {/* Insight Box */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-11">
                    <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded border-l-2 border-indigo-400">
                      <strong className="text-indigo-900 block mb-1">Key Strength</strong>
                      {dim.reasoning}
                    </div>
                    <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded border-l-2 border-rose-300">
                      <strong className="text-rose-900 block mb-1">Risk / Improvement</strong>
                      {dim.improvements}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 4. Expert Commentary Grid */}
        <div className="mb-12 print:break-inside-avoid">
          <h3 className="text-lg font-bold text-slate-900 mb-6 border-b border-slate-200 pb-2 font-serif">
            {t.expert_commentary}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 print:block print:space-y-4">
            <CommentaryBox title={t.comments.tech} content={result.expertCommentary.technical} />
            <CommentaryBox title={t.comments.market} content={result.expertCommentary.market} />
            <CommentaryBox title={t.comments.fin} content={result.expertCommentary.financial} />
            <CommentaryBox title={t.comments.risk} content={result.expertCommentary.policy} />
          </div>
        </div>

        {/* 5. Strategic Recommendations (Roadmap Style) */}
        <div className="print:break-inside-avoid">
          <h3 className="text-lg font-bold text-slate-900 mb-6 border-b border-slate-200 pb-2 font-serif">
            {t.roadmap}
          </h3>
          <div className="space-y-4">
            {result.recommendations.map((rec, idx) => (
              <div key={idx} className="flex gap-4 group print:break-inside-avoid">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm shrink-0 border-4 border-white shadow-md z-10 print:bg-black print:text-white print:border-black">
                    {idx + 1}
                  </div>
                  {idx !== result.recommendations.length - 1 && (
                    <div className="w-0.5 h-full bg-slate-200 -my-1 print:bg-slate-400"></div>
                  )}
                </div>
                <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex-1 shadow-sm group-hover:shadow-md transition-shadow print:bg-white print:border-slate-300">
                  <p className="text-slate-700 text-sm font-medium leading-relaxed">
                    {rec}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer in Report */}
        <div className="absolute bottom-6 left-10 right-10 flex justify-between text-[9px] text-slate-400 border-t border-slate-100 pt-4 print:hidden">
          <span>{t.disclaimer}</span>
          <span>Confidential & Proprietary</span>
        </div>

      </div>

      {/* Floating Action Bar (Outside PDF) */}
      <div className="sticky bottom-8 flex items-center gap-4 bg-white/90 backdrop-blur-md p-3 rounded-full shadow-xl border border-slate-200 z-50 animate-in slide-in-from-bottom-10 print:hidden" data-html2canvas-ignore>
        <button
          onClick={onReset}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
          title={t.reset_btn}
        >
          <RefreshCw className="w-5 h-5" />
        </button>
        <div className="h-6 w-px bg-slate-300"></div>

        {/* FALLBACK PRINT BUTTON (VISIBLE IF PDF FAILS OR USER PREFERS) */}
        <button
          onClick={() => window.print()}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors sm:hidden"
          title="Print"
        >
          <Printer className="w-5 h-5" />
        </button>

        <button
          onClick={handleDownloadPDF}
          disabled={isDownloading}
          className="flex items-center gap-2 px-6 py-2 bg-slate-900 text-white rounded-full font-bold hover:bg-slate-800 transition-all shadow-lg active:scale-95 disabled:bg-slate-500"
        >
          {isDownloading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t.generating}
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              {t.download_btn}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function CommentaryBox({ title, content }: { title: string, content: string }) {
  return (
    <div className="p-5 border border-slate-200 rounded-lg bg-white shadow-sm hover:border-indigo-200 transition-colors print:break-inside-avoid print:border-slate-300">
      <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wide mb-3 flex items-center gap-2 print:text-black">
        <Layers className="w-3 h-3" />
        {title}
      </h4>
      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed text-justify print:text-black">
        {content}
      </p>
    </div>
  );
}