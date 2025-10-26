#!/bin/bash
# Generate TypeScript types from FastAPI OpenAPI schema

API_URL="${VITE_API_URL:-http://localhost:8001}"
OUTPUT_FILE="src/lib/types/api.generated.ts"

echo "🔄 Generating API types from ${API_URL}/openapi.json..."

# Check if backend is running
if ! curl -s -f "${API_URL}/healthz" > /dev/null 2>&1; then
  echo "❌ Error: Backend is not running at ${API_URL}"
  echo "   Please start the backend server first:"
  echo "   cd apps/backend && python main.py"
  exit 1
fi

# Generate types
pnpm openapi-typescript "${API_URL}/openapi.json" -o "${OUTPUT_FILE}"

if [ $? -eq 0 ]; then
  echo "✅ API types generated successfully at ${OUTPUT_FILE}"
else
  echo "❌ Failed to generate API types"
  exit 1
fi
