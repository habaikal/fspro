import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, FileText, CheckCircle, AlertCircle, BarChart2, 
  PieChart, TrendingUp, ShieldAlert, Zap, Loader2, 
  ChevronDown, ChevronUp, Briefcase, File as FileIcon,
  RefreshCw, Download, Printer
} from 'lucide-react';
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, 
  ResponsiveContainer, Tooltip as RechartsTooltip 
} from 'recharts';

/**
 * GEMINI API CONFIGURATION
 */
const apiKey = ""; 

// --- Types & Interfaces ---

type IndustryType = 'AI/Data' | 'Blockchain/Fintech' | 'Bio/Healthcare' | 'Clean Energy' | 'Aerospace/Manufacturing' | 'Content/Media' | 'General/Other';

interface EvaluationResult {
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

// --- Main Application Component ---

export default function App() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedIndustry, setSelectedIndustry] = useState<IndustryType>('General/Other');
  const [file, setFile] = useState<File | null>(null);
  const [textInput, setTextInput] = useState<string>('');
  const [inputType, setInputType] = useState<'file' | 'text'>('file');
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Load external scripts for PDF generation
  useEffect(() => {
    const loadScript = (src: string) => {
      if (!document.querySelector(`script[src="${src}"]`)) {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        document.body.appendChild(script);
      }
    };
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
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
      setError("파일을 업로드해주세요.");
      return;
    }
    if (inputType === 'text' && textInput.length < 50) {
      setError("분석할 텍스트를 충분히 입력해주세요 (최소 50자).");
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
           throw new Error("브라우저 환경에서는 PDF, TXT, MD 파일만 직접 분석 가능합니다. PPT/DOC/HWP 등은 PDF로 변환하여 업로드하거나 내용을 텍스트로 붙여넣어 주세요.");
        }
      }

      const systemPrompt = `
        당신은 ${selectedIndustry} 분야의 최고 사업 분석 전문가입니다. 
        사용자가 제출한 사업계획서를 '사업성 분석 이론'과 '산업별 평가 모델'에 기반하여 객관적으로 평가해야 합니다.

        [분석 프레임워크]
        다음 5가지 핵심 차원을 기준으로 100점 만점으로 평가하십시오.
        1. 기술성 (Technology): 기술의 독창성, 진입장벽, 개발 능력, 완성도. (가중치 30%)
        2. 시장성 (Market): 시장 규모(TAM/SAM/SOM), 성장성(CAGR), 경쟁 강도, 마케팅 전략. (가중치 25%)
        3. 재무성 (Finance): 수익 모델, BEP 도달 가능성, 자금 조달 및 운영 계획. (가중치 20%)
        4. 사업모델 (Business Model): 가치 제안, 지속 가능성, 확장성. (가중치 15%)
        5. 리스크 관리 (Risk): 규제 대응, 팀 역량, 운영 리스크. (가중치 10%)

        [출력 형식]
        결과는 반드시 다음 JSON 스키마를 따르는 순수한 JSON 문자열이어야 합니다 (Markdown 포맷팅 없이).
        {
          "summary": "전체적인 사업성 요약 (3-5문장)",
          "totalScore": 0-100 사이 정수,
          "dimensions": [
            { "id": "tech", "name": "기술성", "score": 0-100, "grade": "A/B/C/D", "weight": 0.3, "reasoning": "핵심 근거", "improvements": "개선점" },
            { "id": "market", "name": "시장성", "score": 0-100, "grade": "A/B/C/D", "weight": 0.25, "reasoning": "...", "improvements": "..." },
            { "id": "finance", "name": "재무성", "score": 0-100, "grade": "A/B/C/D", "weight": 0.2, "reasoning": "...", "improvements": "..." },
            { "id": "biz", "name": "사업모델", "score": 0-100, "grade": "A/B/C/D", "weight": 0.15, "reasoning": "...", "improvements": "..." },
            { "id": "risk", "name": "리스크관리", "score": 0-100, "grade": "A/B/C/D", "weight": 0.1, "reasoning": "...", "improvements": "..." }
          ],
          "expertCommentary": {
            "technical": "기술 전문가 시각 코멘트",
            "market": "시장 전략가 시각 코멘트",
            "financial": "재무 분석가 시각 코멘트",
            "policy": "정책/규제 전문가 시각 코멘트"
          },
          "recommendations": ["구체적인 제언 1", "구체적인 제언 2", "구체적인 제언 3"]
        }
      `;

      const response = await callGeminiAPI(systemPrompt, contentPart);
      const jsonText = response.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedResult = JSON.parse(jsonText);
      
      setResult(parsedResult);
      setStep(3);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "분석 중 오류가 발생했습니다. 다시 시도해 주세요.");
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
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: "다음 사업계획서를 분석하고 JSON 형식으로 결과를 출력해주세요." },
                contentPart
              ]
            }],
            systemInstruction: {
              parts: [{ text: systemPrompt }]
            },
            generationConfig: {
              responseMimeType: "application/json"
            }
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`API 요청 실패: ${response.statusText}`);
      }

      const data = await response.json();
      return data.candidates[0].content.parts[0].text;
    } catch (error) {
      throw error;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
              B
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-700 to-indigo-600 bg-clip-text text-transparent">
              BizFeasibility AI
            </h1>
          </div>
          <div className="text-sm text-slate-500 hidden sm:block">
            사업성 분석 & 사업계획서 평가 솔루션
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {step === 1 && (
          <UploadSection 
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
          />
        )}

        {step === 2 && (
          <AnalyzingSection industry={selectedIndustry} />
        )}

        {step === 3 && result && (
          <ResultSection 
            result={result} 
            industry={selectedIndustry} 
            onReset={handleReset} 
            isDownloading={isDownloading}
            setIsDownloading={setIsDownloading}
          />
        )}
      </main>
    </div>
  );
}

// --- Sub-Components ---

function UploadSection({ 
  industry, setIndustry, inputType, setInputType, 
  file, handleFileUpload, textInput, setTextInput, error, onAnalyze 
}: any) {
  
  const industries: IndustryType[] = [
    'AI/Data', 'Blockchain/Fintech', 'Bio/Healthcare', 
    'Clean Energy', 'Aerospace/Manufacturing', 'Content/Media', 'General/Other'
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
      <div className="text-center space-y-3 py-8">
        <h2 className="text-3xl font-extrabold text-slate-900">
          사업계획서의 성공 가능성을 <br className="sm:hidden" />
          <span className="text-blue-600">전문가 수준</span>으로 진단합니다.
        </h2>
        <p className="text-slate-600 max-w-2xl mx-auto">
          두 가지 핵심 분석 모델(사업성 분석 이론 + 산업별 전문가 평가)을 결합하여,
          기술성, 시장성, 재무성, 리스크 등 5차원 심층 분석 리포트를 제공합니다.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-3xl mx-auto">
        <div className="mb-8">
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            산업 분야 선택 (평가 가중치가 달라집니다)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {industries.map((ind) => (
              <button
                key={ind}
                onClick={() => setIndustry(ind)}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all text-left truncate
                  ${industry === ind 
                    ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-200 ring-offset-1' 
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
              >
                {ind}
              </button>
            ))}
          </div>
        </div>

        <div className="flex border-b border-slate-200 mb-6">
          <button
            onClick={() => setInputType('file')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              inputType === 'file' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Upload className="w-4 h-4" />
            파일 업로드
          </button>
          <button
            onClick={() => setInputType('text')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              inputType === 'text' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileText className="w-4 h-4" />
            텍스트 직접 입력
          </button>
        </div>

        <div className="min-h-[200px]">
          {inputType === 'file' ? (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors group relative cursor-pointer">
                <input 
                  type="file" 
                  accept=".pdf,.txt,.md" 
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center justify-center space-y-3 pointer-events-none">
                  <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium text-slate-700">파일을 드래그하거나 클릭하여 업로드하세요</p>
                    <p className="text-sm text-slate-400">지원 형식: PDF, TXT, MD (최대 10MB)</p>
                  </div>
                </div>
              </div>
              
              {file && (
                <div className="flex items-center p-4 bg-blue-50 border border-blue-100 rounded-lg text-blue-800">
                  <FileIcon className="w-5 h-5 mr-3" />
                  <span className="font-medium truncate flex-1">{file.name}</span>
                  <span className="text-xs bg-blue-200 px-2 py-1 rounded">{(file.size / 1024).toFixed(1)} KB</span>
                </div>
              )}
              
              <div className="flex items-start gap-2 text-xs text-slate-500 bg-slate-100 p-3 rounded">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  PPT, HWP, DOC 파일은 PDF로 변환하여 업로드하시거나, '텍스트 직접 입력' 탭을 이용해 내용을 붙여넣어 주세요. 
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="사업계획서의 핵심 내용(개요, 시장분석, 기술설명 등)을 이곳에 붙여넣으세요..."
                className="w-full h-64 p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-slate-700"
              />
              <div className="text-right text-xs text-slate-400">
                {textInput.length} 자 입력됨
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <button
          onClick={onAnalyze}
          className="w-full mt-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold text-lg hover:shadow-lg hover:from-blue-700 hover:to-indigo-700 transition-all active:scale-[0.99]"
        >
          AI 사업성 분석 시작하기
        </button>
      </div>
    </div>
  );
}

function AnalyzingSection({ industry }: { industry: string }) {
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("문서를 스캔하는 중입니다...");

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return prev;
        return prev + 1;
      });
    }, 150);

    const timeouts = [
      setTimeout(() => setMessage("산업별 평가 기준을 로딩 중입니다..."), 2000),
      setTimeout(() => setMessage(`${industry} 분야 전문 페르소나 적용 중...`), 4000),
      setTimeout(() => setMessage("기술성, 시장성, 재무성 5차원 분석 수행 중..."), 7000),
      setTimeout(() => setMessage("최종 리포트 생성 중..."), 10000),
    ];

    return () => {
      clearInterval(interval);
      timeouts.forEach(clearTimeout);
    };
  }, [industry]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] text-center space-y-8 animate-in fade-in duration-700">
      <div className="relative w-24 h-24">
        <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
        <div 
          className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"
        ></div>
        <Zap className="absolute inset-0 m-auto text-blue-600 w-8 h-8 animate-pulse" />
      </div>
      
      <div className="space-y-2">
        <h3 className="text-2xl font-bold text-slate-800">AI가 사업계획서를 분석하고 있습니다</h3>
        <p className="text-slate-500 font-medium min-h-[1.5em]">{message}</p>
      </div>

      <div className="w-full max-w-md bg-slate-200 rounded-full h-2.5 overflow-hidden">
        <div 
          className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
    </div>
  );
}

function ResultSection({ result, industry, onReset, isDownloading, setIsDownloading }: { 
  result: EvaluationResult, 
  industry: string, 
  onReset: () => void,
  isDownloading: boolean,
  setIsDownloading: (val: boolean) => void
}) {
  
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-amber-600';
    return 'text-red-600';
  };

  const getGradeBadge = (grade: string) => {
    const colors: Record<string, string> = {
      'A': 'bg-green-100 text-green-700 border-green-200',
      'B': 'bg-blue-100 text-blue-700 border-blue-200',
      'C': 'bg-amber-100 text-amber-700 border-amber-200',
      'D': 'bg-red-100 text-red-700 border-red-200',
    };
    return `px-3 py-1 rounded-full text-sm font-bold border ${colors[grade[0]] || colors['C']}`;
  };

  const chartData = result.dimensions.map(d => ({
    subject: d.name,
    A: d.score,
    fullMark: 100,
  }));

  const handleDownloadPDF = async () => {
    const html2canvas = (window as any).html2canvas;
    const jsPDF = (window as any).jspdf?.jsPDF;

    if (!html2canvas || !jsPDF) {
      alert("PDF 생성 라이브러리가 아직 로드되지 않았습니다. 3초 뒤 다시 시도해주세요.");
      return;
    }

    setIsDownloading(true);
    
    // Give UI a moment to show loading state
    setTimeout(async () => {
      try {
        const element = document.getElementById('report-section');
        if (!element) return;

        const canvas = await html2canvas(element, {
          scale: 2, // Higher quality
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/png');
        
        // Calculate PDF dimensions based on the captured content
        // 1px = 0.264583 mm
        const imgWidth = 210; // A4 width in mm
        const pageHeight = 297; // A4 height in mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        // We use a custom height to create a "continuous" PDF if the content is long
        // This avoids awkward page breaks in the middle of text
        const pdf = new jsPDF('p', 'mm', [imgWidth, Math.max(imgHeight, pageHeight) + 10]);

        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
        pdf.save('사업성평가_리포트.pdf');

      } catch (error) {
        console.error("PDF generation failed:", error);
        alert("PDF 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      } finally {
        setIsDownloading(false);
      }
    }, 100);
  };

  return (
    <div id="report-section" className="space-y-8 animate-in slide-in-from-bottom-8 duration-700 pb-20 bg-slate-50 p-4 sm:p-0">
      
      {/* 1. Executive Summary Card */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
        <div className="bg-slate-900 text-white p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-medium backdrop-blur-sm">
                {industry} 분야
              </span>
              <span className="text-slate-300 text-sm">AI 종합 평가 결과</span>
            </div>
            <h2 className="text-3xl font-bold">사업성 평가 리포트</h2>
          </div>
          
          <div className="flex items-center gap-4 bg-white/10 p-4 rounded-xl backdrop-blur-sm" data-html2canvas-ignore>
            <button 
              onClick={handleDownloadPDF}
              disabled={isDownloading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-lg disabled:bg-blue-400 disabled:cursor-not-allowed"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  생성 중...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  PDF 다운로드
                </>
              )}
            </button>

            <div className="text-right border-l border-white/20 pl-4">
              <div className="text-xs text-slate-300 uppercase tracking-wider">Total Score</div>
              <div className={`text-4xl font-black ${result.totalScore >= 80 ? 'text-green-400' : result.totalScore >= 60 ? 'text-blue-400' : 'text-amber-400'}`}>
                {result.totalScore}
                <span className="text-lg text-slate-400 font-normal">/100</span>
              </div>
            </div>
          </div>
        </div>
        <div className="p-6 sm:p-8">
          <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-blue-600" />
            종합 요약 (Executive Summary)
          </h3>
          <p className="text-slate-600 leading-relaxed text-lg bg-slate-50 p-6 rounded-xl border border-slate-100">
            {result.summary}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 2. Radar Chart */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col items-center justify-center lg:col-span-1 min-h-[400px]">
          <h3 className="text-lg font-bold text-slate-800 mb-4 self-start flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            5차원 평가 차트
          </h3>
          <div className="w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 12 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar
                  name="Score"
                  dataKey="A"
                  stroke="#2563eb"
                  strokeWidth={3}
                  fill="#3b82f6"
                  fillOpacity={0.3}
                />
                <RechartsTooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-center text-slate-400 mt-2">
            * 각 항목은 산업별 가중치가 적용된 결과입니다.
          </p>
        </div>

        {/* 3. Detailed Dimensions */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 lg:col-span-2 space-y-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-blue-600" />
            항목별 상세 분석
          </h3>
          
          <div className="space-y-4">
            {result.dimensions.map((dim) => (
              <div key={dim.id} className="border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                <div className="bg-slate-50 px-5 py-4 flex items-center justify-between border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-800 text-lg">{dim.name}</span>
                    <span className="text-xs bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-500">
                      가중치 {dim.weight * 100}%
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-bold text-xl ${getScoreColor(dim.score)}`}>{dim.score}점</span>
                    <span className={getGradeBadge(dim.grade)}>{dim.grade}등급</span>
                  </div>
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex gap-3 items-start">
                    <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-bold text-slate-400 block mb-1">핵심 근거</span>
                      <p className="text-slate-700 text-sm leading-relaxed">{dim.reasoning}</p>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-bold text-slate-400 block mb-1">주요 개선점</span>
                      <p className="text-slate-700 text-sm leading-relaxed">{dim.improvements}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Expert Commentary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CommentaryCard 
          title="기술 전문가 시각" 
          icon={<Zap className="w-5 h-5" />} 
          content={result.expertCommentary.technical} 
          color="blue"
        />
        <CommentaryCard 
          title="시장 전략가 시각" 
          icon={<PieChart className="w-5 h-5" />} 
          content={result.expertCommentary.market} 
          color="indigo"
        />
        <CommentaryCard 
          title="재무 분석가 시각" 
          icon={<TrendingUp className="w-5 h-5" />} 
          content={result.expertCommentary.financial} 
          color="emerald"
        />
        <CommentaryCard 
          title="정책/규제 전문가 시각" 
          icon={<ShieldAlert className="w-5 h-5" />} 
          content={result.expertCommentary.policy} 
          color="slate"
        />
      </div>

      {/* 5. Recommendations */}
      <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl p-8 border border-blue-100">
        <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
          <CheckCircle className="w-6 h-6 text-blue-600" />
          최종 권고 사항 (Action Plan)
        </h3>
        <ul className="space-y-4">
          {result.recommendations.map((rec, idx) => (
            <li key={idx} className="flex gap-4 items-start bg-white p-4 rounded-xl shadow-sm border border-blue-100/50">
              <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">
                {idx + 1}
              </span>
              <p className="text-slate-700 font-medium">{rec}</p>
            </li>
          ))}
        </ul>
      </div>

      {/* Reset Button - Hidden in PDF */}
      <div className="flex justify-center pt-8" data-html2canvas-ignore>
        <button
          onClick={onReset}
          className="flex items-center gap-2 px-8 py-3 bg-white border border-slate-300 text-slate-600 rounded-full font-medium hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm"
        >
          <RefreshCw className="w-4 h-4" />
          다른 사업계획서 분석하기
        </button>
      </div>

    </div>
  );
}

function CommentaryCard({ title, icon, content, color }: any) {
  const colors: any = {
    blue: 'border-l-blue-500 text-blue-700 bg-blue-50/50',
    indigo: 'border-l-indigo-500 text-indigo-700 bg-indigo-50/50',
    emerald: 'border-l-emerald-500 text-emerald-700 bg-emerald-50/50',
    slate: 'border-l-slate-500 text-slate-700 bg-slate-50/50',
  };

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-100 p-6 border-l-4 ${colors[color].split(' ')[0]}`}>
      <div className={`flex items-center gap-2 font-bold mb-3 ${colors[color].split(' ')[1]}`}>
        {icon}
        {title}
      </div>
      <p className="text-slate-600 text-sm leading-relaxed">
        {content}
      </p>
    </div>
  );
}