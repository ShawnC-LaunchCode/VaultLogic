import React from 'react';
import type { ApiStep } from '@/lib/vault-api';
import { LegacyStepBody } from './questions/LegacyStepBody';
import { DisplayCardEditor } from './cards/DisplayCardEditor';
import { TextCardEditor } from './cards/TextCardEditor';
import { BooleanCardEditor } from './cards/BooleanCardEditor';
import { ChoiceCardEditor } from './cards/ChoiceCardEditor';
import { NumberCardEditor } from './cards/NumberCardEditor';
import { AddressCardEditor } from './cards/AddressCardEditor';
import { EmailCardEditor } from './cards/EmailCardEditor';
import { PhoneCardEditor } from './cards/PhoneCardEditor';
import { WebsiteCardEditor } from './cards/WebsiteCardEditor';
import { ScaleCardEditor } from './cards/ScaleCardEditor';
import { MultiFieldCardEditor } from './cards/MultiFieldCardEditor';

export interface StepEditorCommonProps {
    stepId: string;
    sectionId: string;
    workflowId: string;
    step: ApiStep;
}

export function StepEditorRouter({ step, sectionId, workflowId }: { step: ApiStep; sectionId: string; workflowId: string }) {
    const commonProps: StepEditorCommonProps = {
        stepId: step.id,
        sectionId,
        workflowId,
        step,
    };

    // Display Steps
    if (step.type === 'display') {
        return <DisplayCardEditor {...commonProps} />;
    }

    // Text Steps
    if (step.type === 'short_text' || step.type === 'long_text' || step.type === 'text') {
        return <TextCardEditor {...commonProps} />;
    }

    // Boolean Steps
    if (step.type === 'yes_no' || step.type === 'true_false' || step.type === 'boolean') {
        return <BooleanCardEditor {...commonProps} />;
    }

    // Choice Steps
    if (step.type === 'radio' || step.type === 'multiple_choice' || step.type === 'choice') {
        return <ChoiceCardEditor {...commonProps} />;
    }

    // Number Steps
    if (step.type === 'number' || step.type === 'currency') {
        return <NumberCardEditor {...commonProps} />;
    }

    // Address Steps
    if (step.type === 'address') {
        return <AddressCardEditor {...commonProps} />;
    }

    // Email Steps
    if (step.type === 'email') {
        return <EmailCardEditor {...commonProps} />;
    }

    // Phone Steps
    if (step.type === 'phone') {
        return <PhoneCardEditor {...commonProps} />;
    }

    // Website/URL Steps
    if (step.type === 'website') {
        return <WebsiteCardEditor {...commonProps} />;
    }

    // Scale/Rating Steps
    if (step.type === 'scale') {
        return <ScaleCardEditor {...commonProps} />;
    }

    // Multi-Field Steps
    if (step.type === 'multi_field') {
        return <MultiFieldCardEditor {...commonProps} />;
    }

    // Phase 1: Route everything to LegacyStepBody
    // Phase 2: Incrementally add specialized editors here
    // Remaining Legacy Types: date_time, date, time, file_upload, js_question, signature, signature_block
    return <LegacyStepBody {...commonProps} />;
}
