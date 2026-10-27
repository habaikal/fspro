import React, { useState, useRef, useEffect } from 'react';
import {
  CheckCircle, AlertCircle, TrendingUp, Zap, Loader2,
  Briefcase, File as FileIcon, RefreshCw, Download,
  Bookmark, Layers, Globe, ChevronDown, Printer, Upload,
  Key, Eye, EyeOff, X, ExternalLink, Sparkles, Copy,
  MessageSquare, Bot
} from 'lucide-react';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer
} from 'recharts';
import { LANGUAGES, TRANSLATIONS, LanguageCode } from './config/languages';
import { getSampleEvaluation } from './config/sampleData';

/**
 * GEMINI API CONFIGURATION
 * API Key is managed in App state & localStorage
 */

// --- Types & Interfaces ---

type IndustryType = 'AI/Data' | 'Blockchain/Fintech' | 'Bio/Healthcare' | 'Clean Energy' | 'Aerospace/Manufacturing' | 'Content/Media' | 'Civil/Construction' | 'General/Other';

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
  swot?: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
  kpis?: string[];
}

// --- Main Application Component ---

export default function App() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('fspro_gemini_key') || '');
  const [tempApiKey, setTempApiKey] = useState(() => localStorage.getItem('fspro_gemini_key') || '');
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [temperature, setTemperature] = useState<number>(0.0);
  const [selectedIndustry, setSelectedIndustry] = useState<IndustryType>('General/Other');
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [file, setFile] = useState<File | null>(null);
  const [textInput, setTextInput] = useState<string>('');
  const [inputType, setInputType] = useState<'file' | 'text'>('file');
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysisMode, setAnalysisMode] = useState<'api' | 'web'>('api');
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

      // Dynamic Prompt based on Language
      const selectedLangName = LANGUAGES.find(l => l.code === language)?.name || 'English';

      const systemPrompt = `
        You are a Senior Consultant at a top-tier firm (McKinsey/BCG) specializing in ${selectedIndustry}.
        Analyze the provided business plan based on "Business Feasibility Theory" and "Industry Evaluation Models".

        [CRITICAL INSTRUCTION]
        1. **CONSISTENCY**: You MUST act deterministically. The same input should yield the same scores.
        2. **LANGUAGE**: You MUST generate the entire JSON response content in **${selectedLangName}**.
        3. **SCORING RUBRIC**:
           - **S (90-100)**: Global innovation, verified patent, signed contracts > $1M.
           - **A (80-89)**: Clear differentiation, prototype ready, LOI secured.
           - **B (70-79)**: Standard solution, growing market, theoretical MVP.
           - **C (60-69)**: High competition, weak moat, unverified financials.
           - **D (0-59)**: Fatal flaw in logic, shrinking market, regulatory ban.

        [Output JSON Schema]
        Return ONLY valid JSON. No markdown.
        {
          "businessName": "Extracted Project Name",
          "summary": "Executive Summary in ${selectedLangName} (3-5 sentences)",
          "totalScore": 0-100 (Integer, Calculated based on weights),
          "dimensions": [
            { 
              "id": "tech", "name": "Translated Name of 'Technology' in ${selectedLangName}", "score": 0-100, "grade": "S/A/B/C/D", "weight": 0.3, 
              "reasoning": "Rationale in ${selectedLangName}", "improvements": "Action items in ${selectedLangName}" 
            },
            { "id": "market", "name": "Translated Name of 'Market' in ${selectedLangName}", "score": 0-100, "grade": "S/A/B/C/D", "weight": 0.25, "reasoning": "...", "improvements": "..." },
            { "id": "finance", "name": "Translated Name of 'Finance' in ${selectedLangName}", "score": 0-100, "grade": "S/A/B/C/D", "weight": 0.2, "reasoning": "...", "improvements": "..." },
            { "id": "biz", "name": "Translated Name of 'Biz Model' in ${selectedLangName}", "score": 0-100, "grade": "S/A/B/C/D", "weight": 0.15, "reasoning": "...", "improvements": "..." },
            { "id": "risk", "name": "Translated Name of 'Risk' in ${selectedLangName}", "score": 0-100, "grade": "S/A/B/C/D", "weight": 0.1, "reasoning": "...", "improvements": "..." }
          ],
          "expertCommentary": {
            "technical": "Tech Due Diligence in ${selectedLangName}",
            "market": "GTM Strategy in ${selectedLangName}",
            "financial": "Financial Outlook in ${selectedLangName}",
            "policy": "Regulation Check in ${selectedLangName}"
          },
          "recommendations": ["Strategy 1 in ${selectedLangName}", "Strategy 2 in ${selectedLangName}", "Strategy 3 in ${selectedLangName}"],
          "swot": {
            "strengths": ["Strength 1 in ${selectedLangName}"],
            "weaknesses": ["Weakness 1 in ${selectedLangName}"],
            "opportunities": ["Opportunity 1 in ${selectedLangName}"],
            "threats": ["Threat 1 in ${selectedLangName}"]
          },
          "kpis": ["KPI 1 in ${selectedLangName}", "KPI 2 in ${selectedLangName}"]
        }
      `;

      const response = await callGeminiAPI(systemPrompt, contentPart);
      const jsonText = response.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedResult = JSON.parse(jsonText);

      // Force mathematically accurate average score to prevent LLM hallucination in totalScore
      if (parsedResult.dimensions && Array.isArray(parsedResult.dimensions) && parsedResult.dimensions.length > 0) {
        const sum = parsedResult.dimensions.reduce((acc: number, curr: any) => acc + (Number(curr.score) || 0), 0);
        const avg = sum / parsedResult.dimensions.length;
        parsedResult.totalScore = Number.isInteger(avg) ? avg : parseFloat(avg.toFixed(1));
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

  // 체험용 샘플 리포트 즉시 로드 (원클릭 체험)
  const handleLoadSampleReport = () => {
    const sample = getSampleEvaluation(language);
    setResult(sample);
    setStep(3);
    setError(null);
  };

  // 외부 AI(Gemini 웹, ChatGPT, Claude 등)의 답변 텍스트에서 JSON 추출 및 파싱
  const handleVisualizeWebAiResult = (rawText: string) => {
    if (!rawText.trim()) {
      setError(language === 'ko' ? "AI 챗봇의 분석 답변 내용을 붙여넣어주세요." : "Please paste the AI response content.");
      return;
    }
    try {
      let jsonStr = '';
      const codeBlockMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch && codeBlockMatch[1]) {
        jsonStr = codeBlockMatch[1].trim();
      } else {
        const firstBrace = rawText.indexOf('{');
        const lastBrace = rawText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          jsonStr = rawText.substring(firstBrace, lastBrace + 1);
        } else {
          jsonStr = rawText.trim();
        }
      }

      const parsed = JSON.parse(jsonStr);

      if (!parsed.dimensions || !Array.isArray(parsed.dimensions) || parsed.dimensions.length === 0) {
        throw new Error(
          language === 'ko'
            ? "분석 결과에서 5대 지표(dimensions)를 찾을 수 없습니다. AI가 생성한 전체 JSON을 그대로 붙여넣어주세요."
            : "Could not find valid 'dimensions' in the parsed JSON. Please paste the full AI output."
        );
      }

      // 산술 평균 기반 종합 점수 보정
      const sum = parsed.dimensions.reduce((acc: number, curr: any) => acc + (Number(curr.score) || 0), 0);
      const avg = sum / parsed.dimensions.length;
      parsed.totalScore = Number.isInteger(avg) ? avg : parseFloat(avg.toFixed(1));

      setResult(parsed);
      setStep(3);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(
        language === 'ko'
          ? `결과 파싱 오류: 올바른 JSON 형식이 아닙니다. (${err.message})\n\n💡 팁: AI 챗봇이 생성한 답변 전체를 그대로 복사해 붙여넣으시거나, 아래 [체험용 샘플 데이터 불러오기]를 시도해보세요.`
          : `Parse Error: Invalid JSON structure (${err.message}).\n\n💡 Tip: Please paste the full response from AI or click 'Load Sample Demo'.`
      );
    }
  };

  // 외부 AI 챗봇에 전달할 정밀 분석 프롬프트 생성
  const buildAnalysisPrompt = async (): Promise<string> => {
    let planText = textInput.trim();
    if (inputType === 'file' && file) {
      if (file.type === 'text/plain' || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
        planText = await fileToText(file);
      } else {
        planText = `[첨부 파일명: ${file.name}] (PDF 파일인 경우 텍스트를 복사하거나 PDF 내용을 요약하여 입력해주세요)`;
      }
    }

    const selectedLangName = LANGUAGES.find(l => l.code === language)?.name || 'Korean';

    return `당신은 ${selectedIndustry} 분야 전문 글로벌 전략 컨설팅 펌(McKinsey/BCG)의 수석 파트너입니다.
아래 제공된 사업계획서(또는 사업 아이디어)를 "사업 타당성 분석 이론" 및 "업종별 정량 평가 모델"에 입각하여 매우 객관적이고 날카롭게 심층 실사(Due Diligence)해주세요.

[사업계획서 내용]
${planText || "(구체적인 사업 아이템 및 계획서 요약)"}

[핵심 지침]
1. 언어: 모든 분석 내용, 설명, 개선 방안은 반드시 **${selectedLangName}**로 작성해야 합니다.
2. 채점 기준:
   - S (90-100점): 글로벌 혁신성, 검증된 특허/매출, 강력한 해자
   - A (80-89점): 명확한 차별성, 프로토타입 완료, 가시적인 시장 기회
   - B (70-79점): 일반적인 솔루션, 성장 시장, 가설 검증 단계
   - C (60-69점): 과밀 경쟁, 약한 진입장벽, 미검증 재무 모델
   - D (0-59점): 논리적 결함, 축소 시장, 규제 리스크
3. 출력 형식: 다른 서두나 사족 없이, **반드시 아래 JSON 스키마 그대로 유효한 JSON 형식으로만** 응답해주세요.

\`\`\`json
{
  "businessName": "추출 또는 제안된 사업명",
  "summary": "경영진 요약 보고서 (3~5문장)",
  "totalScore": 85,
  "dimensions": [
    {
      "id": "tech",
      "name": "기술성 (Technology)",
      "score": 88,
      "grade": "A",
      "weight": 0.3,
      "reasoning": "기술적 차별성과 실현 가능성에 대한 객관적 평가",
      "improvements": "기술 경쟁력 확보를 위한 구체적 실행 액션"
    },
    {
      "id": "market",
      "name": "시장성 (Market Opportunity)",
      "score": 85,
      "grade": "A",
      "weight": 0.25,
      "reasoning": "목표 시장 규모 및 성장성 평가",
      "improvements": "시장 점유율 확대를 위한 GTM 제언"
    },
    {
      "id": "finance",
      "name": "재무성 (Financial Viability)",
      "score": 80,
      "grade": "A",
      "weight": 0.2,
      "reasoning": "수익성, 마진 구조, 손익분기점(BEP) 달성 가능성",
      "improvements": "현금흐름 및 수익성 개선 방안"
    },
    {
      "id": "biz",
      "name": "사업모델 (Business Model)",
      "score": 86,
      "grade": "A",
      "weight": 0.15,
      "reasoning": "비즈니스 모델의 지속 가능성 및 락인(Lock-in) 효과",
      "improvements": "BM 다각화 및 객단가 상향 제언"
    },
    {
      "id": "risk",
      "name": "리스크 관리 (Risk & Feasibility)",
      "score": 82,
      "grade": "A",
      "weight": 0.1,
      "reasoning": "법적/규제, 인허가, 기술 대체 리스크 평가",
      "improvements": "선제적 리스크 헤징 방안"
    }
  ],
  "expertCommentary": {
    "technical": "기술 실사(Tech DD) 전문 의견",
    "market": "시장 진입 전략 전문 의견",
    "financial": "재무 전망 및 밸류에이션 의견",
    "policy": "규제 및 정책 지원 연계 의견"
  },
  "recommendations": [
    "핵심 권고 전략 1",
    "핵심 권고 전략 2",
    "핵심 권고 전략 3"
  ],
  "swot": {
    "strengths": ["강점 1", "강점 2"],
    "weaknesses": ["약점 1", "약점 2"],
    "opportunities": ["기회 1", "기회 2"],
    "threats": ["위협 1", "위협 2"]
  },
  "kpis": [
    "핵심 성과 지표 1",
    "핵심 성과 지표 2",
    "핵심 성과 지표 3"
  ]
}
\`\`\``;
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
    const cleanApiKey = apiKey.trim();
    if (!cleanApiKey) {
      throw new Error(
        language === 'ko'
          ? 'Gemini API Key가 설정되지 않았습니다. API Key를 입력해주세요.'
          : 'Gemini API Key is not set. Please enter a valid API Key.'
      );
    }

    // Google AI Studio에서 가장 안정적이고 널리 지원되는 표준 모델 순서로 배치
    const candidateModels = [
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-2.5-flash',
      'gemini-3.1-pro-preview'
    ];

    let lastErrorMessage = '';

    for (let i = 0; i < candidateModels.length; i++) {
      const model = candidateModels[i];
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cleanApiKey)}`,
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
          let errorDetails = response.statusText || '';
          try {
            const errorData = await response.json();
            if (errorData?.error?.message) {
              errorDetails = errorData.error.message;
            }
          } catch {
            // JSON 파싱 실패 시 기본 응답 유지
          }

          const lowerMsg = (errorDetails || '').toLowerCase();

          // 만약 API 키 자체가 유효하지 않은 경우 (오타 등)
          if (
            lowerMsg.includes('api key not valid') ||
            lowerMsg.includes('invalid api_key') ||
            lowerMsg.includes('key not valid') ||
            (response.status === 400 && lowerMsg.includes('key'))
          ) {
            throw new Error(
              language === 'ko'
                ? `입력하신 Gemini API Key가 유효하지 않습니다. 올바른 키인지 확인해주세요. (상세: ${errorDetails})`
                : `The Gemini API Key is invalid. Please check and re-enter your key. (Details: ${errorDetails})`
            );
          }

          // 다음 후보 모델이 남아있다면, 모델별 권한(403), 미지원(404), 인자 오류(400) 등에 대해 다음 모델로 자동 시도!
          if (i < candidateModels.length - 1) {
            console.warn(`[FS Pro] Model ${model} failed (HTTP ${response.status}: ${errorDetails}). Retrying with next model: ${candidateModels[i + 1]}...`);
            lastErrorMessage = `[${model}] HTTP ${response.status}: ${errorDetails}`;
            continue;
          }

          // 모든 모델이 실패했을 때 에러 메시지 구성
          let userFriendlyMsg = errorDetails ? `API Error (${response.status}): ${errorDetails}` : `API Error (${response.status})`;

          if (response.status === 402 || lowerMsg.includes('prepayment') || lowerMsg.includes('depleted')) {
            userFriendlyMsg = language === 'ko'
              ? `[Google AI Studio 선불 크레딧 소진 (HTTP 402)]\n현재 연결된 구글 프로젝트의 선불 잔액이 $0입니다.\n\n💡 해결 방법 (완전 무료 이용 팁):\nGoogle AI Studio(aistudio.google.com)에서 'Create API key in new project(새 프로젝트에 키 생성)'를 선택하여 결제가 연결되지 않은 '무료 티어(Free Tier)' 키를 새로 발급받으시면 무료로 즉시 분석을 이용하실 수 있습니다!`
              : `[Google Prepayment Depleted (HTTP 402)]\nYour project's prepaid wallet is empty ($0).\n\n💡 How to resolve (Free Tier tip):\nGo to Google AI Studio (aistudio.google.com) and create an API Key with 'Create API key in new project' without billing attached to use the 100% Free Tier!`;
          } else if (response.status === 403) {
            userFriendlyMsg = language === 'ko'
              ? `API 접근 권한 오류 (HTTP 403): ${errorDetails}. Google AI Studio(aistudio.google.com)에서 새로 발급받은 Gemini API 키인지 확인해주세요.`
              : `API Access Forbidden (HTTP 403): ${errorDetails}. Please ensure your API key from Google AI Studio is active.`;
          } else if (response.status === 429 || lowerMsg.includes('quota') || lowerMsg.includes('resource_exhausted')) {
            userFriendlyMsg = language === 'ko'
              ? `API 호출 사용량(Quota)을 초과했습니다. 잠시 후 다시 시도하거나 다른 API Key를 입력해주세요. (${errorDetails})`
              : `API rate limit / quota exceeded. Please try again later or use another API Key. (${errorDetails})`;
          }

          throw new Error(userFriendlyMsg);
        }

        const data = await response.json();
        if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
          throw new Error(language === 'ko' ? 'AI 모델의 응답 데이터가 비어있습니다.' : 'Empty response from AI model.');
        }

        return data.candidates[0].content.parts[0].text;
      } catch (err: any) {
        // 명시적 API 키 오류인 경우 즉시 던짐
        if (err.message && (err.message.includes('유효하지 않습니다') || err.message.includes('The Gemini API Key is invalid'))) {
          throw err;
        }

        // 마지막 모델이 아니라면 다음 모델 시도
        if (i < candidateModels.length - 1) {
          console.warn(`[FS Pro] Error calling ${model}: ${err.message}. Retrying fallback...`);
          lastErrorMessage = err.message;
          continue;
        }

        throw err;
      }
    }

    throw new Error(lastErrorMessage || (language === 'ko' ? '모든 AI 모델 호출에 실패했습니다.' : 'All AI model attempts failed.'));
  };

  const t = TRANSLATIONS[language];

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 print:bg-white">
      {/* App Navigation Bar */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50 shadow-lg print:hidden">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div
            onClick={handleReset}
            className="flex items-center gap-3 cursor-pointer select-none group"
            title={language === 'ko' ? '홈으로 이동 (초기화)' : 'Go to Home (Reset)'}
          >
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-inner group-hover:scale-105 transition-transform">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-wide group-hover:text-indigo-200 transition-colors">
              {t.app_name} <span className="text-indigo-400 font-light">{t.app_sub}</span>
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:block text-xs font-medium text-slate-400 uppercase tracking-widest">
              {t.app_desc}
            </div>

            {/* API Key Manager Button */}
            <button
              onClick={() => {
                setTempApiKey(apiKey);
                setIsApiKeyModalOpen(true);
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm border bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700 hover:border-slate-600 transition-all duration-200 shadow-sm"
              title={t.api_key_settings}
            >
              <Key className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline font-medium">{t.api_key_settings}</span>
              {apiKey ? (
                <span className="text-[11px] font-mono bg-slate-900/80 text-emerald-400 px-1.5 py-0.5 rounded border border-slate-700">
                  {apiKey.slice(0, 4)}...{apiKey.slice(-4)}
                </span>
              ) : (
                <span className="text-[11px] font-mono bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30">
                  Not Set
                </span>
              )}
            </button>

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
        {!apiKey && analysisMode !== 'web' && (
          <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center animate-in fade-in zoom-in duration-300 space-y-6">
            <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-indigo-700 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-indigo-200">
              <Zap className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Welcome to FS Pro</h2>
              <p className="text-sm text-slate-500 mt-1">
                {language === 'ko' ? '초정밀 사업 타당성 평가 솔루션' : 'Strategic Feasibility Study Intelligence'}
              </p>
            </div>

            <div className="space-y-4 text-left pt-2">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-indigo-600" />
                  Gemini API Key
                </label>
                <input
                  type="password"
                  value={tempApiKey}
                  onChange={(e) => setTempApiKey(e.target.value)}
                  placeholder="AIzaSy... (Gemini API Key)"
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (tempApiKey.trim().length > 10) {
                      const key = tempApiKey.trim();
                      setApiKey(key);
                      localStorage.setItem('fspro_gemini_key', key);
                      setError(null);
                    } else {
                      alert(t.api_key_invalid);
                    }
                  }}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 text-sm shadow hover:shadow-md cursor-pointer"
                >
                  <span>{language === 'ko' ? 'API Key로 자동 분석 시작' : 'Start with API Key'}</span>
                  <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
                </button>
              </div>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-3 font-bold text-slate-400">{language === 'ko' ? '또는 (API 키가 없으신가요?)' : 'OR (NO API KEY)'}</span></div>
              </div>

              {/* No Key Web AI Mode Button */}
              <button
                type="button"
                onClick={() => {
                  setAnalysisMode('web');
                  setError(null);
                }}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2.5 text-sm shadow-md hover:shadow-lg active:scale-95 cursor-pointer border border-slate-800"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>{language === 'ko' ? 'API Key 없이 무료로 시작하기 (Gemini/ChatGPT 연동)' : 'Start Free without API Key (Web AI Mode)'}</span>
              </button>

              {/* Demo Sample Report Button */}
              <button
                type="button"
                onClick={handleLoadSampleReport}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 text-xs cursor-pointer border border-slate-200"
              >
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                <span>{language === 'ko' ? '체험용 샘플 리포트 바로보기 (클릭 1초)' : 'Preview Sample Report Demo'}</span>
              </button>

              <p className="text-[11px] text-center text-slate-400 pt-2">
                Get a free key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline font-semibold">Google AI Studio</a>.
              </p>
            </div>
          </div>
        )}

        {(Boolean(apiKey) || analysisMode === 'web') && step === 1 && (
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
            onOpenKeyModal={() => setIsApiKeyModalOpen(true)}
            onReset={handleReset}
            onSaveKey={(newKey: string) => {
              setApiKey(newKey);
              setTempApiKey(newKey);
              localStorage.setItem('fspro_gemini_key', newKey);
              setError(null);
            }}
            analysisMode={analysisMode}
            setAnalysisMode={setAnalysisMode}
            onBuildPrompt={buildAnalysisPrompt}
            onVisualizeWebResult={handleVisualizeWebAiResult}
            onLoadSample={handleLoadSampleReport}
            language={language}
          />
        )}

        {step === 2 && (
          <AnalyzingSection industry={selectedIndustry} t={t} />
        )}

        {step === 3 && result && (
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

      {/* API Key Configuration Modal */}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        currentKey={apiKey}
        onSave={(newKey) => {
          setApiKey(newKey);
          setTempApiKey(newKey);
          localStorage.setItem('fspro_gemini_key', newKey);
          setError(null);
        }}
        onClear={() => {
          setApiKey('');
          setTempApiKey('');
          localStorage.removeItem('fspro_gemini_key');
          setError(null);
        }}
        t={t}
        language={language}
      />

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
  temperature, setTemperature, onOpenKeyModal, onReset, onSaveKey,
  analysisMode, setAnalysisMode, onBuildPrompt, onVisualizeWebResult, onLoadSample,
  language
}: any) {
  const [inlineKey, setInlineKey] = useState('');
  const [showInlineKey, setShowInlineKey] = useState(false);
  const [inlineError, setInlineError] = useState('');
  const [keySuccessMsg, setKeySuccessMsg] = useState('');

  // Web AI Mode local states
  const [webPromptCopied, setWebPromptCopied] = useState(false);
  const [webAiResponseText, setWebAiResponseText] = useState('');
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);

  const handleApplyInlineKey = () => {
    const trimmed = inlineKey.trim();
    if (trimmed.length > 10) {
      onSaveKey(trimmed);
      setInlineKey('');
      setInlineError('');
      setKeySuccessMsg('새 Gemini API Key가 성공적으로 등록되었습니다!');
      setTimeout(() => setKeySuccessMsg(''), 6000);
    } else {
      setInlineError(t.api_key_invalid);
    }
  };

  const handleCopyPrompt = async () => {
    setIsGeneratingPrompt(true);
    try {
      const prompt = await onBuildPrompt();
      await navigator.clipboard.writeText(prompt);
      setWebPromptCopied(true);
      setTimeout(() => setWebPromptCopied(false), 5000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const industries: IndustryType[] = [
    'AI/Data', 'Blockchain/Fintech', 'Bio/Healthcare',
    'Clean Energy', 'Aerospace/Manufacturing', 'Content/Media', 'Civil/Construction', 'General/Other'
  ];

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
        {/* Dual Mode Switcher Tab */}
        <div className="flex border-b border-slate-200 bg-slate-100/70 p-2 gap-2">
          <button
            type="button"
            onClick={() => setAnalysisMode('api')}
            className={`flex-1 py-3 px-4 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              analysisMode === 'api'
                ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Zap className="w-4 h-4 text-amber-500" />
            <span>{t.mode_api || '실시간 API 자동 분석'}</span>
          </button>
          <button
            type="button"
            onClick={() => setAnalysisMode('web')}
            className={`flex-1 py-3 px-4 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              analysisMode === 'web'
                ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>{t.mode_web || '웹 AI 연동 (API 키 불필요)'}</span>
            <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] bg-emerald-100 text-emerald-800 rounded-full font-extrabold uppercase">
              100% Free
            </span>
          </button>
        </div>

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

          {/* Key Applied Success Banner */}
          {keySuccessMsg && (
            <div className="mt-6 p-4 bg-emerald-50 text-emerald-800 rounded-2xl border-2 border-emerald-200 shadow-md flex items-center justify-between animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-600 shrink-0 font-bold">
                  ✓
                </div>
                <div>
                  <p className="text-sm font-bold text-emerald-900">{keySuccessMsg}</p>
                  <p className="text-xs text-emerald-700">이제 아래의 [전문가 분석 리포트 생성] 버튼을 누르면 새 키로 분석이 시작됩니다.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setKeySuccessMsg('')}
                className="text-xs text-emerald-600 hover:text-emerald-800 p-1 font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {error && (
            <div className="mt-6 p-5 sm:p-6 bg-rose-50 text-rose-800 rounded-3xl border-2 border-rose-200 shadow-md space-y-4 animate-in fade-in slide-in-from-top-2">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center shrink-0 text-rose-600 mt-0.5 shadow-sm">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-rose-900 text-base">API Error</span>
                      <span className="text-[11px] font-semibold bg-rose-200/80 text-rose-800 px-2 py-0.5 rounded-full">
                        {t.api_key_settings}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-rose-700 leading-relaxed break-words font-medium whitespace-pre-line">
                      {error}
                    </p>
                  </div>
                </div>

                {/* Action Buttons: Return to Home (Reset) & Re-enter Key */}
                <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                  <button
                    type="button"
                    onClick={onReset}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
                    title={t.btn_go_home}
                  >
                    <RefreshCw className="w-4 h-4 text-slate-500" />
                    <span>{t.btn_go_home}</span>
                  </button>
                  <button
                    type="button"
                    onClick={onOpenKeyModal}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                  >
                    <Key className="w-4 h-4" />
                    <span>{t.api_key_reenter}</span>
                  </button>
                </div>
              </div>

              {/* 402 Prepayment Dedicated Guidance Box */}
              {(error.includes('402') || error.includes('prepayment') || error.includes('선불')) && (
                <div className="p-4 bg-amber-50/90 border border-amber-300 rounded-2xl text-amber-950 space-y-2 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900 text-sm">
                    <span>💡 왜 새로 발급받은 키도 여전히 402 오류가 날까요?</span>
                  </div>
                  <p className="leading-relaxed text-amber-900">
                    Google AI Studio에서 키를 발급받을 때 <strong>기존 결제(Google Cloud) 프로젝트</strong>를 선택했기 때문입니다. 선불 충전 잔액이 $0이라서 새 키를 발급해도 프로젝트 단위로 차단됩니다.
                  </p>
                  <div className="p-3 bg-white/80 rounded-xl border border-amber-200 space-y-1.5 font-sans">
                    <p className="font-bold text-slate-900">✅ 100% 무료 티어로 즉시 해결하는 방법 (30초 소요):</p>
                    <ol className="list-decimal list-inside space-y-1 text-slate-700 leading-relaxed">
                      <li>아래 버튼을 눌러 Google AI Studio 키 발급 페이지로 이동합니다.</li>
                      <li><strong>[Create API key]</strong> 버튼을 누른 후, 반드시 <strong>&quot;Create API key in new project (새 프로젝트에서 만들기)&quot;</strong>를 선택하세요! (기존 프로젝트 선택 ❌)</li>
                      <li>새로 발급된 키를 복사하여 아래 입력창에 넣고 <strong>[적용하기]</strong>를 클릭하세요.</li>
                    </ol>
                  </div>
                  <div className="pt-1">
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
                    >
                      <span>Google AI Studio에서 &quot;새 프로젝트&quot; 무료 API Key 발급받기</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              )}

              {/* Switch to Web Mode Suggestion Banner */}
              <div className="p-3.5 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm font-bold">
                    <Sparkles className="w-4 h-4 text-amber-300" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">
                      {language === 'ko' ? 'API 키 발급/쿼터 오류로 번거로우신가요?' : 'Encountering API Key or Quota issues?'}
                    </p>
                    <p className="text-[11px] text-slate-600">
                      {language === 'ko' ? 'API Key 없이도 무료 웹 챗봇(Gemini 웹, ChatGPT)으로 100% 무료 무제한 분석이 가능합니다!' : 'Analyze 100% free with external web chatbots without an API Key!'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAnalysisMode('web')}
                  className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>{t.btn_switch_to_web || '웹 AI 무료 모드로 전환 ➔'}</span>
                </button>
              </div>

              {/* Inline Direct Key Input Form */}
              <div className="pt-3 border-t border-rose-200/80 bg-white/90 p-4 rounded-2xl border border-rose-100 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-indigo-600" />
                    {t.api_key_inline_title}
                  </label>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {t.api_key_desc}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1 flex items-center">
                    <input
                      type={showInlineKey ? 'text' : 'password'}
                      value={inlineKey}
                      onChange={(e) => {
                        setInlineKey(e.target.value);
                        if (inlineError) setInlineError('');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleApplyInlineKey();
                        }
                      }}
                      placeholder="AIzaSy... (새로 발급받은 Gemini API Key 붙여넣기)"
                      className="w-full px-4 py-2.5 pr-10 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-inner"
                    />
                    <button
                      type="button"
                      onClick={() => setShowInlineKey(!showInlineKey)}
                      className="absolute right-3 text-slate-400 hover:text-slate-600 p-1"
                      title={showInlineKey ? 'Hide Key' : 'Show Key'}
                    >
                      {showInlineKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyInlineKey}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow hover:shadow-md active:scale-95 shrink-0 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>{t.api_key_apply}</span>
                  </button>
                </div>
                {inlineError && (
                  <p className="text-xs text-rose-600 font-semibold">{inlineError}</p>
                )}
              </div>
            </div>
          )}

          {/* Conditional Workflow based on analysisMode */}
          {analysisMode === 'api' ? (
            <div>
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
                className="w-full mt-8 py-5 bg-slate-900 text-white rounded-xl font-bold text-lg hover:bg-slate-800 transition-all active:scale-[0.99] shadow-xl flex items-center justify-center gap-3 group cursor-pointer"
              >
                <Zap className="w-5 h-5 text-yellow-400 group-hover:animate-pulse" />
                {t.btn_analyze}
              </button>
            </div>
          ) : (
            /* Web AI No-Key Mode 3-Step Section */
            <div className="mt-8 pt-8 border-t border-slate-100 space-y-6">
              <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white p-6 rounded-2xl shadow-lg space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <h3 className="font-bold text-base sm:text-lg">
                    {language === 'ko' ? '웹 AI 무료 분석 가이드 (API Key 불필요)' : 'Free Web AI Mode (No API Key Needed)'}
                  </h3>
                  <span className="ml-auto px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-xs font-bold">
                    100% Free
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {language === 'ko'
                    ? 'API 키 발급이나 결제 설정 없이, 평소 사용하시는 무료 웹 AI(Google Gemini, ChatGPT, Claude 등)를 이용해 즉시 리포트를 생성할 수 있습니다.'
                    : 'No API keys or billing needed. Leverage free web chatbots (Gemini, ChatGPT, Claude) to generate reports immediately.'}
                </p>
              </div>

              {/* Step 1: Copy Prompt */}
              <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">1</span>
                    {t.web_step_1 || '1. 분석 프롬프트 복사하기'}
                  </span>
                  {webPromptCopied && (
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 animate-in fade-in">
                      ✓ 복사 완료! 아래 AI 사이트에 붙여넣으세요
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600">
                  {language === 'ko'
                    ? '위에서 선택하신 산업 분야와 입력된 사업계획서가 포함된 전문 컨설팅 실사 프롬프트를 복사합니다.'
                    : 'Copies the McKinsey-grade Due Diligence prompt containing your business plan details.'}
                </p>
                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  disabled={isGeneratingPrompt}
                  className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-all shadow hover:shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Copy className="w-4 h-4" />
                  <span>{webPromptCopied ? (t.btn_prompt_copied || '복사 완료!') : (t.btn_copy_prompt || '분석 프롬프트 복사하기')}</span>
                </button>
              </div>

              {/* Step 2: Open AI Chatbot */}
              <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <span className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">2</span>
                  {t.web_step_2 || '2. 평소 쓰는 무료 AI 웹사이트 열기'}
                </span>
                <p className="text-xs text-slate-600">
                  {language === 'ko'
                    ? '아래 버튼 중 원하시는 AI 챗봇을 클릭한 뒤, 채팅창에 복사한 프롬프트를 [Ctrl + V]로 붙여넣고 전송하세요.'
                    : 'Click any AI chatbot below and paste [Ctrl + V] the copied prompt into the chat.'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <a
                    href="https://gemini.google.com/app"
                    target="_blank"
                    rel="noreferrer"
                    className="p-3 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-slate-800 transition-all shadow-sm group"
                  >
                    <Sparkles className="w-4 h-4 text-blue-500 group-hover:scale-110 transition-transform" />
                    <span>Google Gemini (무료 추천)</span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  </a>
                  <a
                    href="https://chatgpt.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="p-3 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-slate-800 transition-all shadow-sm group"
                  >
                    <Bot className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
                    <span>ChatGPT (무료)</span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  </a>
                  <a
                    href="https://claude.ai/"
                    target="_blank"
                    rel="noreferrer"
                    className="p-3 bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-300 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-slate-800 transition-all shadow-sm group"
                  >
                    <MessageSquare className="w-4 h-4 text-amber-600 group-hover:scale-110 transition-transform" />
                    <span>Claude (무료)</span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  </a>
                </div>
              </div>

              {/* Step 3: Paste Result & Visualize */}
              <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">3</span>
                    {t.web_step_3 || '3. AI 답변 붙여넣기 및 리포트 생성'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const sample = getSampleEvaluation(language);
                      setWebAiResponseText(JSON.stringify(sample, null, 2));
                    }}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer"
                  >
                    {t.btn_load_sample || '💡 체험용 샘플 데이터 채우기'}
                  </button>
                </div>
                <textarea
                  value={webAiResponseText}
                  onChange={(e) => setWebAiResponseText(e.target.value)}
                  placeholder={
                    language === 'ko'
                      ? "AI 챗봇이 답변한 내용(JSON 또는 전체 텍스트)을 여기에 그대로 [Ctrl + V]로 붙여넣으세요..."
                      : "Paste the AI's response (including the JSON) here..."
                  }
                  className="w-full h-44 p-4 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-xs text-slate-800 leading-relaxed outline-none transition-all shadow-inner resize-y"
                />

                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => onVisualizeWebResult(webAiResponseText)}
                    className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-base rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-[0.99] flex items-center justify-center gap-2.5 cursor-pointer"
                  >
                    <Sparkles className="w-5 h-5 text-amber-300" />
                    <span>{t.btn_visualize_report || '분석 리포트 시각화하기 🚀'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={onLoadSample}
                    className="px-5 py-4 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs sm:text-sm rounded-xl transition-all active:scale-[0.99] cursor-pointer shrink-0"
                  >
                    <span>{language === 'ko' ? '샘플 즉시 체험' : 'Instant Demo'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
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

        {/* 5. SWOT Analysis & KPIs */}
        <div className="mb-12 print:break-inside-avoid">
          <h3 className="text-lg font-bold text-slate-900 mb-6 border-b border-slate-200 pb-2 font-serif">
            SWOT Analysis & Key Performance Indicators (KPIs)
          </h3>
          
          {/* SWOT Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-emerald-50/70 border border-emerald-200 p-5 rounded-xl transition-all hover:shadow-md">
              <h4 className="text-emerald-800 font-bold mb-3 flex items-center gap-2">S - Strengths (강점)</h4>
              <ul className="list-disc pl-5 text-sm text-emerald-900 space-y-1">
                {result.swot?.strengths.map((s, i) => <li key={i}>{s}</li>) || <li>N/A</li>}
              </ul>
            </div>
            <div className="bg-rose-50/70 border border-rose-200 p-5 rounded-xl transition-all hover:shadow-md">
              <h4 className="text-rose-800 font-bold mb-3 flex items-center gap-2">W - Weaknesses (약점)</h4>
              <ul className="list-disc pl-5 text-sm text-rose-900 space-y-1">
                {result.swot?.weaknesses.map((w, i) => <li key={i}>{w}</li>) || <li>N/A</li>}
              </ul>
            </div>
            <div className="bg-blue-50/70 border border-blue-200 p-5 rounded-xl transition-all hover:shadow-md">
              <h4 className="text-blue-800 font-bold mb-3 flex items-center gap-2">O - Opportunities (기회)</h4>
              <ul className="list-disc pl-5 text-sm text-blue-900 space-y-1">
                {result.swot?.opportunities.map((o, i) => <li key={i}>{o}</li>) || <li>N/A</li>}
              </ul>
            </div>
            <div className="bg-amber-50/70 border border-amber-200 p-5 rounded-xl transition-all hover:shadow-md">
              <h4 className="text-amber-800 font-bold mb-3 flex items-center gap-2">T - Threats (위협)</h4>
              <ul className="list-disc pl-5 text-sm text-amber-900 space-y-1">
                {result.swot?.threats.map((th, i) => <li key={i}>{th}</li>) || <li>N/A</li>}
              </ul>
            </div>
          </div>

          {/* KPIs Section */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl text-white shadow-lg">
            <h4 className="text-indigo-300 font-bold mb-4 text-sm tracking-widest uppercase flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-400" /> Suggested Actionable KPIs
            </h4>
            <div className="flex flex-wrap gap-2">
              {result.kpis?.map((kpi, idx) => (
                <span key={idx} className="bg-slate-800 border border-slate-700 text-slate-200 px-4 py-2 rounded-lg text-xs font-bold shadow-inner">
                  {kpi}
                </span>
              )) || <span className="text-slate-500 text-sm">No KPIs generated.</span>}
            </div>
          </div>
        </div>

        {/* 6. Strategic Recommendations (Roadmap Style) */}
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

// --- API Key Management Modal Component ---
interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentKey: string;
  onSave: (key: string) => void;
  onClear: () => void;
  t: any;
  language: LanguageCode;
}

function ApiKeyModal({
  isOpen,
  onClose,
  currentKey,
  onSave,
  onClear,
  t,
  language
}: ApiKeyModalProps) {
  const [inputKey, setInputKey] = useState(currentKey);
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    setInputKey(currentKey);
    setValidationError('');
    setShowPassword(false);
  }, [isOpen, currentKey]);

  // ESC 키로 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSave = () => {
    const trimmed = inputKey.trim();
    if (trimmed.length < 10) {
      setValidationError(t.api_key_invalid);
      return;
    }
    onSave(trimmed);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Key className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight">{t.api_key_title}</h3>
              <p className="text-[11px] text-slate-400 font-mono">Google AI Studio (Gemini API)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-800"
            title={t.api_key_close}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          <p className="text-sm text-slate-600 leading-relaxed">
            {t.api_key_desc}
          </p>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span>Gemini API Key</span>
              {currentKey && (
                <span className="text-[11px] font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-normal lowercase">
                  ✓ {language === 'ko' ? '저장됨' : 'saved'}
                </span>
              )}
            </label>
            <div className="relative flex items-center">
              <input
                type={showPassword ? 'text' : 'password'}
                value={inputKey}
                onChange={(e) => {
                  setInputKey(e.target.value);
                  if (validationError) setValidationError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                }}
                placeholder="AIzaSy..."
                className="w-full px-4 py-3 pr-12 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm outline-none transition-all shadow-inner"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-slate-400 hover:text-slate-600 p-1.5 rounded-md hover:bg-slate-100 transition-colors"
                title={showPassword ? 'Hide Key' : 'Show Key'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {validationError && (
              <p className="text-xs text-rose-600 font-medium animate-in fade-in slide-in-from-top-1">
                {validationError}
              </p>
            )}
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between text-xs text-slate-600">
            <span>{language === 'ko' ? 'API 키가 필요하신가요?' : 'Need a Gemini API Key?'}</span>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1 hover:underline"
            >
              <span>Google AI Studio</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          {currentKey ? (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(language === 'ko' ? '저장된 API Key를 삭제하시겠습니까?' : 'Are you sure you want to remove the API key?')) {
                  onClear();
                  onClose();
                }
              }}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline px-2 py-1"
            >
              {t.api_key_clear}
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              {t.api_key_close}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <Key className="w-3.5 h-3.5" />
              <span>{t.api_key_save}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}