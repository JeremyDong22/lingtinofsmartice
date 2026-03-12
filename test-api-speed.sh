#!/bin/bash

# API Performance Test Script
# Tests actual API endpoint response times

API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:3001}"
TOKEN="${TEST_TOKEN}"

if [ -z "$TOKEN" ]; then
  echo "Error: TEST_TOKEN environment variable is required"
  echo "Usage: TEST_TOKEN='your-jwt-token' bash test-api-speed.sh"
  exit 1
fi

echo "============================================================"
echo "API Performance Test"
echo "============================================================"
echo "API URL: $API_URL"
echo "Date: $(date)"
echo ""

# Get restaurant ID from token (decode JWT)
RESTAURANT_ID=$(echo $TOKEN | cut -d'.' -f2 | base64 -d 2>/dev/null | grep -o '"restaurantId":"[^"]*"' | cut -d'"' -f4)
echo "Restaurant ID: $RESTAURANT_ID"
echo ""

TODAY=$(date +%Y-%m-%d)
SEVEN_DAYS_AGO=$(date -v-7d +%Y-%m-%d 2>/dev/null || date -d '7 days ago' +%Y-%m-%d)

test_endpoint() {
  local name="$1"
  local url="$2"
  
  echo -n "Testing $name... "
  local start=$(date +%s%3N)
  local response=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" "$url")
  local end=$(date +%s%3N)
  local duration=$((end - start))
  local http_code=$(echo "$response" | tail -1)
  
  if [ "$http_code" = "200" ]; then
    echo "✓ ${duration}ms"
  else
    echo "✗ ${duration}ms (HTTP $http_code)"
  fi
  
  echo "$duration"
}

echo "Running tests..."
echo ""

# Test 1: Coverage
t1=$(test_endpoint "Coverage Stats" "$API_URL/api/dashboard/coverage?restaurant_id=$RESTAURANT_ID&start_date=$TODAY&end_date=$TODAY")

# Test 2: Sentiment Summary (today)
t2=$(test_endpoint "Sentiment Summary (today)" "$API_URL/api/dashboard/sentiment-summary?restaurant_id=$RESTAURANT_ID&start_date=$TODAY&end_date=$TODAY")

# Test 3: Sentiment Summary (yesterday)
YESTERDAY=$(date -v-1d +%Y-%m-%d 2>/dev/null || date -d '1 day ago' +%Y-%m-%d)
t3=$(test_endpoint "Sentiment Summary (yesterday)" "$API_URL/api/dashboard/sentiment-summary?restaurant_id=$RESTAURANT_ID&start_date=$YESTERDAY&end_date=$YESTERDAY")

# Test 4: Suggestions (7 days)
t4=$(test_endpoint "Suggestions (7 days)" "$API_URL/api/dashboard/suggestions?restaurant_id=$RESTAURANT_ID&days=7")

# Test 5: Action Items
t5=$(test_endpoint "Action Items" "$API_URL/api/action-items?restaurant_id=$RESTAURANT_ID&date=$TODAY")

# Test 6: Meeting Records
t6=$(test_endpoint "Meeting Records" "$API_URL/api/meeting/today?restaurant_id=$RESTAURANT_ID&date=$TODAY")

echo ""
echo "============================================================"
echo "Summary"
echo "============================================================"

total=$((t1 + t2 + t3 + t4 + t5 + t6))
avg=$((total / 6))

echo "Total time: ${total}ms"
echo "Average: ${avg}ms"
echo ""
echo "Individual times:"
echo "  1. Coverage: ${t1}ms"
echo "  2. Sentiment (today): ${t2}ms"
echo "  3. Sentiment (yesterday): ${t3}ms"
echo "  4. Suggestions: ${t4}ms"
echo "  5. Action Items: ${t5}ms"
echo "  6. Meeting Records: ${t6}ms"
echo ""
echo "============================================================"
