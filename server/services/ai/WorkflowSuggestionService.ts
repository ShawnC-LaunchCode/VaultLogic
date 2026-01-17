
import {
    AIWorkflowSuggestionSchema,
    AITemplateBindingsResponseSchema,
    AIWorkflowSuggestionRequest,
    AIWorkflowSuggestion,
    AITemplateBindingsRequest,
    AITemplateBindingsResponse,
} from '../../../shared/types/ai';
import { createLogger } from '../../logger';
import { AIPromptBuilder } from './AIPromptBuilder';
import { AIProviderClient } from './AIProviderClient';
import { createAIError } from './AIServiceUtils';

const logger = createLogger({ module: 'workflow-suggestion-service' });

export class WorkflowSuggestionService {
    constructor(
        private client: AIProviderClient,
        private promptBuilder: AIPromptBuilder,
    ) { }

    /**
     * Suggest improvements to an existing workflow
     */
    async suggestWorkflowImprovements(
        request: AIWorkflowSuggestionRequest,
        existingWorkflow: {
            sections: any[];
            logicRules?: any[];
            transformBlocks?: any[];
        },
    ): Promise<AIWorkflowSuggestion> {
        const startTime = Date.now();

        try {
            const prompt = this.promptBuilder.buildWorkflowSuggestionPrompt(
                request,
                existingWorkflow,
            );
            const response = await this.client.callLLM(prompt, 'workflow_suggestion');

            const parsed = JSON.parse(response);
            const validated = AIWorkflowSuggestionSchema.parse(parsed);

            const duration = Date.now() - startTime;
            logger.info(
                {
                    duration,
                    newSectionsCount: validated.newSections.length,
                    newRulesCount: validated.newLogicRules.length,
                    newBlocksCount: validated.newTransformBlocks.length,
                    modificationsCount: validated.modifications.length,
                },
                'AI workflow suggestion succeeded',
            );

            return validated;
        } catch (error: any) {
            const duration = Date.now() - startTime;
            logger.error({ error, duration }, 'AI workflow suggestion failed');

            if (error instanceof SyntaxError) {
                throw createAIError(
                    'Failed to parse AI response as JSON',
                    'INVALID_RESPONSE',
                    { originalError: error.message },
                );
            }

            if (error.name === 'ZodError') {
                throw createAIError(
                    'AI response does not match expected schema',
                    'VALIDATION_ERROR',
                    { originalError: error },
                );
            }

            throw error;
        }
    }

    /**
     * Suggest template variable bindings
     */
    async suggestTemplateBindings(
        request: AITemplateBindingsRequest,
        variables: Array<{ alias: string; label: string; type: string }>,
        placeholders: string[],
    ): Promise<AITemplateBindingsResponse> {
        const startTime = Date.now();

        try {
            const prompt = this.promptBuilder.buildBindingSuggestionPrompt(
                variables,
                placeholders,
            );
            const response = await this.client.callLLM(prompt, 'binding_suggestion');

            const parsed = JSON.parse(response);
            const validated = AITemplateBindingsResponseSchema.parse(parsed);

            const duration = Date.now() - startTime;
            logger.info(
                {
                    duration,
                    suggestionsCount: validated.suggestions.length,
                },
                'AI binding suggestion succeeded',
            );

            return validated;
        } catch (error: any) {
            const duration = Date.now() - startTime;
            logger.error({ error, duration }, 'AI binding suggestion failed');

            if (error instanceof SyntaxError) {
                throw createAIError(
                    'Failed to parse AI response as JSON',
                    'INVALID_RESPONSE',
                    { originalError: error.message },
                );
            }

            if (error.name === 'ZodError') {
                throw createAIError(
                    'AI response does not match expected schema',
                    'VALIDATION_ERROR',
                    { originalError: error },
                );
            }

            throw error;
        }
    }

    /**
     * Suggest random plausible values for workflow steps
     * Used for testing and preview data generation
     */
    async suggestValues(
        steps: Array<{
            key: string;
            type: string;
            label?: string;
            options?: string[];
            description?: string;
        }>,
        mode: 'full' | 'partial' = 'full',
    ): Promise<Record<string, any>> {
        const startTime = Date.now();

        try {
            const prompt = this.promptBuilder.buildValueSuggestionPrompt(steps, mode);
            const response = await this.client.callLLM(prompt, 'value_suggestion');

            // Parse and return the response
            const parsed = JSON.parse(response);

            const duration = Date.now() - startTime;
            logger.info(
                {
                    duration,
                    stepCount: steps.length,
                    mode,
                },
                'AI value suggestion succeeded',
            );

            return parsed.values || parsed;
        } catch (error: any) {
            const duration = Date.now() - startTime;
            logger.error({ error, duration }, 'AI value suggestion failed');

            if (error instanceof SyntaxError) {
                throw createAIError(
                    'Failed to parse AI response as JSON',
                    'INVALID_RESPONSE',
                    { originalError: error.message },
                );
            }

            throw error;
        }
    }
}

// Singleton export removed - services create their own instances via dependency injection
