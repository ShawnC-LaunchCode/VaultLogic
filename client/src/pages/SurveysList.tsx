import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";
import type { Survey } from "@shared/schema";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SkeletonCard } from "@/components/shared/SkeletonCard";
import { Link } from "wouter";
import { Plus, Edit, BarChart, Users, Trash2, FileText, Copy, Sparkles, Wand2, PenSquare, ChevronDown } from "lucide-react";

export default function SurveysList() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [deletingSurveyId, setDeletingSurveyId] = useState<string | null>(null);

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
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
  }, [isAuthenticated, isLoading, toast]);

  const { data: surveys, isLoading: surveysLoading } = useQuery<Survey[]>({
    queryKey: ["/api/surveys"],
    retry: false,
  });

  // Delete survey mutation
  const deleteSurveyMutation = useMutation({
    mutationFn: async (surveyId: string) => {
      return await apiRequest("DELETE", `/api/surveys/${surveyId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/surveys"] });
      toast({
        title: "Success",
        description: "Survey deleted successfully",
      });
      setDeletingSurveyId(null);
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
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
      toast({
        title: "Error",
        description: error.message || "Failed to delete survey",
        variant: "destructive",
      });
      setDeletingSurveyId(null);
    },
  });

  const handleDeleteSurvey = (surveyId: string) => {
    setDeletingSurveyId(surveyId);
    deleteSurveyMutation.mutate(surveyId);
  };

  const handleCopyLink = async (survey: Survey) => {
    try {
      const surveyUrl = `${window.location.origin}/survey/${survey.publicLink}`;
      await navigator.clipboard.writeText(surveyUrl);
      toast({
        title: "Link Copied!",
        description: "Survey link has been copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy link to clipboard",
        variant: "destructive",
      });
    }
  };

  if (isLoading || !isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="My Workflows"
          description="Create, manage, and analyze your surveys"
          actions={
            <div className="flex items-center gap-0">
              <Link href="/ai-survey">
                <Button
                  data-testid="button-create-survey"
                  className="rounded-r-none bg-indigo-600 hover:bg-indigo-700"
                >
                  <Wand2 className="w-4 h-4 mr-2" />
                  Generate with AI
                </Button>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="default"
                    className="rounded-l-none border-l border-indigo-500 px-2 bg-indigo-600 hover:bg-indigo-700"
                    data-testid="button-create-survey-dropdown"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <Link href="/surveys/new">
                    <DropdownMenuItem data-testid="button-create-blank-survey">
                      <PenSquare className="w-4 h-4 mr-2" />
                      Start Blank
                    </DropdownMenuItem>
                  </Link>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          }
        />
        
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* Surveys Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {surveysLoading ? (
              // Loading State
              <SkeletonCard count={6} height="h-48" />
            ) : surveys && surveys.length > 0 ? (
              surveys.map((survey) => (
                <Card key={survey.id} className="hover:shadow-md transition-shadow min-h-[220px]">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg font-semibold text-foreground line-clamp-2" data-testid={`text-survey-title-${survey.id}`}>
                        {survey.title}
                      </CardTitle>
                      <StatusBadge status={survey.status} />
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {survey.description && (
                      <p className="text-muted-foreground text-sm mb-4 line-clamp-3" data-testid={`text-survey-description-${survey.id}`}>
                        {survey.description}
                      </p>
                    )}
                    
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Created: {survey.createdAt ? new Date(survey.createdAt).toLocaleDateString() : 'Unknown'}</span>
                        <span>Responses: 0</span>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 pt-2">
                        <Link href={`/builder/${survey.id}`}>
                          <Button variant="outline" size="sm" data-testid={`button-edit-survey-${survey.id}`}>
                            <Edit className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                        </Link>
                        <Link href={`/surveys/${survey.id}/results`}>
                          <Button variant="outline" size="sm" data-testid={`button-view-responses-${survey.id}`}>
                            <BarChart className="w-4 h-4 mr-1" />
                            Results
                          </Button>
                        </Link>
                        <Link href={`/surveys/${survey.id}/recipients`}>
                          <Button variant="outline" size="sm" data-testid={`button-manage-recipients-${survey.id}`}>
                            <Users className="w-4 h-4 mr-1" />
                            Recipients
                          </Button>
                        </Link>
                        <Button
                          variant="outline"
                          size="sm"
                          className="bg-purple-50 hover:bg-purple-100 border-purple-200 text-purple-700 dark:bg-purple-950 dark:hover:bg-purple-900 dark:border-purple-800 dark:text-purple-300"
                          onClick={() => {
                            // Navigate to Results page, AI Insights tab
                            window.location.href = `/surveys/${survey.id}/results?tab=ai-insights`;
                          }}
                          data-testid={`button-ai-insights-${survey.id}`}
                        >
                          <Sparkles className="w-4 h-4 mr-1" />
                          AI Insights
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopyLink(survey)}
                          data-testid={`button-copy-link-${survey.id}`}
                        >
                          <Copy className="w-4 h-4 mr-1" />
                          Link
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="text-destructive hover:text-destructive"
                              data-testid={`button-delete-survey-${survey.id}`}
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Survey</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{survey.title}"? This action cannot be undone.
                                All responses and recipient data will be permanently deleted.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel data-testid={`button-cancel-delete-${survey.id}`}>
                                Cancel
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteSurvey(survey.id)}
                                disabled={deletingSurveyId === survey.id}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                data-testid={`button-confirm-delete-${survey.id}`}
                              >
                                {deletingSurveyId === survey.id ? "Deleting..." : "Delete Survey"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              // Empty State
              <div className="col-span-full">
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-full flex items-center justify-center mb-4">
                      <Wand2 className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground mb-2" data-testid="text-no-surveys">
                      Start your first survey with AI
                    </h3>
                    <p className="text-muted-foreground text-center mb-6 max-w-md text-sm">
                      Describe your topic, and we'll generate grouped pages with 3–4 questions each.
                      Or start from scratch with a blank canvas.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Link href="/ai-survey">
                        <Button data-testid="button-create-first-ai-survey" className="bg-indigo-600 hover:bg-indigo-700">
                          <Wand2 className="w-4 h-4 mr-2" />
                          Generate with AI
                        </Button>
                      </Link>
                      <Link href="/surveys/new">
                        <Button variant="outline" data-testid="button-create-first-survey">
                          <PenSquare className="w-4 h-4 mr-2" />
                          Start Blank
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}