export interface ReportGenerateResponse {
    reportId: string;
    highlights: string[];
    nextActions: string[];
    rawText: string;
    period?: {
        from: string;
        to: string;
        days: number;
    };
}
