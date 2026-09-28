"use server";

import z from "zod";
import { createAI } from "./instance";
import { Content } from "@google/genai";
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "../transaction/action";
import { findEmbedding } from "./embedding";
import {
  createTransactionDeclaration,
  deleteTransactionDeclaration,
  getTransactionDeclaration,
  updateTransactionDeclaration,
} from "./function-transaction";
import {
  CATEGORIES,
  transactionSchema,
} from "@/constants/transaction-constant";

export async function handleWizardInput(message: string) {
  const contents = `
  <role>
    You are an AI Wizard finance assitant, who can extract transaction details from text.
  </role>
  <instruction>
    Extract the transaction details from the following text and return it as a structure JSON object.
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
  <input>
    Text to extract: ${message}
  </input>
  <outputFormat>
    Respond with only the raw JSON object, no markdown blocks, no text before or after.
  </outputFormat>
  `;
  const ai = createAI();
  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents,
    config: {
      responseMimeType: "application/json",
      responseSchema: z.toJSONSchema(transactionSchema),
    },
  });

  const transaction = transactionSchema.parse(JSON.parse(`${response.text}`));
  if (transaction.amount <= 0) {
    throw new Error("Cannot create transaction with invalid amount");
  }

  await createTransaction(transaction);

  return "Create transaction success";
}

export async function handleWizardTools(formData: FormData) {
  const type = formData.get("type") as "audio" | "text";
  const file = formData.get("file") as File;
  const request = formData.get("request") as string;
  if (type === "audio" && !file) {
    throw new Error("No file uploaded");
  }

  let mimeType = "";
  let base64Data = "";

  if (type === "audio") {
    mimeType = file.type;
    base64Data = Buffer.from(await file.arrayBuffer()).toString("base64");
  }

  const contents: Content[] = [];

  contents.push({
    role: "user",
    parts: [
      ...(type === "audio"
        ? [
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
          ]
        : []),
      {
        text: `
            <role>
                You are an AI Wizard finance assitant, who can extract transaction details from ${type}.
            </role>
            <instruction>
                - Extract the transaction details from ${type === "text" ? "the following text" : "the audio file"} in bahasa Indonesia.
                - If request is to update or delete transaction, you must call function get_transaction first to find out which transaction will be updated or deleted.
                - When update transaction, args must return from get_transaction with fully like in schema.
                - The final response if there are no more functions being called is as simple as possible.
            </instruction>
            <context>
                Current Date : ${new Date().toISOString()}
            </context>
            ${
              type === "text" &&
              `<input>
                Text to extract: ${request}
              </input>`
            }
          `,
      },
    ],
  });

  const ai = createAI();
  let running = true;
  while (running) {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        tools: [
          {
            functionDeclarations: [
              getTransactionDeclaration,
              createTransactionDeclaration,
              deleteTransactionDeclaration,
              updateTransactionDeclaration,
            ],
          },
        ],
      },
    });

    if (response.functionCalls && response.functionCalls.length > 0) {
      if (response.candidates && response.candidates[0]?.content) {
        contents.push(response.candidates[0].content);
      }

      const functionResponseParts = await Promise.all(
        response.functionCalls.map(async (functionCall) => {
          const { name, args, id } = functionCall;
          if (!args) {
            throw new Error("No arguments provided for action");
          }

          let resultData = {};

          switch (name) {
            case "get_transaction":
              const dataFind = await findEmbedding(
                JSON.stringify(args),
                0.3,
                1,
              );
              resultData = dataFind[0] || {};
              break;
            case "create_transaction":
              const transaction = transactionSchema.parse(args);
              if (transaction.amount <= 0) {
                throw new Error(
                  "Cannot create transaction with invalid amount",
                );
              }
              await createTransaction(transaction);
              break;

            case "delete_transaction":
              await deleteTransaction(`${args.id}`);
              break;

            case "update_transaction":
              const newData = transactionSchema.parse(args);

              if (newData.amount <= 0) {
                throw new Error(
                  "Cannot update transaction with invalid amount",
                );
              }

              await updateTransaction(`${args.id}`, newData);

              break;
            default:
              throw new Error(`Unknown function call`);
          }

          return {
            functionResponse: {
              name,
              response: { result: resultData },
              id,
            },
          };
        }),
      );

      contents.push({
        role: "user",
        parts: functionResponseParts,
      });
    } else {
      running = false;
      return response.text;
    }
  }
}
