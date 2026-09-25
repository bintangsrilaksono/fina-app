"use server";

import { createClient } from "@/lib/supabase/server";
import { createAI } from "./instance";

export async function generateEmbedding(contents: string) {
  const ai = createAI();

  try {
    const response = await ai.models.embedContent({
      model: "gemini-embedding-2",
      contents,
      config: {
        outputDimensionality: 768,
      },
    });

    if (
      !response.embeddings ||
      response.embeddings.length === 0 ||
      !response.embeddings[0].values
    ) {
      throw new Error("Failed to generate embedding");
    }

    return response.embeddings[0].values;
  } catch (error) {
    throw error;
  }
}

export async function findEmbedding(
  query: string,
  match_threshold?: number,
  match_count?: number,
) {
  const supabase = await createClient();

  const queryEmbedding = await generateEmbedding(query);

  const { data, error } = await supabase.rpc("match_transactions", {
    query_embedding: queryEmbedding,
    match_threshold: match_threshold || 0.3,
    match_count: match_count || 15,
  });

  if (error) {
    throw new Error("Failed to perform vector search.");
  }

  return data;
}
