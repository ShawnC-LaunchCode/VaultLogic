
import { externalDestinationService } from "../../services/ExternalDestinationService";
import type { ExternalSendBlockConfig } from "@shared/types/blocks";
import { logger } from "../../logger";

export interface ExternalSendResult {
    success: boolean;
    statusCode?: number;
    responseBody?: any;
    error?: string;
    simulated?: boolean;
}

export class ExternalSendRunner {

    /**
     * Execute or simulate an external send
     */
    async execute(
        config: ExternalSendBlockConfig,
        contextData: Record<string, any>,
        tenantId: string,
        mode: 'preview' | 'live' = 'live'
    ): Promise<ExternalSendResult> {

        // 1. Resolve Payload
        const payload: Record<string, any> = {};
        for (const mapping of config.payloadMappings) {
            const destField = mapping.key;
            const varName = mapping.value;

            // Simple variable resolution (supports 'step_id' or 'data.step_id')
            // For MVP, assume contextData keys match varName
            const value = (contextData as Record<string, any>)[varName];
            if (value !== undefined) {
                payload[destField] = value;
            } else {
                // Resolve simple dot notation if needed or leave undefined
                // For now, simple logic
            }
        }

        // 2. Fetch Destination Config
        const destination = await externalDestinationService.getDestination(config.destinationId, tenantId);
        if (!destination) {
            return { success: false, error: `Destination not found: ${config.destinationId}` };
        }

        const destConfig = destination.config as any; // { url, method, headers }

        // 3. Preview Mode: Simulate
        if (mode === 'preview') {
            logger.info({
                msg: "Simulating External Send",
                destination: destination.name,
                payload
            });
            return {
                success: true,
                simulated: true,
                responseBody: { message: "Simulated success", payload }
            };
        }

        // 4. Live Mode: Execute
        try {
            const response = await fetch(destConfig.url, {
                method: destConfig.method || 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(destConfig.headers || {})
                },
                body: JSON.stringify(payload)
            });

            const responseText = await response.text();
            let responseBody;
            try {
                responseBody = JSON.parse(responseText);
            } catch (e) {
                responseBody = responseText;
            }

            const success = response.ok;

            logger.info({
                msg: "External Send Completed",
                destination: destination.name,
                success,
                status: response.status
            });

            return {
                success,
                statusCode: response.status,
                responseBody
            };

        } catch (error) {
            logger.error({
                msg: "External Send Failed",
                destination: destination.name,
                error
            });
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown network error"
            };
        }
    }
}

export const externalSendRunner = new ExternalSendRunner();
