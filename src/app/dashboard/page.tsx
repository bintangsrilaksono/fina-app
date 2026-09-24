import { Metadata } from "next";
import { BalanceCards } from "./_components/balance-cards";
import DashboardContent from "./_components/dashboard-content";

export const metadata: Metadata = {
  title: "Fina - Dashboard",
  description: "Your personal financial dashboard",
};

export default function DashboardPage() {
  return (
    <div className="p-2 space-y-4">
      <section id="header">
        <h1 className="text-4xl font-bold text-primary">Dashboard</h1>
        <p>
          Get insights into your spending, track your expenses, and manage your
          finances.
        </p>
      </section>
      <DashboardContent />
    </div>
  );
}
