#!/bin/bash

# Test message insertion through the OTLP metrics endpoint

echo "Testing message metrics with proper session_id..."

# First create a session
curl -X POST http://localhost:3000/v1/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "resourceMetrics": [{
      "resource": {
        "attributes": [
          {"key": "session_id", "value": {"stringValue": "test-session-456"}},
          {"key": "user_id", "value": {"stringValue": "test-user-123"}},
          {"key": "user.email", "value": {"stringValue": "test@example.com"}},
          {"key": "organization.id", "value": {"stringValue": "test-org-123"}}
        ]
      },
      "scopeMetrics": [{
        "metrics": [{
          "name": "claude_code.session.count",
          "sum": {
            "dataPoints": [{
              "asDouble": 1,
              "timeUnixNano": "'$(date +%s%N)'",
              "attributes": [
                {"key": "model", "value": {"stringValue": "claude-3-sonnet"}}
              ]
            }]
          }
        }]
      }]
    }]
  }'

echo -e "\n\nSending message cost metric..."

# Send a message cost metric
curl -X POST http://localhost:3000/v1/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "resourceMetrics": [{
      "resource": {
        "attributes": [
          {"key": "session_id", "value": {"stringValue": "test-session-456"}}
        ]
      },
      "scopeMetrics": [{
        "metrics": [{
          "name": "conversation.message.cost",
          "sum": {
            "dataPoints": [{
              "asDouble": 0.05,
              "timeUnixNano": "'$(date +%s%N)'",
              "attributes": [
                {"key": "message_id", "value": {"stringValue": "test-msg-002"}},
                {"key": "conversation_id", "value": {"stringValue": "test-conv-002"}},
                {"key": "role", "value": {"stringValue": "assistant"}},
                {"key": "model", "value": {"stringValue": "claude-3-sonnet"}}
              ]
            }]
          }
        }]
      }]
    }]
  }'

echo -e "\n\nSending message tokens metric..."

# Send a message tokens metric
curl -X POST http://localhost:3000/v1/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "resourceMetrics": [{
      "resource": {
        "attributes": []
      },
      "scopeMetrics": [{
        "metrics": [{
          "name": "conversation.message.tokens",
          "sum": {
            "dataPoints": [{
              "asDouble": 1500,
              "timeUnixNano": "'$(date +%s%N)'",
              "attributes": [
                {"key": "message_id", "value": {"stringValue": "test-msg-002"}},
                {"key": "type", "value": {"stringValue": "input"}}
              ]
            }]
          }
        }]
      }]
    }]
  }'

echo -e "\n\nChecking messages..."
bun check-messages.ts

echo -e "\n\nChecking stats endpoint..."
curl -s http://localhost:3000/stats | jq .sessions.total_messages

echo -e "\n\nDone!"