export interface YesNoAggregation {
    yes: number;
    no: number;
}

export interface ChoiceAggregation {
    option: string;
    count: number;
    percent: number;
}

export interface TextAggregation {
    responseCount: number;
    topKeywords: { word: string; count: number }[];
}
