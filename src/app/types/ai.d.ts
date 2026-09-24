export type Conversation = {
  role: string;
  parts: { text: string; thought?: boolean }[];
};
