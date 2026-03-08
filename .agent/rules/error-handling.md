# Error Handling rules

All Next.js Server Actions and API routes MUST be wrapped in a try/catch/finally block. The finally block MUST revert any loading state (e.g., setIsLoading(false)) to prevent infinite UI freezes. Never swallow errors silently.
