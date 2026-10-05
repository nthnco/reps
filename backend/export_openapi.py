"""Print the API's OpenAPI schema as JSON. Used by the frontend's `npm run gen:api`."""

import json

from app.main import app

print(json.dumps(app.openapi(), indent=2))
