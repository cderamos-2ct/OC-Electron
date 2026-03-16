export type GraphxReviewDataMode = "run_057_seed";

export type GraphxConfidenceTone = "high" | "medium" | "low";

export type GraphxReviewDocument = {
  id: string;
  title: string;
  subtitle: string;
  fileName: string;
  vendor: string;
  receivedAt: string;
  pageLabel: string;
  note: string;
};

export type GraphxSourceHighlight = {
  id: string;
  label: string;
  page: number;
  quote: string;
  note: string;
  bounds: {
    topPct: number;
    leftPct: number;
    widthPct: number;
    heightPct: number;
  };
};

export type GraphxExtractedField = {
  id: string;
  label: string;
  value: string;
  confidence: number;
  confidenceLabel: string;
  confidenceTone: GraphxConfidenceTone;
  rationale: string;
  sourceQuote: string;
  sourceHighlightId: string;
};

export type GraphxReviewActionDescriptor = {
  key: "change_extraction";
  label: string;
  detail: string;
  enabled: boolean;
  reason?: string | null;
};

export type GraphxReviewSnapshot = {
  generatedAt: string;
  dataMode: GraphxReviewDataMode;
  warnings: string[];
  artifactPaths: string[];
  capabilities: {
    readOnly: boolean;
    canMutate: boolean;
    reason: string;
  };
  document: GraphxReviewDocument;
  selectedField: GraphxExtractedField;
  sourceHighlight: GraphxSourceHighlight;
  viewer: {
    modeLabel: string;
    detail: string;
  };
  changeExtractionAction: GraphxReviewActionDescriptor;
};
