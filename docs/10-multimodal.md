# Multimodal

## Purpose

Accept non-text input (images, PDFs, audio) and produce non-text output (images, video) using Gemini's native multimodal support, rather than a separate OCR/STT pipeline.

## Image/PDF input → structured transaction (receipt scanning)

File: [src/features/ai/multimodal.ts](../src/features/ai/multimodal.ts) `extractReceiptData`. UI: [file-dropzone-input.tsx](../src/app/dashboard/_components/file-dropzone-input.tsx).

- Accepts `image/*`, `video/*`, `audio/*`, and `.pdf` in the dropzone's `accept` attribute and drag/drop filter, but the extraction function itself only builds a receipt-extraction prompt suited to a static image/PDF (its instruction text is "Extract the transaction details from the receipt") — video/audio files dropped here would be sent through the same code path with no matching instruction, an inconsistency between the accepted file types and the prompt's assumptions.
- File is read via `file.arrayBuffer()` and base64-encoded, sent as `inlineData: { mimeType, data }` alongside the text prompt, model `gemini-3.5-flash`.
- Output validated against the shared zod `transactionSchema` before being handed back to the caller.
- **Does not persist to the database itself** — the call to `createTransaction` is present in the file but commented out (lines 68–69); the extracted data is only used to pre-fill the create-transaction form via `setValues()` in the dropzone component. The user must still submit the form.

## Audio input → transcription + tool-calling (voice wizard)

Files: [wizard.ts](../src/features/ai/wizard.ts) `handleWizardTools`, [wizard-input.tsx](../src/app/dashboard/_components/wizard-input.tsx).

- Browser records via `navigator.mediaDevices.getUserMedia({audio: true})` + `MediaRecorder`, producing an `audio/webm` blob client-side — no client-side transcription library is used.
- The blob is sent as `FormData` (`type: "audio"`) to the `handleWizardTools` server action, base64-encoded, and passed as `inlineData` to Gemini alongside a prompt instructing it to "Extract the transaction details from the audio file in bahasa Indonesia".
- This is a single combined step (transcription + entity extraction + potential tool calls) — there is no separate speech-to-text call; Gemini performs everything in one `generateContent` request per loop turn.

## Image output (generation)

File: [generative-content.ts](../src/features/ai/generative-content.ts) `generateImage`. See [06-content-generation.md](06-content-generation.md) for full detail. Model `gemini-3.1-flash-image`, `imageConfig.aspectRatio: "16:9"`, response parsed from `inlineData` parts into a base64 data URI, rendered via `next/image`.

## Video output (generation)

File: [generative-content.ts](../src/features/ai/generative-content.ts) `generateVideo`. Model `veo-3.1-lite-generate-preview`, asynchronous operation polling, server-side temp-file download, base64 re-encoding for transport. See [06-content-generation.md](06-content-generation.md) for the leaked-temp-file issue.

## Modality matrix

| Modality | Direction | Model | File | Status |
|---|---|---|---|---|
| Image | In (receipt) | `gemini-3.5-flash` | [multimodal.ts](../src/features/ai/multimodal.ts) | IMPLEMENTED |
| PDF | In (receipt) | `gemini-3.5-flash` | [multimodal.ts](../src/features/ai/multimodal.ts) | PARTIALLY IMPLEMENTED — routed through the image path with no PDF-specific handling |
| Audio | In (voice → transaction) | `gemini-2.5-flash` | [wizard.ts](../src/features/ai/wizard.ts) | IMPLEMENTED |
| Video | In | — | — | NOT IMPLEMENTED (accepted by the dropzone's file filter but not actually handled by any matching prompt/logic) |
| Image | Out (generated insight) | `gemini-3.1-flash-image` | [generative-content.ts](../src/features/ai/generative-content.ts) | IMPLEMENTED |
| Video | Out (generated insight) | `veo-3.1-lite-generate-preview` | [generative-content.ts](../src/features/ai/generative-content.ts) | IMPLEMENTED |

## Inputs / Outputs

| Function | Input | Output |
|---|---|---|
| `extractReceiptData(formData)` | `FormData{file}` | Zod-validated transaction object |
| `handleWizardTools(formData)` (audio branch) | `FormData{type:"audio", file}` | Final model text after tool-calling loop |
| `generateImage(request)` | string | base64 PNG data URI |
| `generateVideo(request)` | string | base64 MP4 data URI |

## Error handling

- `extractReceiptData` throws `"No file uploaded"` if `file` is missing, and `"AI cannot generate data"` if the model returns empty text; a zod parse failure on malformed JSON propagates as an uncaught `ZodError`/`SyntaxError` up to the React Query `onError` handler, which only shows `error.message` — likely a confusing raw parser error surfaced to the end user rather than a friendly message.
- Audio recording failures in the browser (`getUserMedia` rejection) are caught and shown via `toast.error("Failed to access media recorder")` — the one place in the multimodal path with a deliberately friendly message.

## Security considerations

- Uploaded files (images, audio, PDFs) reach the server as `FormData` sent to a Server Action, then go to Google's API as base64. **Corrected in v2:**
  - The application does no size check of its own, in the browser or on the server.
  - Next.js still caps Server Action request bodies at **1 MB by default**, and `bodySizeLimit` is not configured. That cap bounds resource use.
  - The cap also means receipt photos or voice recordings over 1 MB fail with an unclear error (AUDIT-REPORT COR-12, SEC-6).
- No file-content validation beyond MIME-type sniffing on the client (`file.type`) — this is trivially spoofable and is not re-checked server-side.

## Limitations

- No OCR/ASR fallback if the multimodal model call fails.
- No progress indication for long video-generation polling beyond a generic spinner — the 10-second-interval poll loop has no user-visible ETA.
- No multi-file batch upload (one file per request only).
