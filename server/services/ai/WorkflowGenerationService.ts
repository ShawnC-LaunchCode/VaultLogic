
import {
    AIGeneratedWorkflowSchema,
    AIWorkflowGenerationRequest,
    AIGeneratedWorkflow,
} from '../../../shared/types/ai';
import { createLogger } from '../../logger';
import { workflowQualityValidator } from '../WorkflowQualityValidator';
import { AIPromptBuilder } from './AIPromptBuilder';
import { AIProviderClient } from './AIProviderClient';
import {
    createAIError,
    normalizeWorkflowTypes,
    validateWorkflowStructure,
} from './AIServiceUtils';

const logger = createLogger({ module: 'workflow-generation-service' });

export class WorkflowGenerationService {
    constructor(
        private client: AIProviderClient,
        private promptBuilder: AIPromptBuilder,
    ) { }

    /**
     * Create a service instance with proper config
     */
    static create(client: AIProviderClient, promptBuilder?: AIPromptBuilder): WorkflowGenerationService {
        return new WorkflowGenerationService(client, promptBuilder || new AIPromptBuilder());
    }

    /**
     * Generate a new workflow from a natural language description
     */
    async generateWorkflow(
        request: AIWorkflowGenerationRequest,
    ): Promise<AIGeneratedWorkflow> {
        const startTime = Date.now();

        try {
            const prompt = this.promptBuilder.buildWorkflowGenerationPrompt(request);
            const response = await this.client.callLLM(prompt, 'workflow_generation');

            // Parse and validate the response
            const parsed = JSON.parse(response);
            const validated = AIGeneratedWorkflowSchema.parse(parsed);

            // Validate and Normalize workflow structure
            normalizeWorkflowTypes(validated);
            validateWorkflowStructure(validated);

            // Quality validation
            const qualityScore = workflowQualityValidator.validate(validated);

            const duration = Date.now() - startTime;
            logger.info({
                duration,
                sectionsCount: validated.sections.length,
                rulesCount: validated.logicRules.length,
                blocksCount: validated.transformBlocks.length,
                qualityScore: qualityScore.overall,
                qualityBreakdown: qualityScore.breakdown,
                qualityPassed: qualityScore.passed,
                issuesCount: qualityScore.issues.length,
            }, 'AI workflow generation succeeded');

            // Attach quality metadata to response (will be used by routes)
            (validated as any).__qualityScore = qualityScore;

            return validated;
        } catch (error: any) {
            const duration = Date.now() - startTime;
            logger.error({ error, duration }, 'AI workflow generation failed');

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
}

// Singleton export removed - services create their own instances via dependency injection
