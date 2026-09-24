import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { convertToIDR } from "@/lib/utils";
import { TrendingDownIcon, TrendingUpIcon, WalletIcon } from "lucide-react";

export function BalanceCards({
  data,
  error,
}: {
  data:
    | { savings: number; totalIncome: number; totalExpense: number }
    | undefined;
  error: unknown;
}) {
  if (error) {
    return (
      <div className="w-full p-4 text-sm border rounded-lg border-destructive/50 text-destructive bg-destructive/10">
        Failed to get balance
      </div>
    );
  }

  return (
    <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <WalletIcon className="size-4" />
            Savings
          </CardTitle>
          <CardDescription className="text-lg lg:text-2xl font-semibold text-secondary-foreground">
            {convertToIDR(Number(data?.savings || 0))}
          </CardDescription>
        </CardHeader>
        <CardFooter className="text-sm">Savings for all time</CardFooter>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <TrendingUpIcon className="size-4" />
            Incomes
          </CardTitle>
          <CardDescription className="text-lg lg:text-2xl font-semibold text-secondary-foreground">
            {convertToIDR(Number(data?.totalIncome || 0))}
          </CardDescription>
        </CardHeader>
        <CardFooter className="text-sm">Total Incomes for all time</CardFooter>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <TrendingDownIcon className="size-4" />
            Expenses
          </CardTitle>
          <CardDescription className="text-lg lg:text-2xl font-semibold text-secondary-foreground">
            {convertToIDR(Number(data?.totalExpense || 0))}
          </CardDescription>
        </CardHeader>
        <CardFooter className="text-sm">Total expenses for all time</CardFooter>
      </Card>
    </div>
  );
}
