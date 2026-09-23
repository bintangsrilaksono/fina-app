import { Metadata } from "next";
import Transaction from "./_components/transaction";

export const metadata: Metadata = {
  title: "Fina - Transaction",
  description: "View and manage your financial transactions.",
};

export default function TransactionPage() {
  return (
    <div className="p-2 space-y-4">
      <section id="header">
        <h1 className="text-4xl font-bold text-primary">Transaction</h1>
        <p>View and manage your financial transactions.</p>
      </section>
      <section id="content">
        <Transaction />
      </section>
    </div>
  );
}
