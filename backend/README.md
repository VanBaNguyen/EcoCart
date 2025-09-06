Environmentally Friendly Search Backend (Flask)

Setup

- Ensure you have Python 3.9+ installed.
- From this directory:

```
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Configure your API key

- Export your OpenAI API key (or create a .env file):

```
export OPENAI_API_KEY=YOUR_KEY_HERE
# optional: pick a lighter, low-reasoning model (default is gpt-4o-mini)
export OPENAI_MODEL=gpt-4o-mini
```

Run the server

```
python app.py
# or specify a port
PORT=5057 python app.py
```

Test the endpoint

```
curl -sS -X POST http://localhost:5057/search \
  -H "Content-Type: application/json" \
  -d '{"query": "dish soap", "limit": 5}' | jq
```

Search for alternatives to a specific product

```
curl -sS -X POST http://localhost:5057/search \
  -H "Content-Type: application/json" \
  -d '{
    "product": {
      "name": "Fidqiog 150 Pcs Plastic Straws, Flexible Bendy Straws",
      "link": "https://www.amazon.ca/Fidqiog-Flexible-Slushies-Smoothies-Disposable/dp/B0F4K9XWBS?th=1"
    },
    "limit": 5
  }' | jq
```

Judge environmental impact for a specific product (Low|Medium|High)

```
curl -sS -X POST http://localhost:5057/judge \
  -H "Content-Type: application/json" \
  -d '{
    "product": {
      "name": "Fidqiog 150 Pcs Plastic Straws, Flexible Bendy Straws",
      "link": "https://www.amazon.ca/Fidqiog-Flexible-Slushies-Smoothies-Disposable/dp/B0F4K9XWBS?th=1"
    }
  }' | jq
```

Search always judges first when a product is provided (skips alternatives when impact is Low)

```
curl -sS -X POST http://localhost:5057/search \
  -H "Content-Type: application/json" \
  -d '{
    "product": {
      "name": "Fidqiog 150 Pcs Plastic Straws, Flexible Bendy Straws",
      "link": "https://www.amazon.ca/Fidqiog-Flexible-Slushies-Smoothies-Disposable/dp/B0F4K9XWBS?th=1"
    },
    "limit": 5
  }' | jq
```

Response shape

```
{
  "query": "dish soap",
  "results": [
    { "name": "Brand or Product Name", "url": "https://example.com/...", "tld": "com" }
  ]
}

For alternatives requests, the response may also include the original product context:

```
{
  "product": {
    "name": "Fidqiog 150 Pcs Plastic Straws, Flexible Bendy Straws",
    "link": "https://www.amazon.ca/Fidqiog-Flexible-Slushies-Smoothies-Disposable/dp/B0F4K9XWBS?th=1"
  },
  "impact": "Medium",
  "ecoscore": 3.2,
  "results": [
    { "name": "Reusable Metal Straw Set", "url": "https://brand.example/product/metal-straw", "tld": "example" }
  ]
}
```
```

Notes

- CORS is enabled for all origins to make it easy to call from a browser extension.
- The server logs the prompt, the raw OpenAI response, and the extracted results to the terminal.
- If the model doesn't return strict JSON, the server falls back to extracting URLs from text.
- Defaults to a low-reasoning model (gpt-4o-mini). You can override per request by sending {"model": "..."}.
- On 429 rate limits, the server auto-retries once with gpt-4o-mini.

