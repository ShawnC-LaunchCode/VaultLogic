/**
 * Advanced Mode Banner
 * Persistent notice shown when workflow is in Advanced mode
 */

import { Info, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function AdvancedModeBanner() {
  return (
    <Alert className="border-primary/30 bg-primary/5">
      <Sparkles className="h-4 w-4 text-primary" />
      <AlertDescription className="text-sm">
        <span className="font-semibold">Advanced Mode Active:</span> You have access to all
        features including JS Transform blocks, custom validation rules, and advanced logic
        operators.
      </AlertDescription>
    </Alert>
  );
}
