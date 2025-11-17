/**
 * DataVault Tables List Page
 * Lists all tables with stats, search, and create/delete actions
 * Full implementation for PR 5
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
  useDatavaultTables,
  useCreateDatavaultTable,
  useDeleteDatavaultTable,
  useCreateDatavaultColumn,
} from "@/lib/datavault-hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Plus } from "lucide-react";
import { CreateTableModal } from "@/components/datavault/CreateTableModal";
import { TableCard } from "@/components/datavault/TableCard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";

export default function DataVaultTablesPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: tables, isLoading } = useDatavaultTables(true);
  const createTableMutation = useCreateDatavaultTable();
  const deleteTableMutation = useDeleteDatavaultTable();
  const createColumnMutation = useCreateDatavaultColumn();

  const [searchQuery, setSearchQuery] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  // Filter tables by search query
  const filteredTables = tables?.filter((table) => {
    const query = searchQuery.toLowerCase();
    return (
      table.name.toLowerCase().includes(query) ||
      table.slug.toLowerCase().includes(query) ||
      table.description?.toLowerCase().includes(query)
    );
  });

  const handleCreate = async (data: {
    name: string;
    slug?: string;
    description?: string;
    columns: Array<{ name: string; type: string; required: boolean }>;
  }) => {
    try {
      // Create table first
      const table = await createTableMutation.mutateAsync({
        name: data.name,
        slug: data.slug,
        description: data.description,
      });

      // Create columns
      for (const column of data.columns) {
        await createColumnMutation.mutateAsync({
          tableId: table.id,
          name: column.name,
          type: column.type,
          required: column.required,
        });
      }

      toast({
        title: "Table created",
        description: `${data.name} has been created with ${data.columns.length} columns.`,
      });

      setCreateModalOpen(false);
    } catch (error) {
      toast({
        title: "Failed to create table",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    try {
      await deleteTableMutation.mutateAsync(deleteConfirm.id);

      toast({
        title: "Table deleted",
        description: `${deleteConfirm.name} has been deleted successfully.`,
      });

      setDeleteConfirm(null);
    } catch (error) {
      toast({
        title: "Failed to delete table",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  };

  const handleTableClick = (tableId: string) => {
    setLocation(`/datavault/tables/${tableId}`);
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-4 py-8">
            {/* Page Header */}
            <div className="flex flex-col gap-4 mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-foreground">
                    <i className="fas fa-table mr-3"></i>
                    Tables
                  </h1>
                  <p className="text-muted-foreground mt-1">
                    Manage your custom data tables
                  </p>
                </div>
                <Button onClick={() => setCreateModalOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Table
                </Button>
              </div>

              {/* Search */}
              {tables && tables.length > 0 && (
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search tables..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              )}
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Tables Grid */}
            {!isLoading && filteredTables && filteredTables.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredTables.map((table) => (
                  <TableCard
                    key={table.id}
                    table={table}
                    onClick={() => handleTableClick(table.id)}
                    onDelete={() => setDeleteConfirm({ id: table.id, name: table.name })}
                  />
                ))}
              </div>
            ) : !isLoading && tables?.length === 0 ? (
              /* Empty State */
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="rounded-full bg-muted p-6 mb-4">
                  <i className="fas fa-table text-4xl text-muted-foreground"></i>
                </div>
                <h3 className="text-xl font-semibold mb-2">No tables yet</h3>
                <p className="text-muted-foreground mb-6 max-w-sm">
                  Get started by creating your first data table with custom columns
                </p>
                <Button onClick={() => setCreateModalOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Table
                </Button>
              </div>
            ) : !isLoading && searchQuery && filteredTables?.length === 0 ? (
              /* No Search Results */
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Search className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">No results found</h3>
                <p className="text-muted-foreground mb-4">
                  No tables match "{searchQuery}"
                </p>
                <Button variant="outline" onClick={() => setSearchQuery("")}>
                  Clear Search
                </Button>
              </div>
            ) : null}
          </div>
        </main>
      </div>

      {/* Create Table Modal */}
      <CreateTableModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSubmit={handleCreate}
        isLoading={createTableMutation.isPending || createColumnMutation.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Table?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirm?.name}"? This action cannot be undone.
              All columns, rows, and data will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteTableMutation.isPending}
            >
              {deleteTableMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
