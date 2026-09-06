# Cloudflare AI Web

This application presents a unified catalog of AI models and routes each selected model to its inference provider.

## Language

**Model Catalog**:
The complete set of models the application currently presents to users, combining Cloudflare Models with External Models.
_Avoid_: Model list, provider list

**Cloudflare Model**:
A Workers AI model whose availability and descriptive metadata come from the current Cloudflare account's remote catalog.
_Avoid_: Built-in model, local model, allowlisted model

**Model Brand**:
The publishing organization identified by a Cloudflare Model's namespace, used to group models in the catalog.
_Avoid_: Provider, author, vendor

**External Model**:
A model served by a provider outside Workers AI and registered explicitly by the application.
_Avoid_: Custom model, fallback model

**Catalog Snapshot**:
The most recent successfully retrieved set of Cloudflare Models, retained temporarily so a catalog refresh failure does not remove known models.
_Avoid_: Static model list, allowlist

**Capability Signal**:
Remote model metadata that indicates whether a Cloudflare Model can accept a particular interaction, such as image input or reasoning output. An absent or ambiguous signal means the capability is unavailable.
_Avoid_: Capability guarantee, local override

**Experimental Model**:
A Cloudflare Model marked experimental by the remote catalog and presented with that status visible to users.
_Avoid_: Beta model, community model
