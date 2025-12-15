import { datavaultRowsRepository, datavaultColumnsRepository, datavaultTablesRepository } from "../../repositories";
import { getValueByPath } from "@shared/conditionEvaluator";
import type { WriteBlockConfig, WriteResult, ColumnMapping, BlockContext } from "@shared/types/blocks";
import { createLogger } from "../../logger";

const logger = createLogger({ module: "write-runner" });

export class WriteRunner {
    /**
     * Execute a write operation
     */
    async executeWrite(
        config: WriteBlockConfig,
        context: BlockContext,
        tenantId: string,
        isPreview: boolean = false
    ): Promise<WriteResult> {
        logger.info({
            operation: "write_start",
            mode: config.mode,
            tableId: config.tableId,
            preview: isPreview
        }, "Starting write execution");

        try {
            // 1. Resolve Values (Variables & Expressions)
            // This happens BEFORE preview check so we validate logic even in preview
            const mappedValues = this.resolveValues(config.columnMappings, context.data);

            // 2. Resolve match strategy (for update and upsert modes)
            let matchColumnId: string | undefined;
            let matchValue: any = undefined;

            if (config.mode === "update" || config.mode === "upsert") {
                // Support new matchStrategy or legacy primaryKey fields
                if (config.matchStrategy) {
                    if (config.matchStrategy.type === "column_match") {
                        if (!config.matchStrategy.columnId) {
                            throw new Error("Match strategy column_match requires columnId");
                        }
                        matchColumnId = config.matchStrategy.columnId;
                        matchValue = this.resolveSingleValue(config.matchStrategy.columnValue, context.data);
                    } else if (config.matchStrategy.type === "primary_key") {
                        // For primary_key type, we need to determine the actual PK column
                        // This would require fetching table metadata
                        // For now, assume matchStrategy.columnId is provided
                        if (!config.matchStrategy.columnId) {
                            throw new Error("Match strategy primary_key requires columnId");
                        }
                        matchColumnId = config.matchStrategy.columnId;
                        matchValue = this.resolveSingleValue(config.matchStrategy.columnValue, context.data);
                    }
                } else if (config.primaryKeyColumnId && config.primaryKeyValue) {
                    // Legacy support
                    matchColumnId = config.primaryKeyColumnId;
                    matchValue = this.resolveSingleValue(config.primaryKeyValue, context.data);
                } else {
                    throw new Error(`${config.mode} mode requires matchStrategy or primaryKeyColumnId/primaryKeyValue`);
                }

                if (matchValue === undefined || matchValue === null) {
                    if (config.mode === "update") {
                        throw new Error("Match value is null/undefined for update mode");
                    }
                    // For upsert, null match value means create new
                }
            }

            // 3. Preview Safety Check
            if (isPreview) {
                logger.info({
                    operation: "write_preview_simulated",
                    values: mappedValues,
                    matchColumnId,
                    matchValue
                }, "Simulating write in preview mode");

                return {
                    success: true,
                    tableId: config.tableId,
                    rowId: "preview-simulated-id",
                    writtenColumnIds: Object.keys(mappedValues),
                    operation: config.mode,
                    writtenData: mappedValues
                };
            }

            // 4. Execute Real Write
            let resultRowId: string;
            let actualOperation: "create" | "update" | "upsert" = config.mode;

            if (config.mode === "create") {
                resultRowId = await this.executeCreate(config.tableId, mappedValues, tenantId);
            } else if (config.mode === "update") {
                resultRowId = await this.executeUpdate(config.tableId, matchColumnId!, matchValue, mappedValues, tenantId);
            } else if (config.mode === "upsert") {
                // Upsert: try to find existing row, update if found, create if not
                const result = await this.executeUpsert(config.tableId, matchColumnId!, matchValue, mappedValues, tenantId);
                resultRowId = result.rowId;
                actualOperation = result.operation as "create" | "update" | "upsert";
            } else {
                throw new Error(`Unknown write mode: ${config.mode}`);
            }

            return {
                success: true,
                tableId: config.tableId,
                rowId: resultRowId,
                writtenColumnIds: Object.keys(mappedValues),
                operation: actualOperation,
                writtenData: mappedValues
            };

        } catch (error) {
            logger.error({ error, config }, "Write execution failed");
            return {
                success: false,
                tableId: config.tableId,
                writtenColumnIds: [],
                operation: config.mode,
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }

    /**
     * Resolve column mappings to actual values using context data
     */
    private resolveValues(mappings: ColumnMapping[], data: Record<string, any>): Record<string, any> {
        const result: Record<string, any> = {};
        for (const mapping of mappings) {
            // TODO: Enhanced expression support. For now, try simple var resolution or static.
            // If value starts with {{ }} it might be handle bars, but here simpler dot notation access is implied
            // or we assume the value field IS the path if it matches a variable pattern.
            // For now, let's treat `value` as a path if it looks like one, or static.
            // Ideally we need the Tokenizer/Evaluator here if we want complex expressions.
            // Using `getValueByPath` which covers `step.var` access.

            const resolved = this.resolveSingleValue(mapping.value, data);
            result[mapping.columnId] = resolved;
        }
        return result;
    }

    private resolveSingleValue(expression: string | undefined, data: Record<string, any>): any {
        if (!expression) return null;

        // Simple heuristic: if it contains dots or looks like a var, try resolving
        // Actually strictly speaking, `getValueByPath` returns undefined if not found, 
        // but maybe we want to treat it as a literal string if not found?
        // For safety/strictness in "Write Blocks", explicit variable binding is frequent.
        // Let's rely on getValueByPath. If it returns undefined, check if it's meant to be a literal?
        // The prompt says "Expression" - usually implies {{ }}. 
        // Let's strip {{ }} if present.

        let path = expression;
        if (path.startsWith("{{") && path.endsWith("}}")) {
            path = path.slice(2, -2).trim();
        }

        const val = getValueByPath(data, path);
        // If val is defined, return it.
        if (val !== undefined) return val;

        // If strictly undefined, maybe it was a valid path that is empty?
        // Or maybe it is a static string? 
        // For now, return the expression as is if resolution fails, assuming static?
        // Safer to defaults to null if it looked like a variable.

        if (expression.includes("{{")) return null; // Failed var resolution
        return expression; // Static string
    }


    /**
     * Execute Create Operation
     */
    private async executeCreate(
        tableId: string,
        values: Record<string, any>, // key = columnId
        tenantId: string
    ): Promise<string> {
        // Transform map {colId: val} into array [{columnId, value}]
        const valueList = Object.entries(values).map(([columnId, value]) => ({
            columnId,
            value
        }));

        // We need a generic "insert row" method. DatavaultRowsRepository.createRowWithValues
        // requires InsertDatavaultRow struct.
        const rowData = {
            tableId,
            tenantId, // Ensure tenant isolation
            // metadata like createdBy could come from context if we had it
        };

        const result = await datavaultRowsRepository.createRowWithValues(rowData, valueList);
        return result.row.id;
    }

    /**
     * Execute Update Operation
     */
    private async executeUpdate(
        tableId: string,
        pkColumnId: string,
        pkValue: any,
        values: Record<string, any>,
        tenantId: string
    ): Promise<string> {
        // 1. Find the row ID based on the "Primary Key" logical concept (Column Value = pkValue)
        // Datavault doesn't strictly enforce one PK, but we treat `pkColumnId` as the lookup key.

        // We need a method to find row by (ColumnId, Value). 
        // datavaultRowsRepository.findByTableId has sort/filter, but maybe generic filter?
        // We can use a direct query or helper.

        // TODO: Implement findRowByColumnValue in repository or here.
        // For now assuming we have a way.
        const rowId = await this.findRowIdByColumnValue(tableId, pkColumnId, pkValue, tenantId);

        if (!rowId) {
            throw new Error(`Row not found for Table ${tableId} where Column ${pkColumnId} = ${pkValue}`);
        }

        const valueList = Object.entries(values).map(([columnId, value]) => ({
            columnId,
            value
        }));

        await datavaultRowsRepository.updateRowValues(rowId, valueList);
        return rowId;
    }

    private async findRowIdByColumnValue(
        tableId: string,
        columnId: string,
        value: any,
        tenantId: string
    ): Promise<string | null> {
        return await datavaultRowsRepository.findRowByColumnValue(tableId, columnId, value, tenantId);
    }

    /**
     * Execute Upsert Operation
     * Try to find existing row by match column, update if found, create if not
     */
    private async executeUpsert(
        tableId: string,
        matchColumnId: string,
        matchValue: any,
        values: Record<string, any>,
        tenantId: string
    ): Promise<{ rowId: string; operation: "create" | "update" }> {
        // If matchValue is null/undefined, create new row
        if (matchValue === undefined || matchValue === null) {
            logger.info({ tableId, matchColumnId }, "Upsert: match value is null, creating new row");
            const rowId = await this.executeCreate(tableId, values, tenantId);
            return { rowId, operation: "create" };
        }

        // Try to find existing row
        const existingRowId = await this.findRowIdByColumnValue(tableId, matchColumnId, matchValue, tenantId);

        if (existingRowId) {
            // Row exists, update it
            logger.info({ tableId, matchColumnId, matchValue, existingRowId }, "Upsert: found existing row, updating");
            const valueList = Object.entries(values).map(([columnId, value]) => ({
                columnId,
                value
            }));
            await datavaultRowsRepository.updateRowValues(existingRowId, valueList);
            return { rowId: existingRowId, operation: "update" };
        } else {
            // Row doesn't exist, create new
            logger.info({ tableId, matchColumnId, matchValue }, "Upsert: row not found, creating new");
            const rowId = await this.executeCreate(tableId, values, tenantId);
            return { rowId, operation: "create" };
        }
    }
}

export const writeRunner = new WriteRunner();
