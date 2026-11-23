---
status: accepted
---

# Keep a Usage Ledger independent of Conversation History

Global usage statistics must survive deleting a conversation and must count responses that a Retry later replaced, so each response's token usage and Estimated Cost is also written to a separate browser-local Usage Ledger at the moment it completes, instead of being summed from the responses that remain in Conversation History. The Estimated Cost is a snapshot taken with the Model Price in effect at that time; AI Gateway cache hits cost zero. A conversation's total is read from the ledger entries for that conversation, so it includes replaced responses too.

## Considered Options

- Derive all statistics from the retained Conversation History. This needs no extra storage, but deleting a conversation or retrying a response would erase money that was actually spent.
- Backfill the ledger from existing 6.0 histories on upgrade. Rejected: stored responses keep only a display name and no model id, and the catalog prices are not available during the IndexedDB upgrade, so backfilled costs would be guesses. The ledger starts empty.

## Consequences

The ledger adds a Dexie table, is kept forever unless the visitor clears it from the usage settings page, and is part of the JSON backup format. Deleting conversations, including deleting all of them, leaves it untouched. Entries keep a snapshot of the model's name so the ledger stays readable after a Personal Model or catalog entry disappears.
