export interface AnalysisHistoryItem {
    analysisId: string;
    photoId: string;
    score: number;
    analyzedAt: string; // ISO date
    notes?: string;
}

export interface AnalysisHistoryResponse {
    items: AnalysisHistoryItem[];
}
