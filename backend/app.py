import os
import json
import logging
import re
import time
from typing import Any, Dict, List, Tuple
from urllib.parse import urlparse, urljoin

from flask import Flask, jsonify, request, Response
from flask_cors import CORS
from dotenv import load_dotenv
from openai import OpenAI, OpenAIError
import tldextract
import requests
from bs4 import BeautifulSoup


load_dotenv()

logging.basicConfig(level=logging.DEBUG, format="%(asctime)s %(levelname)s %(name)s - %(message)s")
logger = logging.getLogger("env-friendly-search")

app = Flask(__name__)
# Enable CORS for all routes. The previous pattern r"/**" did not match in Flask-CORS.
CORS(app)


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response

OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-5")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

client = OpenAI(timeout=30.0)


def compute_top_level_domain(url: str) -> str:
    try:
        extracted = tldextract.extract(url)
        return extracted.suffix or ""
    except Exception as e:
        logger.exception("Failed computing TLD for url=%s: %s", url, e)
        return ""


def is_amazon_url(url: str) -> bool:
    try:
        extracted = tldextract.extract(url)
        return (extracted.domain or "").lower() == "amazon"
    except Exception:
        return False


def normalize_name_from_url(url: str) -> str:
    try:
        parsed = urlparse(url)
        hostname = parsed.hostname or ""
        if hostname:
            host_without_www = hostname.split(".", 1)[-1] if hostname.startswith("www.") else hostname
            base = host_without_www.rsplit(".", 1)[0]
            return base.replace("-", " ").replace("_", " ").title()
        return url
    except Exception:
        return url


def extract_items_from_text(text: str) -> List[Dict[str, str]]:
    logger.debug("Attempting to parse model output as JSON.")
    try:
        data = json.loads(text)
        if isinstance(data, dict) and "results" in data and isinstance(data["results"], list):
            items = []
            for item in data["results"]:
                name = str(item.get("name", "")).strip()
                url = str(item.get("url", "")).strip()
                price_val = item.get("price")
                price = str(price_val).strip() if price_val is not None else ""
                if not url:
                    continue
                if not name:
                    name = normalize_name_from_url(url)
                entry = {"name": name, "url": url}
                if price:
                    entry["price"] = price
                items.append(entry)
            if items:
                return items
        if isinstance(data, list):
            items = []
            for item in data:
                if isinstance(item, dict):
                    name = str(item.get("name", "")).strip()
                    url = str(item.get("url", "")).strip()
                    price_val = item.get("price")
                    price = str(price_val).strip() if price_val is not None else ""
                    if not url:
                        continue
                    if not name:
                        name = normalize_name_from_url(url)
                    entry = {"name": name, "url": url}
                    if price:
                        entry["price"] = price
                    items.append(entry)
            if items:
                return items
    except Exception as e:
        logger.debug("JSON parsing failed, will fall back to regex. Error: %s", e)

    logger.debug("Falling back to regex URL extraction.")
    url_pattern = re.compile(r"https?://[^\s\)\]]+")
    urls = url_pattern.findall(text or "")
    dedup_urls = []
    seen = set()
    for u in urls:
        if u not in seen:
            seen.add(u)
            dedup_urls.append(u)
    items = [{"name": normalize_name_from_url(u), "url": u} for u in dedup_urls]
    return items


def fetch_og_image(target_url: str) -> str:
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9"
        }
        resp = requests.get(target_url, headers=headers, timeout=6)
        if not resp.ok:
            return ""
        html = resp.text or ""
        soup = BeautifulSoup(html, "html.parser")
        # Try Open Graph first
        og = soup.find("meta", attrs={"property": "og:image"})
        if og and og.get("content"):
            return urljoin(target_url, og.get("content"))
        og2 = soup.find("meta", attrs={"property": "og:image:secure_url"})
        if og2 and og2.get("content"):
            return urljoin(target_url, og2.get("content"))
        tw = soup.find("meta", attrs={"name": "twitter:image"})
        if tw and tw.get("content"):
            return urljoin(target_url, tw.get("content"))
        # Amazon-specific extraction (first product image)
        if is_amazon_url(target_url):
            # Common product image element
            landing = soup.select_one("img#landingImage")
            if landing:
                # Prefer high-res hint
                hires = landing.get("data-old-hires")
                if hires:
                    return urljoin(target_url, hires)
                dyn = landing.get("data-a-dynamic-image")
                if dyn:
                    try:
                        data = json.loads(dyn)
                        if isinstance(data, dict) and data:
                            # Pick the first URL key
                            first_key = next(iter(data.keys()))
                            if first_key:
                                return urljoin(target_url, first_key)
                    except Exception:
                        # Attempt to normalize quotes and extract first URL
                        try:
                            norm = dyn.replace("&quot;", '"')
                            data = json.loads(norm)
                            if isinstance(data, dict) and data:
                                first_key = next(iter(data.keys()))
                                if first_key:
                                    return urljoin(target_url, first_key)
                        except Exception:
                            m = re.search(r"https?://[^\"]+", dyn)
                            if m:
                                return urljoin(target_url, m.group(0))
                srcset = landing.get("srcset")
                if srcset:
                    # Choose the last (highest density) URL
                    parts = [p.strip() for p in srcset.split(',') if p.strip()]
                    if parts:
                        last = parts[-1].split(' ')[0]
                        if last:
                            return urljoin(target_url, last)
                src = landing.get("src")
                if src:
                    return urljoin(target_url, src)
            # Alternate wrappers
            wrap_img = soup.select_one("#imgTagWrapperId img")
            if wrap_img:
                # Try srcset first
                w_srcset = wrap_img.get("srcset")
                if w_srcset:
                    parts = [p.strip() for p in w_srcset.split(',') if p.strip()]
                    if parts:
                        last = parts[-1].split(' ')[0]
                        if last:
                            return urljoin(target_url, last)
                if wrap_img.get("src"):
                    return urljoin(target_url, wrap_img.get("src"))
            book_img = soup.select_one("img#imgBlkFront")
            if book_img and book_img.get("src"):
                return urljoin(target_url, book_img.get("src"))
        # Fallback to first image on page
        img = soup.find("img")
        if img and img.get("src"):
            return urljoin(target_url, img.get("src"))
        return ""
    except Exception as e:
        logger.debug("OG image fetch failed for %s: %s", target_url, e)
        return ""


def extract_amazon_price(target_url: str) -> str:
    try:
        if not is_amazon_url(target_url):
            return ""
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
        }
        resp = requests.get(target_url, headers=headers, timeout=6)
        if not resp.ok:
            return ""
        soup = BeautifulSoup(resp.text or "", "html.parser")
        # Try known price selectors
        sel_candidates = [
            "#corePrice_feature_div span.a-offscreen",
            "#apex_desktop span.a-offscreen",
            "#priceblock_ourprice",
            "#priceblock_dealprice",
            "#priceblock_saleprice",
        ]
        for sel in sel_candidates:
            el = soup.select_one(sel)
            if el and el.get_text(strip=True):
                return el.get_text(strip=True)
        # Fallback regex like $12.99
        m = re.search(r"[$€£]\s?\d+[\.,]?\d*(?:\.\d{2})?", resp.text or "")
        if m:
            return m.group(0)
        return ""
    except Exception as e:
        logger.debug("Price extract failed for %s: %s", target_url, e)
        return ""


@app.route("/image-proxy", methods=["GET"])
def image_proxy() -> Tuple[bytes, int]:
    target_url = request.args.get("url", type=str, default="").strip()
    if not target_url:
        return jsonify({"error": "bad_request", "message": "url is required"}), 400
    if not target_url.lower().startswith(("http://", "https://")):
        return jsonify({"error": "bad_request", "message": "unsupported scheme"}), 400
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
        }
        r = requests.get(target_url, headers=headers, timeout=8)
        if not r.ok:
            return jsonify({"error": "upstream_error", "status": r.status_code}), 502
        content_type = r.headers.get("Content-Type", "image/jpeg")
        resp = Response(r.content, content_type=content_type)
        resp.headers["Cache-Control"] = "public, max-age=86400"
        resp.headers["Access-Control-Allow-Origin"] = "*"
        resp.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        resp.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
        return resp, 200
    except Exception as e:
        logger.debug("image-proxy failed for %s: %s", target_url, e)
        return jsonify({"error": "proxy_error", "message": str(e)}), 502


@app.route("/extract-image", methods=["GET"])
def extract_image() -> Tuple[str, int]:
    target_url = request.args.get("url", type=str, default="").strip()
    if not target_url:
        return jsonify({"error": "bad_request", "message": "url is required"}), 400
    img_url = fetch_og_image(target_url)
    result: Dict[str, Any] = {"image": img_url}
    if img_url:
        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
                "Referer": target_url,
            }
            r = requests.get(img_url, headers=headers, timeout=8)
            if r.ok and r.content:
                ctype = r.headers.get("Content-Type", "image/jpeg")
                import base64
                b64 = base64.b64encode(r.content).decode("ascii")
                result["image_data_url"] = f"data:{ctype};base64,{b64}"
        except Exception as e:
            logger.debug("extract-image data url build failed for %s: %s", img_url, e)
    return jsonify(result), 200


def build_prompt(user_query: str, max_results: int) -> str:
    base_instruction = (
        "Use web_search to find environmentally friendlier product options for the user's topic.\n"
        "Focus on credible official product or brand pages, sustainability certifications, and lifecycle considerations.\n"
        f"Return up to {max_results} distinct results.\n"
        "Include an approximate price with currency where available.\n"
        "Produce ONLY JSON with this shape exactly:\n"
        '{ "results": [ { "name": "Product or Brand Name", "url": "https://...", "price": "$12.99" } ] }\n'
        "Do not include explanations or markdown, only valid JSON."
    )
    topic_line = f"User topic: {user_query.strip() or 'environmentally friendlier everyday products'}"
    return f"{topic_line}\n\n{base_instruction}"


def build_alternatives_prompt(product_name: str, product_link: str, max_results: int) -> str:
    name_line = f"Original product: {product_name.strip()}" if product_name else "Original product: (unknown name)"
    link_line = f"Original link: {product_link.strip()}" if product_link else "Original link: (none provided)"
    base_instruction = (
        "Using web_search, find environmentally friendlier alternatives to the given product.\n"
        "Prioritize durable, reusable, recyclable, compostable, or certified-sustainable materials (e.g., paper, metal, bamboo, glass, silicone when appropriate).\n"
        "Only search and return results from Amazon retail domains: amazon.com, amazon.ca, amazon.co.uk, amazon.de, amazon.fr, amazon.it, amazon.es, amazon.co.jp, amazon.in, amazon.com.au.\n"
        "Use site:amazon.* operators in your web_search queries to constrain results.\n"
        f"Return up to {max_results} distinct alternatives.\n"
        "Include an approximate price with currency where available.\n"
        "Produce ONLY JSON with this shape exactly:\n"
        '{ "results": [ { "name": "Product or Brand Name", "url": "https://...", "price": "$12.99" } ] }\n'
        "Do not include explanations or markdown, only valid JSON."
    )
    return f"{name_line}\n{link_line}\n\n{base_instruction}"


def build_judge_prompt(product_name: str, product_link: str) -> str:
    name_line = f"Product: {product_name.strip()}" if product_name else "Product: (unknown name)"
    link_line = f"Link: {product_link.strip()}" if product_link else "Link: (none provided)"
    instruction = (
        "Rate the product's environmental friendliness with a single Ecoscore between 1.0 and 5.0 (decimals allowed).\n"
        "Use this rubric strictly:\n"
        "1.0–1.9: predominantly single-use plastic; non-recyclable; no credible sustainability claims.\n"
        "2.0–2.9: disposable plastic-heavy; limited recyclability or greenwashing; short lifespan.\n"
        "3.0–3.9: mixed/unknown materials; partial recyclability; some reuse potential; average footprint.\n"
        "4.0–4.4: largely sustainable materials (paper, glass, silicone), reusable or recyclable; credible claims.\n"
        "4.5–5.0: highly sustainable (durable metal/bamboo/glass, certified compostable), long lifespan, minimal waste.\n"
        "Consider materials, reusability, recyclability/compostability, lifecycle/durability, packaging, and certifications.\n"
        "If the product appears to be paper drinking straws, ensure Ecoscore ≥ 4.5 barring contradictory evidence.\n"
        "Respond ONLY with: Ecoscore: <number> (e.g., Ecoscore: 4.5). No explanations."
    )
    return f"{name_line}\n{link_line}\n\n{instruction}"


def infer_material_hint(product_name: str, product_link: str) -> str:
    text = f"{product_name} {product_link}".lower()
    # Simple material hints
    if "paper" in text and "straw" in text:
        return "paper_straw"
    if "stainless" in text or "metal" in text:
        return "metal"
    if "bamboo" in text:
        return "bamboo"
    if "glass" in text:
        return "glass"
    if "silicone" in text:
        return "silicone"
    if "pla" in text or "bioplastic" in text:
        return "pla"
    if "plastic" in text:
        return "plastic"
    return ""


def parse_impact_label(text: str) -> str:
    if not text:
        return "Medium"
    lowered = text.lower()
    if "low" in lowered:
        return "Low"
    if "high" in lowered:
        return "High"
    if "medium" in lowered:
        return "Medium"
    # Last token heuristic
    tokens = [t.strip().lower() for t in re.split(r"[^a-zA-Z]+", lowered) if t.strip()]
    for t in tokens:
        if t in ("low", "medium", "high"):
            return t.capitalize()
    return "Medium"


def parse_ecoscore_from_text(text: str) -> float:
    try:
        # Look for a number between 1 and 5 (optionally with decimals). Prioritize patterns near 'ecoscore'.
        if not text:
            return 0.0
        lowered = text.lower()
        near_score = re.search(r"ecoscore\D*([1-5](?:\.\d+)?)", lowered)
        if near_score:
            val = float(near_score.group(1))
            if 1.0 <= val <= 5.0:
                return val
        # Generic number search
        for match in re.finditer(r"\b([1-5](?:\.\d+)?)\b", lowered):
            try:
                val = float(match.group(1))
                if 1.0 <= val <= 5.0:
                    return val
            except Exception:
                continue
    except Exception:
        pass
    return 0.0


def ecoscore_from_impact(impact: str) -> float:
    # Slightly stricter baseline mapping
    mapping = {"Low": 4.2, "Medium": 2.8, "High": 1.3}
    return mapping.get(impact, 3.0)


def apply_material_heuristics_to_ecoscore(score: float, material_hint: str) -> float:
    # Slightly stricter adjustments
    adjusted = score
    if material_hint == "paper_straw":
        adjusted = max(adjusted, 4.2)
    elif material_hint == "metal":
        adjusted = max(adjusted, 3.8)
    elif material_hint == "bamboo":
        adjusted = max(adjusted, 4.4)
    elif material_hint == "glass":
        adjusted = max(adjusted, 3.8)
    elif material_hint == "silicone":
        adjusted = max(adjusted, 3.2)
    elif material_hint == "pla":
        adjusted = min(max(adjusted, 2.4), 3.0)
    elif material_hint == "plastic":
        adjusted = min(adjusted, 1.9)
    if adjusted < 1.0:
        adjusted = 1.0
    if adjusted > 5.0:
        adjusted = 5.0
    return round(adjusted, 2)


@app.route("/health", methods=["GET"])
def health() -> Tuple[str, int]:
    return jsonify({"ok": True}), 200


@app.route("/search", methods=["POST"])
def search() -> Tuple[str, int]:
    payload = request.get_json(silent=True) or {}
    if not OPENAI_API_KEY:
        logger.error("Missing OPENAI_API_KEY. Refusing to call OpenAI.")
        return jsonify({
            "error": "missing_api_key",
            "message": "OPENAI_API_KEY is not set on the server."
        }), 400
    user_query = str(payload.get("query", "")).strip()
    max_results = int(payload.get("limit", 5))

    product = payload.get("product") if isinstance(payload.get("product"), dict) else {}
    product_name = str(product.get("name", "")).strip() if product else ""
    product_link = str(product.get("link", product.get("url", ""))).strip() if product else ""

    # Always judge first if a product is provided
    impact_label: str = ""
    if (product_name or product_link):
        judge_prompt = build_judge_prompt(product_name, product_link)

        request_model = str(payload.get("model", "")).strip() or OPENAI_MODEL

        def call_openai(selected_model: str):
            return client.responses.create(
                model=selected_model,
                input=judge_prompt,
            )

        try:
            judge_resp = call_openai(request_model)
        except OpenAIError as oe:
            message_text = str(oe)
            logger.warning("OpenAI judge error with model %s: %s", request_model, message_text)
            is_rate_limited = ("429" in message_text) or ("rate limit" in message_text.lower())
            if is_rate_limited and request_model != "gpt-5":
                logger.info("Judge retry with fallback model gpt-5 after backoff...")
                time.sleep(1.5)
                try:
                    judge_resp = call_openai("gpt-5")
                except Exception as e2:
                    logger.exception("Judge fallback failed: %s", e2)
                    return jsonify({"error": "openai_api_error", "message": str(e2)}), 502
            else:
                return jsonify({"error": "openai_api_error", "message": message_text}), 502
        except Exception as e:
            logger.exception("Unexpected error calling OpenAI for judge: %s", e)
            return jsonify({"error": "server_error", "message": str(e)}), 500

        try:
            raw_dump_j = judge_resp.model_dump_json(indent=2)  # type: ignore[attr-defined]
            print("=== OpenAI raw judge response (model_dump_json) ===")
            print(raw_dump_j)
        except Exception:
            print("=== OpenAI judge response (repr) ===")
            print(repr(judge_resp))

        judge_text = getattr(judge_resp, "output_text", None)
        if judge_text is None:
            try:
                judge_text = judge_resp.output[0].content[0].text  # type: ignore[attr-defined]
            except Exception:
                judge_text = ""
        print("=== OpenAI judge output_text ===")
        print(judge_text)
        impact_label = parse_impact_label(judge_text or "")
        ecoscore_val = parse_ecoscore_from_text(judge_text or "")
        # If the model didn't return a numeric ecoscore, fall back to label mapping only
        if ecoscore_val <= 0.0:
            ecoscore_val = ecoscore_from_impact(impact_label)

        # Early return if ecoscore is good enough
        if ecoscore_val >= 3.0:
            result: Dict[str, Any] = {
                "product": {"name": product_name, "link": product_link},
                "impact": impact_label,
                "ecoscore": ecoscore_val,
                "results": []
            }
            return jsonify(result), 200

    # Build alternatives prompt if we have a product, else generic topic prompt
    if product_name or product_link:
        prompt = build_alternatives_prompt(product_name, product_link, max_results)
    else:
        prompt = build_prompt(user_query, max_results)

    logger.info("Incoming /search request")
    logger.debug("Request payload: %s", json.dumps(payload, indent=2))
    logger.debug("Prompt:\n%s", prompt)

    # Choose model: per-request override or default
    request_model = str(payload.get("model", "")).strip() or OPENAI_MODEL

    def call_openai(selected_model: str):
        return client.responses.create(
            model=selected_model,
            tools=[{"type": "web_search"}],
            input=prompt,
        )

    try:
        response = call_openai(request_model)
    except OpenAIError as oe:
        message_text = str(oe)
        logger.warning("OpenAI error with model %s: %s", request_model, message_text)
        # Fallback on rate limit to low-cost model if not already using it
        is_rate_limited = ("429" in message_text) or ("rate limit" in message_text.lower())
        if is_rate_limited and request_model != "gpt-5":
            logger.info("Retrying with fallback model gpt-5 after brief backoff...")
            time.sleep(1.5)
            try:
                response = call_openai("gpt-5")
            except Exception as e2:
                logger.exception("Fallback model also failed: %s", e2)
                return jsonify({"error": "openai_api_error", "message": str(e2)}), 502
        else:
            return jsonify({"error": "openai_api_error", "message": message_text}), 502
    except Exception as e:
        logger.exception("Unexpected error calling OpenAI: %s", e)
        return jsonify({"error": "server_error", "message": str(e)}), 500

    try:
        raw_dump = response.model_dump_json(indent=2)  # type: ignore[attr-defined]
        print("=== OpenAI raw response (model_dump_json) ===")
        print(raw_dump)
    except Exception:
        print("=== OpenAI response (repr) ===")
        print(repr(response))

    output_text = getattr(response, "output_text", None)
    if output_text is None:
        try:
            output_text = response.output[0].content[0].text  # type: ignore[attr-defined]
        except Exception:
            output_text = ""

    print("=== OpenAI output_text ===")
    print(output_text)

    items = extract_items_from_text(output_text or "")

    # If searching for alternatives to a specific product, constrain to Amazon domains and limit to requested max_results
    if product_name or product_link:
        items = [it for it in items if is_amazon_url(it.get("url", ""))]
        if max_results > 0:
            items = items[:max_results]

    for item in items:
        item["tld"] = compute_top_level_domain(item.get("url", ""))
        # Enrich with preview image if possible
        if item.get("url"):
            preview = fetch_og_image(item["url"])
            if preview:
                item["image"] = preview
            # Improve price accuracy for Amazon links
            if is_amazon_url(item.get("url", "")):
                accurate = extract_amazon_price(item["url"]) or ""
                if accurate:
                    item["price"] = accurate
                # Also try to inline as data URL to avoid client-side loading issues
                try:
                    headers = {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
                    }
                    r = requests.get(preview, headers=headers, timeout=8)
                    if r.ok and r.content:
                        ctype = r.headers.get("Content-Type", "image/jpeg")
                        import base64
                        b64 = base64.b64encode(r.content).decode("ascii")
                        item["image_data_url"] = f"data:{ctype};base64,{b64}"
                except Exception as _e:
                    logger.debug("Failed building data URL for %s: %s", preview, _e)

    logger.debug("Extracted items: %s", json.dumps(items, indent=2))

    result: Dict[str, Any] = {"results": items}
    if user_query:
        result["query"] = user_query
    if product_name or product_link:
        result["product"] = {"name": product_name, "link": product_link}
    if impact_label:
        result["impact"] = impact_label
    # Include ecoscore if we computed it in the judge step
    if 'ecoscore_val' in locals():
        result["ecoscore"] = ecoscore_val
    return jsonify(result), 200


@app.route("/judge", methods=["POST"])
def judge() -> Tuple[str, int]:
    payload = request.get_json(silent=True) or {}
    if not OPENAI_API_KEY:
        logger.error("Missing OPENAI_API_KEY. Refusing to call OpenAI.")
        return jsonify({
            "error": "missing_api_key",
            "message": "OPENAI_API_KEY is not set on the server."
        }), 400

    product = payload.get("product") if isinstance(payload.get("product"), dict) else {}
    product_name = str(product.get("name", "")).strip() if product else str(payload.get("name", "")).strip()
    product_link = str(product.get("link", product.get("url", ""))).strip() if product else str(payload.get("link", "")).strip()

    if not (product_name or product_link):
        return jsonify({"error": "bad_request", "message": "Provide product.name and/or product.link"}), 400

    prompt = build_judge_prompt(product_name, product_link)

    request_model = str(payload.get("model", "")).strip() or OPENAI_MODEL

    def call_openai(selected_model: str):
        return client.responses.create(
            model=selected_model,
            input=prompt,
        )

    try:
        response = call_openai(request_model)
    except OpenAIError as oe:
        message_text = str(oe)
        logger.warning("OpenAI judge error with model %s: %s", request_model, message_text)
        is_rate_limited = ("429" in message_text) or ("rate limit" in message_text.lower())
        if is_rate_limited and request_model != "gpt-5":
            logger.info("Judge retry with fallback model gpt-5 after backoff...")
            time.sleep(1.5)
            try:
                response = call_openai("gpt-5")
            except Exception as e2:
                logger.exception("Judge fallback failed: %s", e2)
                return jsonify({"error": "openai_api_error", "message": str(e2)}), 502
        else:
            return jsonify({"error": "openai_api_error", "message": message_text}), 502
    except Exception as e:
        logger.exception("Unexpected error calling OpenAI for judge: %s", e)
        return jsonify({"error": "server_error", "message": str(e)}), 500

    try:
        raw_dump = response.model_dump_json(indent=2)  # type: ignore[attr-defined]
        print("=== OpenAI raw judge response (model_dump_json) ===")
        print(raw_dump)
    except Exception:
        print("=== OpenAI judge response (repr) ===")
        print(repr(response))

    output_text = getattr(response, "output_text", None)
    if output_text is None:
        try:
            output_text = response.output[0].content[0].text  # type: ignore[attr-defined]
        except Exception:
            output_text = ""

    print("=== OpenAI judge output_text ===")
    print(output_text)

    impact = parse_impact_label(output_text or "")

    ecoscore_val = parse_ecoscore_from_text(output_text or "")
    if ecoscore_val <= 0.0:
        ecoscore_val = ecoscore_from_impact(impact)

    return jsonify({
        "product": {"name": product_name, "link": product_link},
        "impact": impact,
        "ecoscore": ecoscore_val
    }), 200


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5057"))
    logger.info("Starting Flask server on port %d", port)
    app.run(host="0.0.0.0", port=port, debug=True)


