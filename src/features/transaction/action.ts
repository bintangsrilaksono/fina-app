"use server";

import { Transaction } from "@/app/types/transaction";
import { createClient } from "@/lib/supabase/server";

export async function getBalanceSummary() {
  const supabase = await createClient();

  const { data } = await supabase.from("transactions").select("amount, type");

  const { totalIncome, totalExpense, savings } = (data || []).reduce(
    (acc, tx) => {
      if (tx.type === "income") acc.totalIncome += tx.amount;
      else if (tx.type === "expense") acc.totalExpense += tx.amount;
      acc.savings = acc.totalIncome - acc.totalExpense;
      return acc;
    },
    {
      totalIncome: 0,
      totalExpense: 0,
      savings: 0,
    },
  );

  return {
    totalIncome,
    totalExpense,
    savings,
  };
}

export async function getTransactions(params?: {
  limit?: number;
  page?: number;
  search?: string;
}) {
  const { limit = 10, page = 1, search } = params || {};
  const supabase = await createClient();
  let query = supabase
    .from("transactions")
    .select("id, amount, type, description, date, category", {
      count: "exact",
    })
    .order("date");

  if (search) {
    query = query.ilike("description", `%${search}%`);
  }

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await query.range(from, to);

  if (error) throw new Error(error.message);

  const totalData = count || 0;

  return {
    data,
    totalData,
    totalPages: Math.ceil(totalData / limit),
  };
}

export async function createTransaction(
  payload: Omit<Transaction, "id" | "user_id" | "embedding">,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("transactions").insert(payload);

  if (error) throw new Error(error.message);

  return data;
}

export async function deleteTransaction(id: string) {
  const supabase = await createClient();
  const { error, success } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);

  return success;
}

export async function updateTransaction(
  id: string,
  payload: Omit<Transaction, "id" | "user_id" | "embedding">,
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .update(payload)
    .eq("id", id);

  if (error) throw new Error(error.message);

  return data;
}
