---
status: accepted
---

# Merge image generation into conversations and retire Image History

v6.0 removes the separate image page and its reserved Image History session. Image generation becomes a turn inside any Conversation History: selecting a `Text to Image` model in the single global model picker turns the next prompt into an image request with its parameters and Reference Images. The image model receives only that prompt and its explicit Reference Images, which may be uploaded or picked from images already in the conversation. Generated images are then treated like uploaded images, so later text turns can include them in the Model Context under the existing recent-image and downscaling limits. A Dexie upgrade turns any 5.x Image History into an ordinary Session so no generated images are lost.

## Considered Options

- Let chat models request images through Tool Calling, rejected for the same reason as ADR-0005: models without tool calling would lose the feature.
- An explicit "image mode" toggle that remembers a separate image model, rejected in favour of one model selection.
- Discard 5.x Image History on upgrade.

## Consequences

`CF_AI_MODEL` and `CF_AI_MODEL_IMAGE` collapse into one stored selection. JSON backups export generated images and Reference Images as data URLs when "include images" is on, and restore them as Blobs on import. Retry and Reference Image no longer refer to Image History.
