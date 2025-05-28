#!/bin/bash

# Test message insertion through the OTLP metrics endpoint

echo "Testing message metrics..."

# Send a message cost metric
curl -X POST http://localhost:3000/v1/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "resourceMetrics": [{
      "resource": {
        "attributes": [
          {"key": "session_id", "value": {"stringValue": "test-session-123"}}
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
                {"key": "message_id", "value": {"stringValue": "test-msg-001"}},
                {"key": "conversation_id", "value": {"stringValue": "test-conv-001"}},
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
                {"key": "message_id", "value": {"stringValue": "test-msg-001"}},
                {"key": "type", "value": {"stringValue": "input"}}
              ]
            }]
          }
        }]
      }]
    }]
  }'

echo -e "\n\nChecking stats endpoint..."
curl -s http://localhost:3000/stats | jq .sessions.total_messages

echo -e "\n\nDone!"