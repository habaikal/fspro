import { LanguageCode } from './languages';

export interface EvaluationResult {
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

export const SAMPLE_EVALUATION_RESULTS: Record<string, EvaluationResult> = {
  ko: {
    businessName: "플랜스마트 AI (PlanSmart AI)",
    summary: "건축 도면의 법규 검토 및 최적 설계를 자동화하는 생성형 AI SaaS 플랫폼입니다. 기존 3~4주 소요되던 건축 인허가 사전 심의 과정을 1시간 이내로 단축하여 중소형 설계사무소 및 시행사의 초기 비용을 70% 이상 절감할 수 있는 높은 사업 타당성을 보유하고 있습니다.",
    totalScore: 84.5,
    dimensions: [
      {
        id: "tech",
        name: "기술성 (Technology)",
        score: 88,
        grade: "A",
        weight: 0.3,
        reasoning: "건축법규 RAG(검색증강생성) 엔진과 3D 도면 파싱 특허 기술이 결합되어 경쟁사 대비 높은 99.2% 법규 일치율을 확보함.",
        improvements: "지자체별 조례 업데이트 파이프라인의 자동화 및 대용량 CAD/BIM 데이터 처리 속도 고도화 필요."
      },
      {
        id: "market",
        name: "시장성 (Market Opportunity)",
        score: 85,
        grade: "A",
        weight: 0.25,
        reasoning: "국내 1.8만 개 건축사사무소 및 프롭테크 시장의 연평균 성장률(CAGR 24%)이 매우 가파르며, 아시아 신흥국 진출 가능성이 높음.",
        improvements: "중대형 건설사(시공능력 50위권 이내)와의 B2B 레퍼런스 조기 확보 및 파트너십 확장 전략 필요."
      },
      {
        id: "finance",
        name: "재무성 (Financial Viability)",
        score: 81,
        grade: "A",
        weight: 0.2,
        reasoning: "구독형(월 15만~120만원) SaaS 모델로 안정적인 MRR(월간 반복 매출) 확보가 가능하며, 손익분기점(BEP) 달성 예상 기간이 14개월로 양호함.",
        improvements: "대형 엔터프라이즈 전용 온프레미스/프라이빗 클라우드 요금제 신설을 통한 객단가(ARPU) 상향 필요."
      },
      {
        id: "biz",
        name: "사업모델 (Business Model)",
        score: 87,
        grade: "A",
        weight: 0.15,
        reasoning: "설계사무소, 감리업체, 감정평가법인을 아우르는 다면 플랫폼 네트워크 효과 구축 가능.",
        improvements: "인허가 대행 행정사 및 엔지니어링 전문가 매칭 마켓플레이스로의 BM 확장성 검토."
      },
      {
        id: "risk",
        name: "리스크 관리 (Risk & Feasibility)",
        score: 82,
        grade: "A",
        weight: 0.1,
        reasoning: "지자체별 복잡한 지구단위계획 및 인허가 담당 공무원의 재량 리스크가 존재하나, 면책 조항 및 시뮬레이션 기반 보완책 수립됨.",
        improvements: "인공지능 산출물에 대한 법률적 검증 자문단 구성 및 전문직 배상책임보험 도입 권장."
      }
    ],
    expertCommentary: {
      technical: "생성형 AI와 도면 비전 모델의 파이프라인 결합도가 우수하며, 한국 건축행정시스템(세움터) 연동 잠재력이 매우 높습니다.",
      market: "건설 경기 침체기일수록 원가 절감 솔루션에 대한 수요가 급증하므로 시기적으로 진입 적기입니다.",
      financial: "LTV/CAC 비율이 3.8배 이상으로 추정되어 마케팅 비용 집행 시 고속 스케일업이 가능한 구조입니다.",
      policy: "국토교통부의 스마트 건설 활성화 정책 및 BIM 의무화 로드맵과 완벽히 부합하여 정책 지원금 수혜가 유력합니다."
    },
    recommendations: [
      "초기 Top 10 시범 설계사무소 대상 3개월 무상 PoC를 진행하여 정량적 시간 절감 성공사례(Case Study) 리포트 발행",
      "대한건축사협회 및 지자체 건축사회와의 전략적 업무협약(MOU) 체결을 통한 보급 속도 가속화",
      "시리즈 A 투자 유치를 위한 핵심 지표(NRR 110%, 월간 잔존율 92%) 집중 관리"
    ],
    swot: {
      strengths: [
        "독자적인 건축법규 특화 지식 그래프(Knowledge Graph)",
        "기존 CAD 도면 포맷(DWG, DXF, IFC) 즉각 호환",
        "10년 이상 건축 실무진과 AI 엔지니어의 강력한 팀 시너지"
      ],
      weaknesses: [
        "지자체별 비정형 심의 기준 학습 데이터의 지속적 수작업 라벨링 비용",
        "보수적인 건축업계의 신규 소프트웨어 도입 저항감"
      ],
      opportunities: [
        "국토부 1,000억 원 규모 스마트 빌딩 R&D 예산 배정",
        "동남아(베트남, 인도네시아) 스마트시티 건설 붐으로 인한 해외 확장 기회"
      ],
      threats: [
        "Autodesk 등 글로벌 거대 CAD 벤더의 유사 생성형 기능 번들링 위협",
        "건축법 개정 지연으로 인한 신기술 인허가 인정 불확실성"
      ]
    },
    kpis: [
      "도면 검토 소요 시간: 14일 ➔ 45분 (96% 단축)",
      "첫해 유료 고객사(건축사사무소) 목표: 250개 사",
      "손익분기점(BEP) 월간 반복 매출: 8,500만 원 (런칭 후 14개월 차)",
      "법규 위반 사전 탐지율: 99.2%"
    ]
  },
  en: {
    businessName: "PlanSmart AI (Architectural Due-Diligence SaaS)",
    summary: "PlanSmart AI is a generative AI SaaS platform automating building code compliance audits and structural feasibility designs. By reducing the preliminary permit review cycle from 3-4 weeks to under an hour, it delivers over 70% cost savings for architectural studios and real estate developers.",
    totalScore: 84.5,
    dimensions: [
      {
        id: "tech",
        name: "Technology",
        score: 88,
        grade: "A",
        weight: 0.3,
        reasoning: "Proprietary building code RAG paired with a 3D geometry parsing engine yields a 99.2% regulatory validation accuracy.",
        improvements: "Automate municipal zoning update pipelines and optimize high-throughput CAD/BIM processing."
      },
      {
        id: "market",
        name: "Market Opportunity",
        score: 85,
        grade: "A",
        weight: 0.25,
        reasoning: "Global PropTech market is expanding at a 24% CAGR, with severe enterprise demand for automated zoning validation.",
        improvements: "Secure enterprise design firm references early and establish partnerships with commercial general contractors."
      },
      {
        id: "finance",
        name: "Financial Viability",
        score: 81,
        grade: "A",
        weight: 0.2,
        reasoning: "Tiered subscription model creates predictable MRR with a projected 14-month path to operational break-even.",
        improvements: "Introduce dedicated enterprise private cloud deployments to elevate Average Revenue Per Unit (ARPU)."
      },
      {
        id: "biz",
        name: "Business Model",
        score: 87,
        grade: "A",
        weight: 0.15,
        reasoning: "Dual network effects linking architecture studios, civil inspectors, and institutional developers.",
        improvements: "Evaluate expansion into specialized marketplace services connecting certified engineering consultants."
      },
      {
        id: "risk",
        name: "Risk & Feasibility",
        score: 82,
        grade: "A",
        weight: 0.1,
        reasoning: "Municipal code variability presents local ambiguity, mitigated by explicit simulation caveats and automated updates.",
        improvements: "Form a legal advisory panel for regulatory validation and adopt specialized errors & omissions coverage."
      }
    ],
    expertCommentary: {
      technical: "High technical cohesion between computer vision parsing and legislative LLMs, showing enterprise-grade reliability.",
      market: "In real estate down-cycles, cost-saving compliance automation experiences counter-cyclical surges in adoption.",
      financial: "Projected LTV/CAC ratio exceeds 3.8x, enabling rapid venture scale upon proven product-market fit.",
      policy: "Strong alignment with governmental smart infrastructure and digital twin regulatory mandates."
    },
    recommendations: [
      "Run 3-month paid pilot programs with 10 design practices to generate quantifiable ROI case studies.",
      "Partner with national architectural institutes for curriculum and accreditation endorsements.",
      "Track Net Revenue Retention (NRR > 110%) and monthly gross churn (< 1.5%) toward Series A milestones."
    ],
    swot: {
      strengths: [
        "Proprietary legislative knowledge graph",
        "Direct compatibility with DWG, DXF, and IFC CAD standards",
        "Experienced team combining veteran architects and deep learning researchers"
      ],
      weaknesses: [
        "Continuous human-in-the-loop validation overhead for local district variances",
        "Conservative tech adoption lifecycle in construction and design"
      ],
      opportunities: [
        "National digitization grants for construction industry modernization",
        "High-margin expansion into Southeast Asian smart city construction hubs"
      ],
      threats: [
        "Legacy CAD conglomerates integrating native AI feature add-ons",
        "Unforeseen regulatory delays in automated permit recognition"
      ]
    },
    kpis: [
      "Zoning verification cycle: 14 days ➔ 45 minutes (96% acceleration)",
      "Year-1 target active design practices: 250 enterprise teams",
      "Break-even Monthly Recurring Revenue: $65,000 / month",
      "Regulatory discrepancy discovery rate: 99.2%"
    ]
  }
};

export function getSampleEvaluation(lang: LanguageCode): EvaluationResult {
  return SAMPLE_EVALUATION_RESULTS[lang] || SAMPLE_EVALUATION_RESULTS['en'];
}
