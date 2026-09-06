---
status: accepted
---

# Use stateless Access Sessions for protected inference APIs

When `APP_PASSWORD` is configured, `POST /api/auth` will exchange the deployment password for a 30-day, HttpOnly, same-site Access Session whose HMAC proof is validated by protected inference APIs; the browser will not retain or resend the raw password, and a failed request may be retried once after successful authentication. Deployments without `APP_PASSWORD` remain explicitly public. This preserves the project's stateless Serverless architecture and simple shared-password boundary without adding user accounts or session storage, while rejecting the existing localStorage/Authorization design and raw-password cookies.
