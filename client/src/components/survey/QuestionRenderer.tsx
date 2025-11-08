import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { FileUpload } from "@/components/ui/file-upload";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface LoopGroupSubquestion {
  id: string;
  type: string;
  title: string;
  description?: string | null;
  required: boolean | null;
  options?: string[] | unknown;
}

interface QuestionRendererProps {
  question: {
    id: string;
    type: string;
    title: string;
    description?: string;
    required: boolean;
    options?: Array<string | {text: string; value: string}>;
    loopConfig?: {
      minIterations: number;
      maxIterations: number;
      addButtonText?: string;
      removeButtonText?: string;
      allowReorder?: boolean;
    };
    // fileUploadConfig is now stored in options for file_upload questions
    subquestions?: LoopGroupSubquestion[];
  };
  value?: any;
  onChange: (value: any) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  answerId?: string; // For file uploads
}

export default function QuestionRenderer({ question, value, onChange, onFocus, onBlur, answerId }: QuestionRendererProps) {
  
  // Initialize loop instances if needed
  const initializeLoopInstances = () => {
    if (question.type === 'loop_group' && (!value || !Array.isArray(value))) {
      const minIterations = question.loopConfig?.minIterations || 1;
      const initialInstances = Array.from({ length: minIterations }, (_, index) => ({
        instanceIndex: index,
        answers: {}
      }));
      onChange(initialInstances);
      return initialInstances;
    }
    return value || [];
  };

  // Handle loop instance value changes
  const handleLoopInstanceChange = (instanceIndex: number, subquestionId: string, value: any) => {
    const instances = initializeLoopInstances();
    const updatedInstances = instances.map((instance: any) => {
      if (instance.instanceIndex === instanceIndex) {
        return {
          ...instance,
          answers: {
            ...instance.answers,
            [subquestionId]: value
          }
        };
      }
      return instance;
    });
    onChange(updatedInstances);
  };

  // Add new loop instance
  const addLoopInstance = () => {
    const instances = initializeLoopInstances();
    const maxIterations = question.loopConfig?.maxIterations || 5;
    
    if (instances.length < maxIterations) {
      const newInstance = {
        instanceIndex: instances.length,
        answers: {}
      };
      onChange([...instances, newInstance]);
    }
  };

  // Remove loop instance
  const removeLoopInstance = (instanceIndex: number) => {
    const instances = initializeLoopInstances();
    const minIterations = question.loopConfig?.minIterations || 1;
    
    if (instances.length > minIterations) {
      const updatedInstances = instances
        .filter((instance: any) => instance.instanceIndex !== instanceIndex)
        .map((instance: any, index: number) => ({
          ...instance,
          instanceIndex: index
        }));
      onChange(updatedInstances);
    }
  };

  const handleFileUpload = (files: any[]) => {
    onChange(files);
  };

  const handleMultipleChoice = (option: any, checked: boolean) => {
    const optionValue = typeof option === 'object' && option.value ? option.value : option;
    const currentValues = Array.isArray(value) ? value : [];
    if (checked) {
      onChange([...currentValues, optionValue]);
    } else {
      onChange(currentValues.filter((v: string) => v !== optionValue));
    }
  };

  // Render subquestion within a loop instance
  const renderSubquestion = (subquestion: LoopGroupSubquestion, instanceIndex: number, instanceValue: any) => {
    const subquestionValue = instanceValue?.answers?.[subquestion.id];
    
    return (
      <div key={`${instanceIndex}-${subquestion.id}`} className="space-y-2">
        <label className="block text-sm font-medium text-foreground">
          {subquestion.title}
          {subquestion.required && <span className="text-destructive ml-1">*</span>}
        </label>
        {subquestion.description && (
          <p className="text-xs text-muted-foreground">{subquestion.description}</p>
        )}
        <QuestionRenderer
          question={{
            ...subquestion,
            description: subquestion.description || undefined,
            required: subquestion.required ?? false,
            options: Array.isArray(subquestion.options) ? subquestion.options : undefined
          } as any}
          value={subquestionValue}
          onChange={(value) => handleLoopInstanceChange(instanceIndex, subquestion.id, value)}
        />
      </div>
    );
  };

  // Render loop group with instances
  const renderLoopGroup = () => {
    const instances = initializeLoopInstances();
    const minIterations = question.loopConfig?.minIterations || 1;
    const maxIterations = question.loopConfig?.maxIterations || 5;
    const addButtonText = question.loopConfig?.addButtonText || "Add Item";
    const removeButtonText = question.loopConfig?.removeButtonText || "Remove";

    return (
      <div className="space-y-4" data-testid={`loop-group-${question.id}`}>
        {instances.map((instance: any, index: number) => (
          <Card key={`instance-${index}`} className="relative">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <span className="text-base font-medium">
                  Item #{index + 1}
                </span>
                {instances.length > minIterations && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeLoopInstance(index)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    data-testid={`button-remove-instance-${index}`}
                  >
                    <i className="fas fa-trash mr-1"></i>
                    {removeButtonText}
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {question.subquestions?.map((subquestion) => 
                renderSubquestion(subquestion, index, instance)
              )}
            </CardContent>
          </Card>
        ))}

        {instances.length < maxIterations && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={addLoopInstance}
              className="flex items-center space-x-2"
              data-testid="button-add-loop-instance"
            >
              <i className="fas fa-plus"></i>
              <span>{addButtonText}</span>
            </Button>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          {instances.length} of {maxIterations} items (minimum: {minIterations})
        </div>
      </div>
    );
  };

  const renderInput = () => {
    switch (question.type) {
      case 'short_text':
        return (
          <Input
            placeholder="Your answer"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            onFocus={onFocus}
            onBlur={onBlur}
            data-testid={`input-question-${question.id}`}
          />
        );

      case 'long_text':
        return (
          <Textarea
            placeholder="Your answer"
            rows={4}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            onFocus={onFocus}
            onBlur={onBlur}
            data-testid={`textarea-question-${question.id}`}
          />
        );

      case 'multiple_choice':
        return (
          <div className="space-y-3">
            {question.options?.map((option, index) => (
              <div key={index} className="flex items-center space-x-3 p-3 border border-border rounded-lg hover:bg-accent cursor-pointer">
                <Checkbox
                  checked={Array.isArray(value) && value.includes(typeof option === 'object' && 'value' in option ? option.value : option)}
                  onCheckedChange={(checked) => handleMultipleChoice(option, !!checked)}
                  data-testid={`checkbox-question-${question.id}-option-${index}`}
                />
                <Label className="flex-1 cursor-pointer">{typeof option === 'object' && 'text' in option ? option.text : option}</Label>
              </div>
            ))}
          </div>
        );

      case 'radio':
        return (
          <RadioGroup
            value={value || ""}
            onValueChange={onChange}
            data-testid={`radio-group-question-${question.id}`}
          >
            <div className="space-y-3">
              {question.options?.map((option, index) => (
                <div key={index} className="flex items-center space-x-3 p-3 border border-border rounded-lg hover:bg-accent cursor-pointer">
                  <RadioGroupItem 
                    value={typeof option === 'object' && 'value' in option ? option.value : option} 
                    id={`${question.id}-${index}`}
                    data-testid={`radio-question-${question.id}-option-${index}`}
                  />
                  <Label htmlFor={`${question.id}-${index}`} className="flex-1 cursor-pointer">
                    {typeof option === 'object' && 'text' in option ? option.text : option}
                  </Label>
                </div>
              ))}
            </div>
          </RadioGroup>
        );

      case 'yes_no':
        return (
          <RadioGroup
            value={value || ""}
            onValueChange={onChange}
            data-testid={`yes-no-question-${question.id}`}
          >
            <div className="space-y-3">
              <div className="flex items-center space-x-3 p-3 border border-border rounded-lg hover:bg-accent cursor-pointer">
                <RadioGroupItem value="yes" id={`${question.id}-yes`} />
                <Label htmlFor={`${question.id}-yes`} className="flex-1 cursor-pointer">Yes</Label>
              </div>
              <div className="flex items-center space-x-3 p-3 border border-border rounded-lg hover:bg-accent cursor-pointer">
                <RadioGroupItem value="no" id={`${question.id}-no`} />
                <Label htmlFor={`${question.id}-no`} className="flex-1 cursor-pointer">No</Label>
              </div>
            </div>
          </RadioGroup>
        );

      case 'date_time':
        return (
          <Input
            type="datetime-local"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            onFocus={onFocus}
            onBlur={onBlur}
            data-testid={`datetime-question-${question.id}`}
          />
        );

      case 'file_upload':
        // For file_upload questions, the config is stored in question.options
        const fileConfig = question.options as any;
        return (
          <FileUpload
            config={fileConfig}
            onFilesUploaded={handleFileUpload}
            onFileRemoved={() => {}} // Handle file removal if needed
            initialFiles={Array.isArray(value) ? value : []}
            answerId={answerId}
            data-testid={`file-question-${question.id}`}
          />
        );

      case 'loop_group':
        return renderLoopGroup();

      case 'js_question':
        // JS questions execute on backend during submit/next
        // Display mode determines if UI is shown
        const jsConfig = question.options as any;
        if (jsConfig?.display === 'visible') {
          return (
            <div className="p-4 border border-blue-200 rounded-lg bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
              <div className="flex items-start gap-2">
                <div className="text-blue-600 dark:text-blue-400 mt-0.5">⚡</div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                    Computed Question
                  </p>
                  {jsConfig.helpText && (
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      {jsConfig.helpText}
                    </p>
                  )}
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                    This value will be computed automatically when you submit this page.
                  </p>
                </div>
              </div>
            </div>
          );
        }
        // Hidden mode: render nothing
        return null;

      default:
        return (
          <div className="p-4 border border-destructive rounded-lg bg-destructive/10">
            <p className="text-sm text-destructive">Unsupported question type: {question.type}</p>
          </div>
        );
    }
  };

  return (
    <div className="space-y-4" data-testid={`question-${question.id}`}>
      <div>
        <h3 className="text-lg font-medium text-foreground mb-2">
          {question.title}
          {question.required && <span className="text-destructive ml-1">*</span>}
        </h3>
        {question.description && (
          <p className="text-sm text-muted-foreground mb-4">{question.description}</p>
        )}
      </div>

      {renderInput()}

      {question.required && (
        <div className="text-xs text-muted-foreground flex items-center">
          <i className="fas fa-asterisk mr-1"></i>
          Required question
        </div>
      )}
    </div>
  );
}
