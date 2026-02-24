#!/bin/bash

# Generate test data with current timestamp

BASE_URL="http://localhost:5000"
SESSION_ID=$(uuidgen)
NOW=$(date +%s)000

echo "Testing with SessionID: $SESSION_ID"
echo "Timestamp: $NOW"
echo ""

# Step 1: Create visitor record with /track
echo "Step 1: Creating visitor record with /track..."
curl -X POST $BASE_URL/track \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"userAgent\": \"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\",
    \"country\": \"United States\",
    \"city\": \"New York\",
    \"countryCode\": \"US\",
    \"publicIp\": \"192.168.1.1\",
    \"isp\": \"Verizon\",
    \"pageVisited\": \"/\",
    \"timestamp\": $NOW
  }"

echo ""
echo ""

# Step 2: Update time spent with /log/time (50 times for testing)
echo "Step 2: Updating time spent 50 times..."
for i in {1..50}; do
  curl -X POST $BASE_URL/log/time \
    -H "Content-Type: application/json" \
    -d "{
      \"sessionId\": \"$SESSION_ID\",
      \"timeSpentSeconds\": 30
    }" > /dev/null 2>&1
  echo -n "."
done

echo ""
echo ""
echo "✅ Test data created successfully!"
echo "SessionID: $SESSION_ID"
echo ""
echo "Now visit http://localhost:5000 and check:"
echo "- 24H tab (should show data)"
echo "- 7D tab (should show data)"
echo "- 30D tab (should show data)"
