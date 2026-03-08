# Error Resilience Standards

- All async operations MUST use try/catch/finally blocks.
- The `finally` block MUST reset all loading states (e.g., `setIsLoading(false)`) to prevent UI freezes.
- Use `sonner` for all error toasts to ensure consistent and non-blocking user feedback.
- Ensure that backend errors return meaningful status codes and JSON error messages.
