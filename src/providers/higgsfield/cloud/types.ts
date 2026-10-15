export type CloudStatus = "queued" | "in_progress" | "completed" | "failed" | "nsfw" | "canceled" | "cancelled";

export interface SubmitResponse {
  status: CloudStatus;
  request_id: string;
  status_url?: string;
  cancel_url?: string;
}

export interface StatusResponse {
  status: CloudStatus;
  request_id: string;
  images?: { url: string }[];
  video?: { url: string };
  audio?: { url: string };
  audios?: { url: string }[];
  error?: string | { message?: string } | null;
  [k: string]: unknown;
}

export interface UploadUrlResponse {
  upload_url: string;
  public_url: string;
  upload_headers?: Record<string, string>;
}

export interface EstimateResponse {
  usd?: string | number;
  pricing_description?: string;
  [k: string]: unknown;
}

export class CloudApiError extends Error {
  constructor(message: string, readonly status: number, readonly body: unknown, readonly retryable: boolean, readonly code?: string) {
    super(message);
    this.name = "CloudApiError";
  }
}
