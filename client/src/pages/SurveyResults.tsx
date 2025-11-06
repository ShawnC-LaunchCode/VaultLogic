import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { Survey } from "@shared/schema";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { IndividualResponses } from "@/components/results/IndividualResponses";
import { OverallSummary } from "@/components/results/OverallSummary";
import { QuestionDetails } from "@/components/results/QuestionDetails";
import { AiInsights } from "@/components/results/AiInsights";
import { ArrowLeft, Users, BarChart3, Download, XCircle, ListChecks, Sparkles } from "lucide-react";

export default function SurveyResults() {
  const { surveyId } = useParams();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  // Check URL params for initial tab
  const urlParams = new URLSearchParams(window.location.search);
  const tabParam = urlParams.get('tab');
  const initialTab = tabParam === 'ai-insights' ? 'ai-insights' : 'questions';

  const [activeTab, setActiveTab] = useState(initialTab);

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, toast]);

  const { data: survey, isLoading: surveyLoading, error } = useQuery<Survey>({
    queryKey: [`/api/surveys/${surveyId}`],
    enabled: !!surveyId && isAuthenticated,
    retry: false,
  });

  if (authLoading || !isAuthenticated) {
    return null;
  }

  // Loading state
  if (surveyLoading) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <Header title="Survey Results" description="Loading..." />
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        </main>
      </div>
    );
  }

  // Error or not found state
  if (error || !survey) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <Header title="Survey Results" description="Survey not found" />
          <div className="flex-1 flex items-center justify-center">
            <Card className="w-full max-w-md mx-4">
              <CardContent className="pt-6 text-center">
                <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
                <h1 className="text-xl font-bold mb-2">Survey Not Found</h1>
                <p className="text-muted-foreground mb-4">
                  The survey you're looking for doesn't exist or you don't have access to it.
                </p>
                <Link href="/dashboard">
                  <Button>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Dashboard
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />

      <main className="flex-1 flex flex-col overflow-hidden">
        <Header
          title={`Results: ${survey.title}`}
          description="View individual responses and overall analytics"
          actions={
            <div className="flex gap-2">
              <Link href={`/surveys/${surveyId}/analytics`}>
                <Button variant="outline" size="sm" className="hidden sm:flex">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Advanced Analytics
                </Button>
              </Link>
            </div>
          }
        />

        <div className="flex-1 overflow-auto p-4 sm:p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto">
              <TabsTrigger value="questions" className="text-xs sm:text-sm px-2 sm:px-4 py-2">
                <ListChecks className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Question Details</span>
                <span className="sm:hidden">Questions</span>
              </TabsTrigger>
              <TabsTrigger value="individual" className="text-xs sm:text-sm px-2 sm:px-4 py-2">
                <Users className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Individual Responses</span>
                <span className="sm:hidden">Individual</span>
              </TabsTrigger>
              <TabsTrigger value="overall" className="text-xs sm:text-sm px-2 sm:px-4 py-2">
                <BarChart3 className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Overall Summary</span>
                <span className="sm:hidden">Summary</span>
              </TabsTrigger>
              <TabsTrigger value="ai-insights" className="text-xs sm:text-sm px-2 sm:px-4 py-2">
                <Sparkles className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">AI Insights</span>
                <span className="sm:hidden">AI</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="questions" className="space-y-4 sm:space-y-6">
              <QuestionDetails surveyId={surveyId!} />
            </TabsContent>

            <TabsContent value="individual" className="space-y-4 sm:space-y-6">
              <IndividualResponses surveyId={surveyId!} />
            </TabsContent>

            <TabsContent value="overall" className="space-y-4 sm:space-y-6">
              <OverallSummary surveyId={surveyId!} />
            </TabsContent>

            <TabsContent value="ai-insights" className="space-y-4 sm:space-y-6">
              <AiInsights surveyId={surveyId!} />
            </TabsContent>
          </Tabs>

          {/* Back Button */}
          <div className="mt-6">
            <Link href="/dashboard">
              <Button variant="outline" className="w-full sm:w-auto">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
