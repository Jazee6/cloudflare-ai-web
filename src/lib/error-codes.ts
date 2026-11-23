/**
 * Every error the app itself reports has a code. API error responses carry it as JSON
 * (`{ code, message, params }`) and the browser translates by code; `message` is the English
 * text for API clients and logs. Errors without a code (raw upstream text) are shown as-is.
 *
 * Placeholders in the text use `{name}` and are filled from `params`.
 */
export const ERROR_MESSAGES = {
  unknownError: "Unknown error occurred. Please try again.",
  noResponse: "No response was received.",
  contextLimitExceeded: "The latest message exceeds the {max}-character context limit.",
  noPromptToRetry: "No prompt to retry.",
  selectImageModelToRetry: "Select an image model to generate this image.",
  unauthorized: "Unauthorized",
  forbidden: "Forbidden",
  invalidPassword: "Invalid password.",
  invalidRequest: "Invalid request data",
  bodyTooLarge: "Request body too large.",
  messageTooLong: "The latest message is too long to process.",
  networkError: "Network error. Please try again.",
  catalogChanged: "The model catalog has changed. Refresh and select another model.",
  noChatModels: "No chat models are currently available",
  selectChatModel: "Select a chat model to continue this response.",
  selectImageModel: "Select an image model to generate images.",
  personalModelMissing: "This Personal Model is no longer configured. Select another model.",

  tooManyImages: "Too many images.",
  imageAttachmentType: "Only image attachments are supported.",
  invalidImageAttachment: "Invalid image attachment.",
  imageAttachmentTooLarge: "Image attachment is too large.",
  tooManyContextAttachments: "Too many context attachments in one message (max {max}).",
  invalidContextAttachment: "Invalid context attachment.",
  contextAttachmentTooLarge: "Context attachment exceeds size limit.",

  gatewayConfigIncomplete:
    "AI Gateway or provider configuration is incomplete. Please check server environment variables.",
  gatewayInvalid:
    "AI Gateway configuration is invalid or the gateway does not exist. Please check server environment variables.",
  dlpBlocked: "The request or response was blocked by Cloudflare AI Gateway security/DLP policy.",
  paidPlanRequired:
    "This model requires a Cloudflare Workers Paid plan and is not available on Free accounts.",
  rateLimited:
    "Daily free quota or gateway rate limit reached. Please try again later or switch models.",
  byokMissing:
    "This external model does not have a valid provider key (BYOK) configured in AI Gateway.",
  providerError: "The AI provider returned an error. Please try again.",

  personalNoGateway:
    "This deployment has no AI Gateway for Personal Providers. Add your own AI Gateway.",
  personalKeyRequired:
    "Personal Providers need their own API key to use this deployment's AI Gateway.",
  dynamicRoutesOwnGateway: "Dynamic Routes are only available through your own AI Gateway.",
  personalGatewayInvalid:
    "Your AI Gateway does not exist or rejected its token. Check the Personal Provider settings.",
  personalCredentialsRejected:
    "The Personal Provider rejected its credentials. Check the API key and gateway settings.",
  personalModelNotOffered: "The Personal Provider does not offer this model.",
  personalRateLimited: "The Personal Provider's rate limit or quota was reached.",
  personalRejected: "The Personal Provider rejected the request.",
  personalProviderError: "The Personal Provider returned an error. Please try again.",
  personalUnreachable: "Unable to reach the Personal Provider.",
  personalModelListInvalid: "The Personal Provider returned an unexpected model list.",

  invalidImageParams: "Invalid image parameters.",
  invalidImageGenerationParams: "Invalid image generation parameters.",
  widthRange: "Width must be between {min} and {max}.",
  heightRange: "Height must be between {min} and {max}.",
  widthStep: "Width must be a multiple of {step}.",
  heightStep: "Height must be a multiple of {step}.",
  aspectRatioOptions: "Aspect ratio must be one of {options}.",
  stepsRange: "Steps must be between {min} and {max}.",
  guidanceRange: "Guidance must be between {min} and {max}.",
  seedRange: "Seed must be an integer between 0 and {max}.",
  negativePromptTooLong: "Negative prompt must be at most {max} characters.",
  tooManyReferenceImages: "Up to {max} reference images are allowed.",
  referenceImageType: "Only image reference files are supported.",
  referenceImageTooLarge: "Reference image size exceeds the 512 KiB limit.",
  referenceImagesUnsupported: "The selected model does not support reference images.",
  imageGenerationFailed: "Image generation failed. Please try again.",
  imageGenerationNotConfigured: "Image generation is not configured.",
  imageProviderNoImage: "The image provider returned no image.",
  imageUnsupportedResponse: "The image provider returned an unsupported response.",
  imageInvalidData: "The image provider returned invalid image data.",

  invalidMultipart: "Invalid multipart form data.",
  missingDocument: "Missing document file.",
  documentTooLarge: "Document exceeds the 4 MiB upload limit.",
  documentExtractFailed: "Failed to extract document content.",
  unsupportedDocument: "Unsupported document format.",
  binaryDocument: "Binary files cannot be read as plain text.",
  invalidUtf8: "Plain-text documents must be valid UTF-8.",
  documentConversionNotConfigured: "Document conversion is not configured on the server.",
  documentConversionUnavailable: "Document conversion service is unavailable.",
  documentConversionFailed: "Failed to convert document to Markdown.",
  documentConversionInvalid: "Document conversion returned an invalid response.",
  emptyDocument: "Uploaded document is empty.",
  noReadableDocumentText: "No readable text could be extracted from this document.",

  knowledgeBaseNotConfigured: "Knowledge Base search is not configured on the server.",
  knowledgeBaseUnavailable: "Knowledge Base search service is unavailable.",
  knowledgeBaseFailed: "Knowledge Base search failed. Please try again.",
  knowledgeBaseInvalid: "Knowledge Base search returned an invalid response.",

  invalidUrl: "Invalid URL.",
  httpOnly: "Only http and https URLs are allowed.",
  urlCredentials: "URLs containing credentials are not allowed.",
  standardPortsOnly: "Only standard HTTP/HTTPS ports (80, 443) are allowed.",
  invalidHostname: "Invalid URL hostname.",
  internalHost: "Access to local or internal hosts is not allowed.",
  hostnameResolveFailed: "Unable to resolve target hostname.",
  hostnameUnresolved: "Target hostname could not be resolved.",
  privateIp: "Access to private or reserved IP addresses is not allowed.",
  hostnameResolvesPrivate: "Target hostname resolves to a private or reserved IP address.",
  webpageTooLarge: "Target webpage exceeds the 4 MiB size limit.",
  fetchTimeout: "Timed out while fetching the target URL.",
  fetchFailed: "Failed to fetch the target URL.",
  invalidRedirect: "Invalid redirect response from target URL.",
  tooManyRedirects: "Target URL exceeded the maximum number of redirects.",
  invalidRedirectLocation: "Invalid redirect location from target URL.",
  readTimeout: "Timed out while reading the target URL.",
  readFailed: "Failed to read the target URL response.",
  webpageExtractFailed: "Failed to extract webpage content.",
  browserRunNotConfigured:
    "Dynamic webpage rendering requires CF_ACCOUNT_ID and CF_BROWSER_RUN_TOKEN.",
  browserRunUnavailable: "Cloudflare Browser Run service is unavailable.",
  browserRunRateLimited:
    "Browser Run free quota or rate limit reached (10 min/day, 1 req/10s). Please try again later.",
  browserRunRenderFailed: "Browser Run failed to render this webpage.",
  browserRunInvalid: "Browser Run returned an invalid response.",
  noReadableWebpage: "No readable content was found on this webpage.",
  webpageHttpStatus: "Target webpage returned HTTP {status}.",
  unsupportedWebpageType: "Unsupported webpage content type: {type}.",
  dynamicRenderingZeroQuota:
    "This webpage requires dynamic JavaScript rendering, which is disabled by your zero-quota setting.",
  dynamicRenderingUnavailable:
    "This webpage requires dynamic JavaScript rendering, and Browser Run is not configured.",
} as const;

export type ErrorCode = keyof typeof ERROR_MESSAGES;
export type ErrorParams = Record<string, string | number>;

export const interpolate = (template: string, params?: ErrorParams) =>
  params
    ? template.replace(/\{(\w+)\}/g, (match, name: string) =>
        name in params ? String(params[name]) : match,
      )
    : template;

/** The English text of an error, as the server sends it. */
export const errorMessage = (code: ErrorCode, params?: ErrorParams) =>
  interpolate(ERROR_MESSAGES[code], params);

/** An error with its code, as passed around on the server and sent to the browser. */
export interface AppError {
  message: string;
  code?: ErrorCode;
  params?: ErrorParams;
}

export const isErrorCode = (value: unknown): value is ErrorCode =>
  typeof value === "string" && Object.hasOwn(ERROR_MESSAGES, value);

export const appError = (code: ErrorCode, params?: ErrorParams) => ({
  code,
  ...(params ? { params } : {}),
  message: errorMessage(code, params),
});

/** The JSON body of an API error response, also used as the text of a stream error. */
export const serializeError = ({ code, params, message }: AppError) =>
  JSON.stringify({ code, message, params });

export const errorResponse = (error: AppError, init?: ResponseInit) =>
  new Response(serializeError(error), {
    ...init,
    headers: {
      ...Object.fromEntries(new Headers(init?.headers)),
      "Content-Type": "application/json",
    },
  });

const paramsSchema = (value: unknown): ErrorParams | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const entries = Object.entries(value).filter(
    (entry): entry is [string, string | number] =>
      typeof entry[1] === "string" || typeof entry[1] === "number",
  );
  return Object.fromEntries(entries);
};

/**
 * Reads an API error body or stream error text. Text that is not a serialized app error, such as a
 * raw upstream message, comes back as the message alone.
 */
export const parseAppError = (text: string): AppError => {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      if (typeof parsed.message === "string") {
        return {
          message: parsed.message,
          ...(isErrorCode(parsed.code) ? { code: parsed.code } : {}),
          ...(paramsSchema(parsed.params) ? { params: paramsSchema(parsed.params) } : {}),
        };
      }
    } catch {
      // Not JSON: fall through to plain text.
    }
  }
  return { message: trimmed };
};

/** Whether a response or stream error is the deployment asking for its access password. */
export const isUnauthorizedError = (text: string) => parseAppError(text).code === "unauthorized";
