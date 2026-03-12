/**
 * 평가 항목, 가중치, 업계별 룰셋 관리
 * 확장성: 평가 항목 수 변경, 가중치 조정, 업계별 기준 추가 가능
 */

export type IndustryType = 'AI/Data' | 'Blockchain/Fintech' | 'Bio/Healthcare' | 'Clean Energy' | 'Aerospace/Manufacturing' | 'Content/Media' | 'General/Other';

export interface EvaluationDimension {
  id: string;
  name: string;
  weight: number;
  description: string;
}

export interface IndustryRuleset {
  name: string;
  dimensions: EvaluationDimension[];
  scoringRubric: {
    S: string;
    A: string;
    B: string;
    C: string;
    D: string;
  };
  focusAreas: string[];
}

// ============================================================
// 기본 평가 차원 (5개 표준)
// 변경 방법: 아래 배열에 항목 추가/제거
// ============================================================
const STANDARD_DIMENSIONS: EvaluationDimension[] = [
  {
    id: 'tech',
    name: 'Technology & Innovation',
    weight: 0.3,
    description: 'Technical feasibility, innovation level, and competitive advantage'
  },
  {
    id: 'market',
    name: 'Market & Distribution',
    weight: 0.25,
    description: 'Market size, growth potential, and distribution channels'
  },
  {
    id: 'finance',
    name: 'Financial Health',
    weight: 0.2,
    description: 'Revenue model, profitability, and financial projections'
  },
  {
    id: 'biz',
    name: 'Business Model',
    weight: 0.15,
    description: 'Business model viability and scalability'
  },
  {
    id: 'risk',
    name: 'Risk Management',
    weight: 0.1,
    description: 'Risk mitigation and regulatory compliance'
  }
];

// ============================================================
// 기본 채점 기준 (모든 업계 공통)
// ============================================================
const DEFAULT_SCORING_RUBRIC = {
  S: 'Global innovation, verified patent, signed contracts > $1M',
  A: 'Clear differentiation, prototype ready, LOI secured',
  B: 'Standard solution, growing market, theoretical MVP',
  C: 'High competition, weak moat, unverified financials',
  D: 'Fatal flaw in logic, shrinking market, regulatory ban'
};

// ============================================================
// 업계별 커스터마이징된 평가 룰셋
// 새로운 업계 추가 시: 여기에 추가하기
// ============================================================
export const INDUSTRY_RULESETS: Record<IndustryType, IndustryRuleset> = {
  'AI/Data': {
    name: 'AI & Data',
    dimensions: [
      { ...STANDARD_DIMENSIONS[0], weight: 0.35 }, // Tech 가중치 높음
      { ...STANDARD_DIMENSIONS[1], weight: 0.25 },
      { ...STANDARD_DIMENSIONS[2], weight: 0.2 },
      { ...STANDARD_DIMENSIONS[3], weight: 0.1 },
      { ...STANDARD_DIMENSIONS[4], weight: 0.1 }
    ],
    scoringRubric: {
      S: 'Proprietary AI model, published research, enterprise partnerships, >$10M ARR',
      A: 'Working prototype, dataset advantage, technical moat, funding secured',
      B: 'ML-based solution, growing dataset, moderate competition',
      C: 'Basic analytics, commodity data, unclear differentiation',
      D: 'No technical moat, data quality issues, outdated algorithms'
    },
    focusAreas: ['Algorithm Innovation', 'Data Quality & Moat', 'Model Deployment', 'Scalability', 'Regulatory Compliance']
  },

  'Blockchain/Fintech': {
    name: 'Blockchain & Fintech',
    dimensions: [
      { ...STANDARD_DIMENSIONS[0], weight: 0.3 },
      { ...STANDARD_DIMENSIONS[1], weight: 0.25 },
      { ...STANDARD_DIMENSIONS[2], weight: 0.2 },
      { ...STANDARD_DIMENSIONS[3], weight: 0.15 },
      { ...STANDARD_DIMENSIONS[4], weight: 0.1 }
    ],
    scoringRubric: {
      S: 'Licensed fintech, decentralized protocol, institutional backing, compliance proven',
      A: 'Regulatory pathway clear, institutional interest, tokenomics sound',
      B: 'Compliant solution, growing user base, profit potential unclear',
      C: 'Regulatory uncertainty, limited adoption, weak use case',
      D: 'Regulatory ban imminent, security flaws, no clear value'
    },
    focusAreas: ['Regulatory Compliance', 'Security Audit', 'Liquidity Strategy', 'Smart Contract Audits', 'User Growth']
  },

  'Bio/Healthcare': {
    name: 'Bio & Healthcare',
    dimensions: [
      { ...STANDARD_DIMENSIONS[0], weight: 0.35 }, // Tech 높음
      { ...STANDARD_DIMENSIONS[1], weight: 0.2 },
      { ...STANDARD_DIMENSIONS[2], weight: 0.25 }, // Finance 높음
      { ...STANDARD_DIMENSIONS[3], weight: 0.1 },
      { ...STANDARD_DIMENSIONS[4], weight: 0.1 }
    ],
    scoringRubric: {
      S: 'Clinical validation, patent portfolio, FDA approval, multi-national trials',
      A: 'Phase 2/3 trials, strong IP, regulatory pathway clear',
      B: 'Preclinical data, IP filed, market need proven',
      C: 'Early research, patent uncertainty, clinical validation pending',
      D: 'Insufficient evidence, patent challenges, regulatory hurdles'
    },
    focusAreas: ['Clinical Efficacy', 'Patent Strength', 'Regulatory Pathway', 'Manufacturing Scale', 'Market Entry Timeline']
  },

  'Clean Energy': {
    name: 'Clean Energy',
    dimensions: [
      { ...STANDARD_DIMENSIONS[0], weight: 0.3 },
      { ...STANDARD_DIMENSIONS[1], weight: 0.25 },
      { ...STANDARD_DIMENSIONS[2], weight: 0.25 }, // Finance 높음
      { ...STANDARD_DIMENSIONS[3], weight: 0.1 },
      { ...STANDARD_DIMENSIONS[4], weight: 0.1 }
    ],
    scoringRubric: {
      S: 'Proven efficiency gains, government subsidies secured, pilot installed',
      A: 'Pilot results positive, subsidy eligible, cost competitive',
      B: 'Lab tested, subsidy potential, cost parity path clear',
      C: 'Promising theory, subsidy dependent, cost gap significant',
      D: 'Unproven technology, subsidy withdrawal risk, cost prohibitive'
    },
    focusAreas: ['Energy Efficiency', 'Cost Competitiveness', 'Government Incentives', 'Scalability', 'Environmental Impact']
  },

  'Aerospace/Manufacturing': {
    name: 'Aerospace & Manufacturing',
    dimensions: [
      { ...STANDARD_DIMENSIONS[0], weight: 0.3 },
      { ...STANDARD_DIMENSIONS[1], weight: 0.2 },
      { ...STANDARD_DIMENSIONS[2], weight: 0.25 },
      { ...STANDARD_DIMENSIONS[3], weight: 0.15 },
      { ...STANDARD_DIMENSIONS[4], weight: 0.1 }
    ],
    scoringRubric: {
      S: 'Major contract secured, production certified, supply chain established',
      A: 'Prototype validated, customer LOI obtained, manufacturing plan solid',
      B: 'Design complete, feasibility proven, scaling pathway clear',
      C: 'Design stage, small-scale production, scaling challenges',
      D: 'Prototype failures, manufacturing hurdles, scalability uncertain'
    },
    focusAreas: ['Production Readiness', 'Supply Chain', 'Quality Assurance', 'Contract Wins', 'Scaling Economics']
  },

  'Content/Media': {
    name: 'Content & Media',
    dimensions: [
      { ...STANDARD_DIMENSIONS[0], weight: 0.25 },
      { ...STANDARD_DIMENSIONS[1], weight: 0.3 }, // Market 높음
      { ...STANDARD_DIMENSIONS[2], weight: 0.2 },
      { ...STANDARD_DIMENSIONS[3], weight: 0.15 },
      { ...STANDARD_DIMENSIONS[4], weight: 0.1 }
    ],
    scoringRubric: {
      S: 'Viral content, major platform partnership, $1M+ revenue run-rate',
      A: 'Strong fan base, distribution deal, clear monetization path',
      B: 'Growing audience, multiple revenue streams, market traction',
      C: 'Niche audience, unstable revenue, limited distribution',
      D: 'Declining engagement, no revenue model, platform dependent'
    },
    focusAreas: ['Audience Growth', 'Monetization Strategy', 'Content Quality', 'Distribution Channels', 'Retention Metrics']
  },

  'General/Other': {
    name: 'General/Other',
    dimensions: STANDARD_DIMENSIONS,
    scoringRubric: DEFAULT_SCORING_RUBRIC,
    focusAreas: ['Team Capability', 'Market Opportunity', 'Execution Risk', 'Financial Sustainability', 'Competitive Advantage']
  }
};

// ============================================================
// 동적 프롬프트 생성 함수
// 사용법: generateSystemPrompt(industry, language, temperature)
// ============================================================
export function generateSystemPrompt(
  industry: IndustryType,
  selectedLangName: string,
  ruleset: IndustryRuleset
): string {
  const dimensionsList = ruleset.dimensions
    .map((dim, idx) => {
      return `
            { 
              "id": "${dim.id}", 
              "name": "${dim.name} (${Math.round(dim.weight * 100)}% - ${dim.description})",
              "score": 0-100, 
              "grade": "S/A/B/C/D", 
              "weight": ${dim.weight}, 
              "reasoning": "Rationale in ${selectedLangName}", 
              "improvements": "Action items in ${selectedLangName}" 
            }${idx < ruleset.dimensions.length - 1 ? ',' : ''}`;
    })
    .join('');

  const scoringDesc = Object.entries(ruleset.scoringRubric)
    .map(([grade, desc]) => `   - **${grade} (${grade === 'S' ? '90-100' : grade === 'A' ? '80-89' : grade === 'B' ? '70-79' : grade === 'C' ? '60-69' : '0-59'})**:     ${desc}.`)
    .join('\n');

  return `
    You are a Senior Consultant at a top-tier firm (McKinsey/BCG) specializing in ${industry}.
    Analyze the provided business plan based on "Business Feasibility Theory" and "Industry Evaluation Models".

    [CRITICAL INSTRUCTION]
    1. **CONSISTENCY**: You MUST act deterministically. The same input should yield the same scores.
    2. **LANGUAGE**: You MUST generate the entire JSON response content in **${selectedLangName}**.
    3. **INDUSTRY CONTEXT**: This is a ${industry} venture. Pay special attention to: ${ruleset.focusAreas.join(', ')}.
    4. **SCORING RUBRIC** (${industry}-specific):
${scoringDesc}

    [Output JSON Schema]
    Return ONLY valid JSON. No markdown.
    {
      "businessName": "Extracted Project Name",
      "summary": "Executive Summary in ${selectedLangName} (3-5 sentences)",
      "totalScore": 0-100 (CALCULATED: sum of all dimension scores weighted by their weights),
      "dimensions": [${dimensionsList}
      ],
      "expertCommentary": {
        "technical": "Tech Due Diligence in ${selectedLangName}",
        "market": "GTM Strategy in ${selectedLangName}",
        "financial": "Financial Outlook in ${selectedLangName}",
        "policy": "Regulation Check in ${selectedLangName}"
      },
      "recommendations": ["Strategy 1 in ${selectedLangName}", "Strategy 2 in ${selectedLangName}", "Strategy 3 in ${selectedLangName}"]
    }
  `;
}

// ============================================================
// 가중치 기반 totalScore 계산 함수
// 
// **계산 방식: 가중 평균 (Weighted Average)**
// 
// 예시 (표준 5개 차원):
//   기술(82) × 0.30 + 시장(85) × 0.25 + 재무(74) × 0.20 
//   + 사업모델(80) × 0.15 + 리스크(70) × 0.10
//   = 79.65 ≈ 79.7점
//
// 단순 평균 대비:
//   단순 평균: (82+85+74+80+70) ÷ 5 = 78.2점
//   가중 평균: (위 계산식) = 79.7점
//
// **왜 가중 평균을 사용하는가?**
// 1. 비즈니스 의사결정에서 모든 지표가 동등하지 않음
// 2. 기술(30%)이 시장(25%)보다 중요도가 높음
// 3. 리스크(10%)는 가중치가 낮으므로 영향력 제한
// 4. 업계별로 가중치 커스터마이징 가능 (AI/Data는 기술 35%)
// 5. McKinsey, BCG 등 컨설팅 회사에서 표준으로 사용하는 방식
//
// **가중치 정의:**
// - 각 차원의 weight는 0.0 ~ 1.0 범위
// - 모든 차원의 weight 합 = 1.0 (정규화됨)
// - INDUSTRY_RULESETS에서 업계별로 커스터마이징 가능
// ============================================================
export function calculateWeightedScore(
  dimensions: Array<{ score: number; weight: number }>
): number {
  const totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0);
  const weightedSum = dimensions.reduce((sum, d) => sum + (d.score * d.weight), 0);
  const weightedAverage = totalWeight > 0 ? weightedSum / totalWeight : 0;
  // 소수점 첫째 자리까지 반올림
  return Math.round(weightedAverage * 10) / 10;
}
