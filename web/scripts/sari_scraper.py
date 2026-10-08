#!/usr/bin/env python3
import argparse
import json
import os
import random
import re
import sys
import time
from html import unescape
from html.parser import HTMLParser
from http.client import IncompleteRead
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote, unquote, urljoin, urlsplit, urlunsplit
from urllib.request import Request, urlopen

DIVAR_URL = "https://divar.ir/s/sari/real-estate"
SHEYPOOR_URL = "https://www.sheypoor.com/s/sari/real-estate"
DEFAULT_ENDPOINT = "https://locationsari.ir/api/properties/import"
DEFAULT_USER_AGENT = "SariPropertyImporter/1.0 (+https://locationsari.ir)"
PERSIAN_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")


class PageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.meta = {}
        self.json_ld = []
        self._script_type = None
        self._script_parts = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == "a" and values.get("href"):
            self.links.append(values["href"])
        if tag == "meta" and values.get("content"):
            key = values.get("property") or values.get("name")
            if key:
                self.meta[key.lower()] = values["content"]
        if tag == "script" and values.get("type", "").lower() == "application/ld+json":
            self._script_type = "json"
            self._script_parts = []

    def handle_data(self, data):
        if self._script_type:
            self._script_parts.append(data)

    def handle_endtag(self, tag):
        if tag == "script" and self._script_type:
            raw = "".join(self._script_parts).strip()
            if raw:
                try:
                    self.json_ld.append(json.loads(raw))
                except json.JSONDecodeError:
                    pass
            self._script_type = None
            self._script_parts = []


def normalize_digits(value):
    return value.translate(PERSIAN_DIGITS)


def clean_text(value):
    return re.sub(r"\s+", " ", unescape(value or "")).strip()


def flatten_json(value):
    if isinstance(value, list):
        for item in value:
            yield from flatten_json(item)
    elif isinstance(value, dict):
        yield value
        for item in value.values():
            if isinstance(item, (dict, list)):
                yield from flatten_json(item)


def request_url(url):
    parts = urlsplit(url)
    return urlunsplit((parts.scheme, parts.netloc, quote(unquote(parts.path), safe="/%:@"), parts.query, parts.fragment))


def fetch(url, user_agent, retries, min_delay, max_delay):
    last_error = None
    for attempt in range(retries + 1):
        if attempt:
            time.sleep(min(60, 2 ** (attempt - 1) + random.uniform(0.5, 1.5)))
        request = Request(request_url(url), headers={"User-Agent": user_agent, "Accept": "text/html,application/xhtml+xml"})
        try:
            with urlopen(request, timeout=30) as response:
                body = response.read().decode("utf-8", "replace")
                time.sleep(random.uniform(min_delay, max_delay))
                return body
        except HTTPError as error:
            last_error = error
            if error.code not in (403, 429, 500, 502, 503, 504) or attempt == retries:
                raise
        except (URLError, IncompleteRead) as error:
            last_error = error
            if attempt == retries:
                raise
    raise last_error or RuntimeError("خطای دریافت صفحه")


def parse_page(html):
    parser = PageParser()
    parser.feed(html)
    return parser


def absolute_urls(values, base_url):
    result = []
    for value in values:
        if isinstance(value, str) and value.startswith(("http://", "https://")):
            result.append(value)
        elif isinstance(value, str) and value.startswith("/"):
            result.append(urljoin(base_url, value))
    return list(dict.fromkeys(result))


def first_value(objects, *keys):
    for obj in objects:
        for key in keys:
            value = obj.get(key)
            if isinstance(value, str) and value.strip():
                return clean_text(value)
    return None


def parse_number(value):
    if value is None:
        return None
    value = normalize_digits(str(value)).replace(",", "").replace("٬", "").replace("،", "")
    match = re.search(r"\d+(?:\.\d+)?", value)
    return match.group(0) if match else None


def number_after(text, patterns):
    normalized = normalize_digits(text)
    for pattern in patterns:
        match = re.search(pattern, normalized, re.I)
        if match:
            number = parse_number(match.group(1))
            if number:
                return number
    return None


def infer_deal_type(text):
    return "mortgage_rent" if re.search(r"اجاره|رهن|رهن و اجاره|روزانه|هفتگی|ماهانه", text) else "sale"


def infer_property_type(text):
    if re.search(r"زمین|زمینۀ|قطعه|باغ", text):
        return "land"
    if re.search(r"ویلا|کلبه|باغ ویلا", text):
        return "villa"
    if re.search(r"مغازه|تجاری|اداری|دفتر|کارگاه", text):
        return "commercial"
    return "apartment"


def structured_item(parser, source_url, source_id, source_name):
    objects = list(flatten_json(parser.json_ld))
    target_objects = [obj for obj in objects if isinstance(obj.get("url"), str) and request_url(obj["url"]) == source_url]
    if not target_objects:
        target_objects = [obj for obj in objects if isinstance(obj.get("web_info"), dict) and obj["web_info"].get("title")]
    title = first_value(target_objects, "name", "headline")
    for obj in target_objects:
        web_info = obj.get("web_info")
        if isinstance(web_info, dict) and web_info.get("title"):
            title = clean_text(web_info["title"])
            break
    title = title or (parser.meta.get("og:title") if source_name != "divar" else None)
    if title in {"دیوار", "سایت دیوار", "شیپور"}:
        title = None
    if not title and source_name == "divar":
        slug = unquote(urlsplit(source_url).path).split("/v/", 1)[-1].rsplit("/", 1)[0]
        title = clean_text(slug.replace("-", " "))
    description = first_value(target_objects, "description") or parser.meta.get("description", "")
    images = []
    for obj in objects:
        image = obj.get("image")
        if isinstance(image, str):
            images.append(image)
        elif isinstance(image, list):
            images.extend(item for item in image if isinstance(item, str))
    images.extend([parser.meta.get("og:image", "")])
    images = absolute_urls(images, source_url)[:20]
    text = clean_text(" ".join([title or "", description or "", parser.meta.get("og:title", "")]))
    area = None
    rooms = None
    for obj in objects:
        floor_size = obj.get("floorSize")
        if isinstance(floor_size, dict):
            area = parse_number(floor_size.get("value")) or area
        rooms = parse_number(obj.get("numberOfRooms")) or rooms
    area = area or number_after(text, [r"(?:مترا?ژ|متری|مساحت|زیربنا)\s*[:：]?\s*([\d۰-۹]+)"])
    rooms = rooms or number_after(text, [r"([\d۰-۹]+)\s*خواب", r"تعداد خواب\s*[:：]?\s*([\d۰-۹]+)"])
    price = number_after(text, [r"(?:قیمت|فروش)\s*[:：]?\s*([\d۰-۹,٬،]+)\s*(?:تومان|میلیارد|میلیون)?"])
    deposit = number_after(text, [r"(?:ودیعه|رهن|پیش)\s*[:：]?\s*([\d۰-۹,٬،]+)"])
    rent = number_after(text, [r"(?:اجاره|ماهانه)\s*[:：]?\s*([\d۰-۹,٬،]+)"])
    if not title:
        raise ValueError(f"عنوان آگهی {source_id} پیدا نشد")
    item = {
        "title": title[:300],
        "description": description[:10000] or title,
        "deal_type": infer_deal_type(text),
        "property_type": infer_property_type(text),
        "area": area,
        "rooms": rooms,
        "price_total": price,
        "deposit_price": deposit,
        "rent_price": rent,
        "images": images,
        "source_id": source_id,
        "source_url": source_url,
        "status": "pending_review",
        "source_name": source_name,
    }
    return item


def divar_urls(html):
    parser = parse_page(html)
    urls = []
    for obj in flatten_json(parser.json_ld):
        url = obj.get("url")
        if isinstance(url, str) and "/v/" in url and "divar.ir" in url:
            urls.append(url)
    urls.extend(re.findall(r"https://divar\.ir/v/[^\\\"'<> ]+", html))
    return list(dict.fromkeys(urls))


def sheypoor_urls(html):
    parser = parse_page(html)
    urls = []
    for href in parser.links:
        absolute = urljoin(SHEYPOOR_URL, href)
        if re.search(r"sheypoor\.com/v/.+-\d+\.html$", absolute):
            urls.append(absolute)
    return list(dict.fromkeys(urls))


def collect_source(name, listing_url, limit, user_agent, retries, min_delay, max_delay):
    listing_html = fetch(listing_url, user_agent, retries, min_delay, max_delay)
    urls = divar_urls(listing_html) if name == "divar" else sheypoor_urls(listing_html)
    if not urls and name == "divar" and re.search(r"captcha|blocked|دسترسی", listing_html, re.I):
        raise RuntimeError("divar: پاسخ ضدربات یا کپچا دریافت شد؛ اسکن متوقف شد")
    items = []
    for url in urls[:limit]:
        source_id = f"{name}_{re.search(r'([A-Za-z0-9]+)(?:\.html)?$', url).group(1)}" if name == "divar" else f"{name}_{re.search(r'-(\d+)\.html$', url).group(1)}"
        canonical_url = request_url(url)
        detail_html = fetch(canonical_url, user_agent, retries, min_delay, max_delay)
        item = structured_item(parse_page(detail_html), canonical_url, source_id, name)
        item.pop("source_name", None)
        items.append(item)
    if len(items) < limit:
        raise RuntimeError(f"{name}: فقط {len(items)} آگهی قابل استخراج شد؛ انتظار {limit} آگهی بود")
    return items


def import_item(endpoint, api_key, item, retries):
    payload = json.dumps(item, ensure_ascii=False).encode("utf-8")
    request = Request(endpoint, data=payload, method="POST", headers={"Content-Type": "application/json", "X-Api-Key": api_key})
    for attempt in range(retries + 1):
        try:
            with urlopen(request, timeout=30) as response:
                return response.status, json.loads(response.read().decode("utf-8"))
        except HTTPError as error:
            body = error.read().decode("utf-8", errors="replace")
            if error.code in (403, 429, 500, 502, 503, 504) and attempt < retries:
                time.sleep(min(60, 2 ** attempt + random.uniform(0.5, 1.5)))
                continue
            try:
                return error.code, json.loads(body)
            except json.JSONDecodeError:
                return error.code, {"error": body or "خطای نامشخص سرور"}
        except URLError as error:
            if attempt == retries:
                return 0, {"error": f"خطای شبکه: {error.reason}"}
            time.sleep(min(60, 2 ** attempt + random.uniform(0.5, 1.5)))
    return 0, {"error": "خطای نامشخص"}


def main():
    parser = argparse.ArgumentParser(description="استخراج پنج آگهی املاک ساری از دیوار و شیپور")
    parser.add_argument("--endpoint", default=os.getenv("PROPERTY_IMPORT_ENDPOINT", DEFAULT_ENDPOINT))
    parser.add_argument("--divar-limit", type=int, default=3)
    parser.add_argument("--sheypoor-limit", type=int, default=2)
    parser.add_argument("--retries", type=int, default=3)
    parser.add_argument("--min-delay", type=float, default=3)
    parser.add_argument("--max-delay", type=float, default=7)
    parser.add_argument("--user-agent", default=os.getenv("PROPERTY_SCRAPER_USER_AGENT", DEFAULT_USER_AGENT))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if args.min_delay < 0 or args.max_delay < args.min_delay:
        parser.error("بازهٔ تأخیر نامعتبر است")

    try:
        items = collect_source("divar", DIVAR_URL, args.divar_limit, args.user_agent, args.retries, args.min_delay, args.max_delay)
        items.extend(collect_source("sheypoor", SHEYPOOR_URL, args.sheypoor_limit, args.user_agent, args.retries, args.min_delay, args.max_delay))
    except (HTTPError, URLError, IncompleteRead, ValueError, RuntimeError) as error:
        print(json.dumps({"error": str(error)}, ensure_ascii=False), file=sys.stderr)
        return 2

    if args.dry_run:
        print(json.dumps({"scanned": len(items), "items": items}, ensure_ascii=False, indent=2))
        return 0

    api_key = os.getenv("PROPERTY_IMPORT_API_KEY", "").strip()
    if not api_key:
        print(json.dumps({"error": "PROPERTY_IMPORT_API_KEY تنظیم نشده است"}, ensure_ascii=False), file=sys.stderr)
        return 2
    summary = {"created": 0, "updated": 0, "duplicate": 0, "failed": 0}
    for item in items:
        status, result = import_item(args.endpoint, api_key, item, max(args.retries, 0))
        if status == 201:
            summary["created"] += 1
        elif status == 200 and result.get("updated"):
            summary["updated"] += 1
        elif status == 200 and result.get("duplicate"):
            summary["duplicate"] += 1
        else:
            summary["failed"] += 1
        print(json.dumps({"source_id": item["source_id"], "source_url": item["source_url"], "http_status": status, "result": result}, ensure_ascii=False))
    print(json.dumps({"summary": summary}, ensure_ascii=False))
    return 1 if summary["failed"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
