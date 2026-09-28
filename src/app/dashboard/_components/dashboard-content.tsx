"use client";

import { useQuery } from "@tanstack/react-query";
import { BalanceCards } from "./balance-cards";
import WizardInput from "./wizard-input";
import { getBalanceSummary } from "@/features/transaction/action";
import GenerativeContent from "./generative-content";

export default function DashboardContent() {
  const { data, error, refetch } = useQuery({
    queryKey: ["balance"],
    queryFn: () => getBalanceSummary(),
  });

  return (
    <section id="content" className="space-y-4">
      <WizardInput refetch={refetch} />
      <BalanceCards data={data} error={error} />
      <GenerativeContent />
    </section>
  );
}
