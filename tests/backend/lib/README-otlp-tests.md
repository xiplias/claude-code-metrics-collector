# OTLP Message Extraction Tests

This directory contains comprehensive tests for OTLP (OpenTelemetry Protocol) message extraction and processing, with special focus on message saving functionality.

## Test Files

### 1. `otlp-message-extraction.test.ts`
Tests edge cases and complex scenarios for OTLP message extraction:

- **Batch processing and accumulation**
  - Accumulates costs from multiple data points in a single metric
  - Handles token accumulation (with limitations)
  - Processes mixed metrics in single resourceMetrics block

- **Message attribute edge cases**
  - Handles partial attributes (missing role, model, etc.)
  - Empty strings are stored as NULL in database
  - Supports very long attribute values

- **Token type variations**
  - Gracefully handles unknown token types
  - Processes all token types (input, output, cache_read, cache_creation)

- **Malformed data handling**
  - Handles missing data points
  - Handles missing sum field in metrics
  - Handles null values in attributes
  - Accepts negative values (though they may not be meaningful)

- **Concurrent updates**
  - Handles rapid sequential updates to the same message

### 2. `otlp-message-behavior.test.ts`
Documents the actual behavior of the OTLP implementation:

- **Current implementation behavior**
  - Accumulates values across different `processOTLPMetrics` calls
  - Within a single metric, accumulates multiple data points
  - `claude_code.cost.usage` only adds to message cost when in same resourceMetrics block

- **Session ID requirements**
  - Token metrics require session_id in resource attributes to update messages
  - Messages cannot be saved without both session_id and message_id
  - Metrics are still stored even if messages can't be saved

- **Database behavior**
  - Empty strings are stored as NULL
  - Uses UPDATE for existing messages to accumulate values

### 3. `production-patterns.test.ts`
Tests based on production metric structures with completely sanitized data:

- **Claude Code session patterns** - High cache usage scenarios
- **Conversation message patterns** - Message cost and token tracking
- **Model variations** - Testing Opus and Haiku usage patterns
- **Tool decision patterns** - Code editing permission tracking
- **Development activity** - Lines of code metrics

### 4. Existing test files
- `message-logging.test.ts` - Basic message creation and token updates
- `complete-message-flow.test.ts` - Real-world conversation flows
- `otlp-helpers.test.ts` - Helper function unit tests

## Key Implementation Insights

1. **Message Saving Requirements**:
   - Both `session_id` and `message_id` must be present
   - `session_id` must be in resource attributes (not just data point attributes)

2. **Token Updates**:
   - Token metrics without session_id in resource attributes are ignored for message updates
   - The metrics themselves are still stored in the metrics table

3. **Cost Accumulation**:
   - Multiple data points within a single metric are accumulated
   - Updates to existing messages accumulate values (cost, tokens)
   - `claude_code.cost.usage` adds to message cost only when processed in same resourceMetrics block

4. **Attribute Handling**:
   - Empty string values become NULL in the database
   - Missing attributes are stored as NULL
   - Very long attribute values are supported

## Data Privacy

All test data uses completely fictional identifiers:
- User IDs: `test-user-abc123`, `test-haiku-user456`
- Emails: `testuser@example.org`, `haiku-test@example.org`
- Organization IDs: `test-org-ghi789`, `test-haiku-org789`
- Account UUIDs: `test-account-uuid-xyz`

No real production user data is included in any test files.

## Testing Best Practices

When adding new tests:
1. Clean up test data in `beforeEach` using prefixed IDs (e.g., "test-", "edge-", "behavior-")
2. Test both positive and negative cases
3. Verify database state after operations
4. Consider edge cases like missing data, malformed input, and concurrent operations
5. Document expected vs actual behavior when they differ
6. Use only fictional test data - never real user identifiers