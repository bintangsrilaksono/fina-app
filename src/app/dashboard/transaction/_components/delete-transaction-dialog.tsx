import { Transaction } from "@/app/types/transaction";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteTransaction } from "@/features/transaction/action";
import { useMutation } from "@tanstack/react-query";
import { Dispatch, SetStateAction } from "react";
import { toast } from "sonner";

export default function DeleteTransactionDialog({
  selectedTransaction,
  setSelectedTransaction,
  refetch,
}: {
  selectedTransaction: {
    data: Omit<Transaction, "user_id" | "embedding">;
    action: "update" | "delete";
  } | null;
  setSelectedTransaction: Dispatch<
    SetStateAction<{
      data: Omit<Transaction, "user_id" | "embedding">;
      action: "update" | "delete";
    } | null>
  >;
  refetch: () => void;
}) {
  const { mutate, isPending } = useMutation({
    mutationFn: (id: string) => {
      return deleteTransaction(id);
    },
    onSuccess: () => {
      setSelectedTransaction(null);
      refetch();
      toast.success("Transaction deleted successfully!");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete transaction",
      );
    },
  });
  return (
    <Dialog
      open={!!selectedTransaction && selectedTransaction.action === "delete"}
      onOpenChange={() => setSelectedTransaction(null)}
    >
      <DialogContent className="gap-4">
        <DialogHeader className="gap-4">
          <DialogTitle>Are you sure?</DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete your
            transactions data from the database.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setSelectedTransaction(null)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={isPending}
            onClick={() => {
              if (selectedTransaction) mutate(selectedTransaction.data.id);
            }}
          >
            {isPending ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
