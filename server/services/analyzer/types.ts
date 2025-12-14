export type Severity = "safe" | "soft_breaking" | "hard_breaking";

export interface ChangeReason {
    severity: Severity;
    message: string;
    targetId: string; // variableId, blockId, etc.
    targetType: "variable" | "block" | "column" | "document" | "logic";
}

export interface ChangeImpactReport {
    severity: Severity;
    reasons: ChangeReason[];
    affectedSystems: {
        snapshots: boolean;
        documents: boolean;
        dataWrites: boolean;
        externalSends: boolean;
    }
}

export interface AnalyzerOptions {
    compareVariables?: boolean;
    compareBlocks?: boolean;
    compareLogic?: boolean;
}
