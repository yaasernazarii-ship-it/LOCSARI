#!/usr/bin/env python3
import argparse
import json
import os
import sys
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

DEFAULT_ENDPOINT = "https://locationsari.ir/api/properties/import"
REQUIRED_FIELDS = ("title", "source_id", "deal_type", "property_type")


def load_items(input_path: Path) -> list[dict]:
    payload = json.loads(input_path.read_text(encoding="utf-8"))
    items = payload if isinstance(payload, list) else [payload]
    if not all(isinstance(item, dict) for item in items):
        raise ValueError("فایل ورودی باید یک شیء JSON یا آرایه‌ای از شیءهای JSON باشد")
    for index, item in enumerate(items, start=1):
        missing = [field for field in REQUIRED_FIELDS if not item.get(field)]
        if missing:
            raise ValueError(f"آگهی شمارهٔ {index}: فیلدهای الزامی ناقص هستند: {', '.join(missing)}")
    return items


def post_item(endpoint: str, api_key: str, item: dict, retries: int) -> tuple[int, dict]:
    payload = json.dumps(item, ensure_ascii=False).encode("utf-8")
    request = Request(
        endpoint,
        data=payload,
        method="POST",
        headers={"Content-Type": "application/json", "X-Api-Key": api_key},
    )
    for attempt in range(retries + 1):
        try:
            with urlopen(request, timeout=30) as response:
                return response.status, json.loads(response.read().decode("utf-8"))
        except HTTPError as error:
            body = error.read().decode("utf-8", errors="replace")
            try:
                return error.code, json.loads(body)
            except json.JSONDecodeError:
                return error.code, {"error": body or "خطای نامشخص سرور"}
        except URLError as error:
            if attempt == retries:
                return 0, {"error": f"خطای شبکه: {error.reason}"}
            time.sleep(2 ** attempt)
    return 0, {"error": "خطای نامشخص"}


def main() -> int:
    parser = argparse.ArgumentParser(description="ارسال آگهی‌های آماده‌شده به API لوکیشن ساری")
    parser.add_argument("--input", required=True, type=Path, help="مسیر فایل JSON یک آگهی یا آرایه‌ای از آگهی‌ها")
    parser.add_argument("--endpoint", default=os.getenv("PROPERTY_IMPORT_ENDPOINT", DEFAULT_ENDPOINT))
    parser.add_argument("--retries", type=int, default=3)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    try:
        items = load_items(args.input)
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(json.dumps({"error": str(error)}, ensure_ascii=False), file=sys.stderr)
        return 2

    if args.dry_run:
        print(json.dumps({"validated": len(items), "endpoint": args.endpoint}, ensure_ascii=False))
        return 0

    api_key = os.getenv("PROPERTY_IMPORT_API_KEY", "").strip()
    if not api_key:
        print(json.dumps({"error": "PROPERTY_IMPORT_API_KEY تنظیم نشده است"}, ensure_ascii=False), file=sys.stderr)
        return 2

    summary = {"created": 0, "updated": 0, "duplicate": 0, "failed": 0}
    for item in items:
        status, result = post_item(args.endpoint, api_key, item, max(args.retries, 0))
        if status == 201:
            summary["created"] += 1
        elif status == 200 and result.get("updated"):
            summary["updated"] += 1
        elif status == 200 and result.get("duplicate"):
            summary["duplicate"] += 1
        else:
            summary["failed"] += 1
        print(json.dumps({"source_id": item["source_id"], "http_status": status, "result": result}, ensure_ascii=False))

    print(json.dumps({"summary": summary}, ensure_ascii=False))
    return 1 if summary["failed"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
