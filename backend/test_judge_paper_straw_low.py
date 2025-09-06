import json
import sys
from typing import Any, Dict

import requests


def main() -> int:
    host = "http://localhost:5057"
    url = f"{host}/judge"

    product_name = (
        "YAOSHENG Paper Drinking Straws 100 Pack Yellow Striped Paper Straws for Party Supplies,Birthday,"
        "Wedding,Bridal/Baby Shower,Juice, Shakes,Smoothies,Cocktail (Yellow)"
    )
    product_link = "https://www.amazon.ca/YAOSHENG-drinking-Supplies-Birthday-Smoothies/dp/B09Y866VFC?s=kitchen"

    payload: Dict[str, Any] = {
        "product": {"name": product_name, "link": product_link},
        "model": "gpt-4o-mini",
    }

    print("=== Test: /judge should classify paper straws as Low impact ===")
    print("POST", url)
    print(json.dumps(payload, indent=2))

    try:
        resp = requests.post(url, json=payload, timeout=60)
    except Exception as e:
        print("Request failed:", e)
        return 2

    print("Status:", resp.status_code)
    print("Body:")
    print(resp.text)

    try:
        data = resp.json()
    except Exception:
        print("Body was not JSON.")
        return 1

    impact = (data or {}).get("impact")
    if impact == "Low":
        print("RESULT: PASS (impact == Low)")
        return 0

    print(f"RESULT: FAIL (expected Low, got {impact!r})")
    return 1


if __name__ == "__main__":
    sys.exit(main())


