/**
 * Notes Tab Component
 * Displays notes for a row with ability to add/delete notes
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { datavaultAPI } from "@/lib/datavault-api";
import { NoteItem } from "./NoteItem";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";

interface NotesTabProps {
  rowId: string;
  tableOwnerId?: string | null; // User ID of table owner for delete permissions
}

export function NotesTab({ rowId, tableOwnerId }: NotesTabProps) {
  const [noteText, setNoteText] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useUser();

  // Fetch notes
  const { data: notes = [], isLoading, isError } = useQuery({
    queryKey: ["datavault", "rows", rowId, "notes"],
    queryFn: () => datavaultAPI.getRowNotes(rowId),
  });

  // Create note mutation
  const createNoteMutation = useMutation({
    mutationFn: (text: string) => datavaultAPI.createRowNote(rowId, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["datavault", "rows", rowId, "notes"] });
      setNoteText("");
      toast({
        title: "Note added",
        description: "Your note has been added successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add note",
        description: error.message || "An error occurred while adding the note.",
        variant: "destructive",
      });
    },
  });

  // Delete note mutation
  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: string) => datavaultAPI.deleteRowNote(noteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["datavault", "rows", rowId, "notes"] });
      toast({
        title: "Note deleted",
        description: "The note has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete note",
        description: error.message || "An error occurred while deleting the note.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedText = noteText.trim();
    if (!trimmedText) {
      toast({
        title: "Empty note",
        description: "Please enter some text before submitting.",
        variant: "destructive",
      });
      return;
    }

    createNoteMutation.mutate(trimmedText);
  };

  const handleDeleteNote = async (noteId: string) => {
    await deleteNoteMutation.mutateAsync(noteId);
  };

  // Check if user can delete a note (owner or table owner)
  const canDeleteNote = (note: any) => {
    if (!user) return false;
    return note.userId === user.id || tableOwnerId === user.id;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <MessageSquare className="w-12 h-12 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          Failed to load notes. Please try again.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Notes list */}
      <div className="flex-1 overflow-y-auto px-4">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="w-12 h-12 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              No notes yet. Be the first to add one!
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {notes.map((note) => (
              <NoteItem
                key={note.id}
                note={note}
                onDelete={handleDeleteNote}
                canDelete={canDeleteNote(note)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add note form */}
      <div className="border-t p-4 bg-background">
        <form onSubmit={handleSubmit} className="space-y-2">
          <Textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add a note..."
            className="min-h-[80px] resize-none"
            disabled={createNoteMutation.isPending}
          />
          <div className="flex justify-end">
            <Button
              type="submit"
              size="sm"
              disabled={createNoteMutation.isPending || !noteText.trim()}
            >
              {createNoteMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Note"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
