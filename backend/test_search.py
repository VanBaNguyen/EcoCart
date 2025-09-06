import argparse
import json
import sys
from typing import Any, Dict

import requests


def main() -> int:
    parser = argparse.ArgumentParser(description="Test client for the Env-Friendly Search backend")
    parser.add_argument("--host", default="http://localhost:5057", help="Backend host base URL")
    parser.add_argument("--query", default="", help="Search topic/query. If omitted, uses --product-* inputs.")
    parser.add_argument("--limit", type=int, default=5, help="Max results to request")
    parser.add_argument("--product-name", default="", help="Original product name for alternatives search")
    parser.add_argument("--product-link", default="", help="Original product link for alternatives search")
    parser.add_argument("--timeout", type=float, default=60.0, help="HTTP timeout in seconds")
    parser.add_argument("--model", default="", help="Optional model override, e.g. gpt-4o-mini")
    args = parser.parse_args()

    url = f"{args.host}/search"
    payload: Dict[str, Any] = {"limit": args.limit}
    if args.query:
        payload["query"] = args.query
    if args.product_name or args.product_link:
        payload["product"] = {"name": args.product_name, "link": args.product_link}
    if args.model:
        payload["model"] = args.model

    print("=== Sending request ===")
    print(f"POST {url}")
    print(json.dumps(payload, indent=2))

    try:
        resp = requests.post(url, json=payload, timeout=args.timeout)
    except Exception as e:
        print("Request failed:", e)
        return 2

    print("=== Response status ===")
    print(resp.status_code)
    print("=== Response headers ===")
    for k, v in resp.headers.items():
        print(f"{k}: {v}")

    print("=== Raw body ===")
    print(resp.text)

    try:
        data = resp.json()
    except Exception:
        print("Body is not valid JSON.")
        return 1

    print("=== Parsed results ===")
    results = data.get("results", []) if isinstance(data, dict) else []
    if not results:
        print("No results field or it is empty.")
        return 0

    for idx, item in enumerate(results, start=1):
        name = item.get("name", "")
        url_item = item.get("url", "")
        tld = item.get("tld", "")
        print(f"{idx}. {name} - {url_item} (tld: {tld})")

    return 0


if __name__ == "__main__":
    sys.exit(main())


