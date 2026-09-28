"use server";

import {
  CATEGORIES,
  transactionSchema,
} from "@/constants/transaction-constant";
import { createAI } from "./instance";
import { Content } from "@google/genai";

export async function extractReceiptData(formData: FormData) {
  const file = formData.get("file") as File;
  if (!file) {
    throw new Error("No file uploaded");
  }
  const mimeType = file.type;
  const base64Data = Buffer.from(await file.arrayBuffer()).toString("base64");
  const ai = createAI();
  const contents: Content[] = [
    {
      role: "user",
      parts: [
        {
          inlineData: {
            mimeType,
            data: base64Data,
          },
        },
        {
          text: `
            <role>
                You are an AI finance assitant, who can extract transaction details from receipt.
            </role>
            <instruction>
                Extract the transaction details from the receipt and return it as a structure JSON object.
                The JSON object must have exactly these fields:
                - "amount": a number representing the cost (positive). Use 0 if not provided.
                - "type": type of transaction, either 'income' or 'expense'.
                - "category": choose the most appropriate category from this exact list:
                            ${CATEGORIES.join(",")}.
                - "description": a short string describing the transaction, first letter capitalized.
                - "date": date of transaction in YYYY-MM-DD format.
                        Assume the current date if relative terms like 'today' or 'just now'. If not define use current date.
            </instruction>
            <context>
                Current Date : ${new Date().toISOString()}
            </context>
            <outputFormat>
                Respond with only the raw JSON object, no markdown blocks, no text before or after.
            </outputFormat>
                `,
        },
      ],
    },
  ];

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents,
  });

  if (!response.text) {
    throw new Error("AI cannot generate data");
  }

  const transaction = transactionSchema.parse(JSON.parse(`${response.text}`));

  return transaction;
  //   Save to DB
  //   await createTransaction(transaction);
  //   return 'Create transaction success';
}
