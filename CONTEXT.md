# Cloudflare AI Web

This application presents a unified catalog of AI models and routes each selected model to its inference provider.

## Language

**Model Catalog**:
The complete set of models available to a visitor, combining the deployment's Cloudflare Models and External Models (including Gateway Routes) with that visitor's own Personal Models.
_Avoid_: Model list, provider list

**Cloudflare Model**:
A Workers AI model whose availability and descriptive metadata come from the current Cloudflare account's remote catalog.
_Avoid_: Built-in model, local model, allowlisted model

**Model Brand**:
The publishing organization identified by a Cloudflare Model's namespace, used to form the default Model Groups.
_Avoid_: Provider, author, vendor

**External Model**:
A model served by a provider outside Workers AI and declared explicitly by the deployment to route through Cloudflare AI Gateway, or a Gateway Route exposed as a selectable entry.
_Avoid_: Custom model, fallback model

**Personal Provider**:
A connection to an AI Gateway–supported upstream provider configured by a visitor in their own browser, consisting of the provider and optionally the visitor's own upstream key and/or the visitor's own AI Gateway. It is never stored by the deployment and is invisible to other visitors.
_Avoid_: BYOK, custom provider, local key, user key

**Personal Model**:
A model a visitor uses through one of their Personal Providers, either picked from the provider's published model list or declared by hand. Like External Models, undeclared capabilities are unavailable.
_Avoid_: Custom model, local model, user model

**Gateway Route**:
A named AI Gateway routing policy exposed in the Model Catalog as an External Model, whose upstream model selection, fallback, or traffic rules are managed in Cloudflare rather than the application.
_Avoid_: Dynamic model, virtual model, fallback rule

**Catalog Snapshot**:
The most recent successfully retrieved set of Cloudflare Models, retained temporarily so a catalog refresh failure does not remove known models.
_Avoid_: Static model list, allowlist

**Capability Signal**:
Remote model metadata that indicates whether a Cloudflare Model can accept a particular interaction, such as image input or reasoning output. An absent or ambiguous signal means the capability is unavailable.
_Avoid_: Capability guarantee, local override

**Experimental Model**:
A Cloudflare Model marked experimental by the remote catalog and presented with that status visible to users.
_Avoid_: Beta model, community model

**Model Group**:
A named, ordered section of the model picker in a visitor's browser. Default groups come from Model Brands, the deployment's External Models, and each Personal Provider, with the deployment's External Models shown first; a visitor may also create, rename, and delete their own groups and move models into them. Every model belongs to exactly one group, and models outside any visitor-created group fall back to their default group.
_Avoid_: Category, folder, tag

**Hidden Group**:
A Model Group a visitor has chosen not to show in the model picker. Every model currently in it is hidden, including models that newly appear in it later, while each model's own Hidden Model choice is kept for when the group is shown again.
_Avoid_: Collapsed group, disabled group

**Hidden Model**:
A model in the Model Catalog that a visitor has chosen not to show in the model picker in their browser, either individually or because its Model Group is a Hidden Group. Models are shown unless hidden, so newly available models appear without any action.
_Avoid_: Disabled model, removed model, allowlist

**Conversation History**:
The locally retained sequence of messages belonging to a chat session, including prompts answered by image generation models and the images they produced, preserved across application upgrades.
_Avoid_: Chat records, message cache, chat log, Image History, image session

**Model Context**:
The bounded subset of a Conversation History supplied to a model for one inference request, limited to the most recent messages up to a visitor-chosen Context Message Limit and a fixed size ceiling. It may include Context Attachments, downscaled copies of stored images, and ephemeral Knowledge Base excerpts injected for that single request.
_Avoid_: Full history, chat records, request history

**Context Message Limit**:
The visitor's single, browser-wide choice of how many recent messages a Model Context may include at most.
_Avoid_: Context size, context window, history length

**Context Attachment**:
A user-supplied document or webpage converted into bounded readable text and retained with a user message in Conversation History so any chat model can read it inside Model Context.
_Avoid_: File upload, raw document, web scrape

**Knowledge Base**:
A read-only external document index explicitly permitted by the deployment that a user may attach to a conversation to supply ephemeral retrieval excerpts for grounding responses.
_Avoid_: Vector database, AutoRAG bucket, document store

**Citation**:
A lightweight source reference from a Knowledge Base search retained with an assistant response for display, while the full retrieved excerpts remain ephemeral to that inference's Model Context.
_Avoid_: Retrieval chunk, RAG context, footnote

**Context Usage**:
The share of a model's context window occupied by the latest inference request, as reported by the model itself. It is independent of the Model Context, which is selected by the application before the request.
_Avoid_: Model Context, context budget, token count

**Failed Response**:
The retained record that an inference request for a prompt was sent but failed (including image generation), kept in Conversation History in place of a response so the failure stays visible. It is never part of any Model Context, and a successful Retry replaces it.
_Avoid_: Error message, error toast, unanswered prompt

**Model Price**:
The per-token price of a model, taken from the remote catalog for Cloudflare Models or declared by the visitor for other models.
_Avoid_: Rate, cost, billing

**Estimated Cost**:
The approximate money a response consumed, derived from its reported token usage and its model's Model Price. It is an estimate and not the provider's bill.
_Avoid_: Bill, charge, spend, Neurons

**Usage Ledger**:
The visitor's browser-local record of every response's token usage and Estimated Cost, kept independently of Conversation History so that deleting a conversation does not erase what it consumed.
_Avoid_: Billing history, usage log, stats

**Retry**:
Producing a new response for the latest prompt that replaces the latest response in its Conversation History once the new response succeeds. Earlier responses cannot be retried.
_Avoid_: Regenerate, rerun, redo

**Reference Image**:
An image explicitly attached to a single image generation prompt, either uploaded or chosen from the images in the current Conversation History, to guide image editing or variation. An image generation model receives only that prompt and its Reference Images, never the rest of the Conversation History.
_Avoid_: Image context, input history, mask

**Access Session**:
A time-bounded proof that a visitor supplied the deployment access password and may use protected inference APIs.
_Avoid_: Password cookie, user account, login session

**Interface Language**:
The language the application's own text is shown in, either following the visitor's system or chosen explicitly. It never changes model responses, prompts, or names the visitor entered; a Failed Response the application describes is shown in the current Interface Language, while failure text relayed from a provider is shown as received.
_Avoid_: Locale, response language, translation

**Announcement**:
A short, dismissible notice the deployment shows to all of its visitors, optionally linking elsewhere and optionally worded per Interface Language. A visitor who dismisses it does not see it again until its content changes.
_Avoid_: Banner, notice, alert
