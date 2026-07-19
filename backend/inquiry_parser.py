"""
LLM-based inquiry parser using Claude API.
Falls back to a regex-based mock parser when no API key is configured.
"""
import re
import json
from typing import Optional
import anthropic
from database import settings
from schemas import ParsedInquiry, ParsedItem

# ── mock parser ───────────────────────────────────────────────
_QTY_RE  = re.compile(r"(\d[\d,\.]*)\s*(KG|KGS|MT|MTS|GM|GMS|LT|LIT|G|L)\b", re.I)
_MOQ_RE  = re.compile(r"\bMOQ\b", re.I)
_NUMBERED_LIST_RE = re.compile(r"^\s*\d+[\.\)]\s+")
_GRADE_RE = re.compile(r"\b(USP|BP|IP|EP|AR|LR|NF|JP)\b", re.I)
_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.\w+")
_PHONE_RE = re.compile(r"[\+\d][\d\s\-\(\)]{7,}")

_UNIT_MAP = {
    "kgs": "KG", "kg": "KG", "mts": "MT", "mt": "MT",
    "gms": "GM", "gm": "GM", "g": "GM",
    "lit": "LT", "lt": "LT", "ltr": "LT", "litre": "LT", "l": "LT",
}

# ── table parser (structured data) ────────────────────────────
def _parse_table(raw_text: str) -> Optional[ParsedInquiry]:
    """Try to parse inquiry if it contains a table (pipe-delimited, CSV, or tab-separated)."""
    lines = [l.rstrip() for l in raw_text.splitlines() if l.strip()]  # Only strip trailing whitespace to preserve leading empty cells

    # Detect table format: look for header row with product/quantity/unit keywords
    # Support both pipe-delimited (|) and tab-separated (\t) formats
    table_candidate = None
    table_sep = None  # Will be '|' or '\t'

    for i, line in enumerate(lines):
        # Try pipe-delimited first, then tab-separated
        for sep in ["|", "\t"]:
            if sep not in line:
                continue
            headers_raw = [h.strip().lower() for h in line.split(sep)]
            headers = [h for h in headers_raw if h]
            if len(headers) < 2:
                continue
            # Check if this looks like a header (contains product, qty, unit, etc.)
            header_keywords = {"product", "qty", "quantity", "unit", "grade", "spec", "mfg", "manufacturer", "medicine", "item"}
            if any(kw in " ".join(headers) for kw in header_keywords):
                table_candidate = (i, line, headers)
                table_sep = sep
                break

        if table_candidate:
            break

    if not table_candidate:
        return None  # Not a table

    header_idx, header_line, headers = table_candidate
    if len(headers) < 2 or header_idx + 1 >= len(lines):
        return None

    # Find relevant column indices
    product_idx = next((i for i, h in enumerate(headers) if "product" in h or "item" in h or "medicine" in h or "name" in h or "required" in h or "rm" in h), None)
    qty_idx = next((i for i, h in enumerate(headers) if "qty" in h or "quantity" in h), None)
    unit_idx = next((i for i, h in enumerate(headers) if "unit" in h), None)
    grade_idx = next((i for i, h in enumerate(headers) if "grade" in h or "spec" in h or "standard" in h or "ip" in h or "usp" in h or "bp" in h), None)
    # Look for manufacturer columns: prefer "make", then "approved", then "manufacturer", then "mfg"
    # This handles cases like "Make" (common short form) and "Approved make" (formal specification column)
    mfg_idx = None
    for keyword in ["approved", "make", "manufacturer", "mfg"]:
        mfg_idx = next((i for i, h in enumerate(headers) if keyword in h), None)
        if mfg_idx is not None:
            break

    # If no explicit product column found, assume it's the column after qty (common in formatted tables)
    if product_idx is None and qty_idx is not None:
        product_idx = qty_idx + 1

    if product_idx is None:
        return None  # Can't find product column

    items = []
    # Process rows after header
    # Skip separator lines and continue until we find real data
    in_table = False
    for row_line in lines[header_idx + 1:]:
        # Skip lines without the separator (potential headers, separators, etc.)
        if table_sep not in row_line:
            # If we've already found table rows, and now we hit a non-table line, stop
            if in_table:
                break
            # Otherwise continue looking for table data
            continue

        cols = [c.strip() for c in row_line.split(table_sep)]
        # Keep empty strings to preserve column alignment, but remove entirely empty rows

        if not any(c for c in cols):  # Skip if all columns empty
            continue

        if product_idx >= len(cols):
            continue

        product_name = cols[product_idx] if product_idx < len(cols) else None
        if not product_name:
            continue

        # Skip specification/note lines (e.g., "Mesh Size 40 #", "Specification", etc.)
        # These typically lack a quantity in the qty column
        if qty_idx is not None and qty_idx < len(cols):
            qty_text = cols[qty_idx].strip()
            if not qty_text:  # No quantity means it's likely a note, not a product
                continue

        in_table = True  # Mark that we've started parsing actual table data

        qty = None
        unit = None

        # Try to extract qty and unit from the qty column
        if qty_idx is not None and qty_idx < len(cols):
            qty_str = cols[qty_idx]
            # Try pattern: "285-Kg" or "285 Kg" or just "285"
            m = re.search(r"(\d[\d,\.]*)\s*[-\s]*(KG|KGS|MT|MTS|GM|GMS|LT|LIT|LTR|LITRE|G|L)\b", qty_str, re.I)
            if m:
                qty = float(m.group(1).replace(",", ""))
                unit_raw = m.group(2)
                unit = _UNIT_MAP.get(unit_raw.lower(), unit_raw.upper())
            else:
                # No unit in qty column, extract just the number
                m = re.search(r"(\d[\d,\.]*)", qty_str)
                if m:
                    qty = float(m.group(1).replace(",", ""))

        # If unit not found in qty column, try separate unit column
        if unit is None and unit_idx is not None and unit_idx < len(cols):
            unit_raw = cols[unit_idx]
            unit = _UNIT_MAP.get(unit_raw.lower(), unit_raw.upper() if unit_raw else None)

        grade = None
        if grade_idx is not None and grade_idx < len(cols):
            m = re.search(r"\b(USP|BP|IP|EP|AR|LR|NF|JP)\b", cols[grade_idx], re.I)
            if m:
                grade = m.group(1).upper()

        # If no grade found in separate column, try to extract from product name
        if not grade:
            m = re.search(r"\b(USP|BP|IP|EP|AR|LR|NF|JP)\b", product_name, re.I)
            if m:
                grade = m.group(1).upper()

        manufacturer = None
        if mfg_idx is not None and mfg_idx < len(cols):
            manufacturer = cols[mfg_idx]

        items.append(ParsedItem(
            product_number=len(items) + 1,
            product_name=product_name,
            quantity=qty,
            unit=unit,
            grade=grade,
            manufacturer_pref=manufacturer,
        ))

    if not items:
        return None  # No valid rows parsed

    # Extract customer info from lines after the table
    non_table_lines = lines[:header_idx] + lines[header_idx + 1 + len(items):]
    email = next((_EMAIL_RE.search(l).group() for l in non_table_lines if _EMAIL_RE.search(l)), None)
    phone_match = next((_PHONE_RE.search(l) for l in non_table_lines if _PHONE_RE.search(l) and "@" not in l), None)
    phone = phone_match.group().strip() if phone_match else None

    customer_name, customer_company = None, None
    for line in non_table_lines:
        if email and email in line:
            continue
        if phone and phone in line:
            continue
        parts = [p.strip() for p in re.split(r"[,|]", line) if p.strip()]
        if parts and len(parts) >= 1:
            customer_name = parts[0]
            customer_company = parts[1] if len(parts) > 1 else None
            if customer_name:
                break

    return ParsedInquiry(
        customer_name=customer_name,
        customer_company=customer_company,
        customer_email=email,
        customer_phone=phone,
        items=items,
    )


def _mock_parse(raw_text: str) -> ParsedInquiry:
    lines = [l.strip() for l in raw_text.splitlines() if l.strip()]

    # Extract email / phone first
    email = next((_EMAIL_RE.search(l).group() for l in lines if _EMAIL_RE.search(l)), None)
    phone_match = next((_PHONE_RE.search(l) for l in lines if _PHONE_RE.search(l) and "@" not in l), None)
    phone = phone_match.group().strip() if phone_match else None

    # Classify lines: product lines (explicit qty or MOQ or numbered list), and other lines
    product_lines, other_lines = [], []

    for line in lines:
        is_product = False

        # Check if line has explicit quantity (e.g., "5 KG")
        if _QTY_RE.search(line):
            is_product = True
        # Check if line has MOQ notation
        elif _MOQ_RE.search(line):
            is_product = True
        # Check if line starts with number (numbered list format: 1. 2. 3.)
        elif _NUMBERED_LIST_RE.match(line):
            is_product = True

        if is_product:
            product_lines.append(line)
        else:
            other_lines.append(line)

    # Build items from product lines
    items = []
    for line in product_lines:
        qty = None
        unit = None
        name = line

        # Try to extract quantity and unit
        qty_match = _QTY_RE.search(line)
        if qty_match:
            qty_str, unit_raw = qty_match.group(1), qty_match.group(2)
            qty = float(qty_str.replace(",", ""))
            unit = _UNIT_MAP.get(unit_raw.lower(), unit_raw.upper())
            # product name = everything before the quantity match, cleaned up
            name = line[:qty_match.start()].strip().strip(",-").strip()
            if not name:
                name = line[qty_match.end():].strip().strip(",-").strip()
        else:
            # No explicit quantity, check if it's MOQ
            moq_match = _MOQ_RE.search(line)
            if moq_match:
                # product name = everything before MOQ
                name = line[:moq_match.start()].strip().strip(",-").strip()
                if not name:
                    name = line[moq_match.end():].strip().strip(",-").strip()

        # Remove numbering prefix like "1)" or "1." or "1 )"
        name = re.sub(r"^\d+[\)\.\s]+", "", name).strip()
        # Remove bullet points and dashes: •, ◦, ▪, -, *, etc.
        name = re.sub(r"^[\•◦▪\-\*]+\s*", "", name).strip()
        # Remove trailing dashes and arrows
        name = re.sub(r"\s*[-—→>]+\s*$", "", name).strip()

        # Extract grade
        grade_m = _GRADE_RE.search(line)
        grade = grade_m.group(1).upper() if grade_m else None

        if name:
            items.append(ParsedItem(
                product_number=len(items) + 1,
                product_name=name,
                quantity=qty,
                unit=unit,
                grade=grade,
            ))

    # If nothing matched as a product line, treat non-contact lines as product names
    if not items:
        for line in other_lines:
            if email and email in line:
                continue
            if phone and phone.strip() in line:
                continue
            items.append(ParsedItem(
                product_number=len(items) + 1,
                product_name=line,
            ))

    # Customer info: first non-product, non-contact line often has "Name, Company"
    customer_name, customer_company = None, None
    for line in other_lines:
        if email and email in line:
            continue
        parts = [p.strip() for p in re.split(r"[,|]", line) if p.strip()]
        if parts:
            customer_name = parts[0]
            customer_company = parts[1] if len(parts) > 1 else None
            break

    return ParsedInquiry(
        customer_name=customer_name,
        customer_company=customer_company,
        customer_email=email,
        customer_phone=phone,
        items=items,
    )


# ── real Claude parser ────────────────────────────────────────
# AI parsing disabled - using fast regex/table parsers only
_USE_AI = False

if _USE_AI:
    _client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

SYSTEM_PROMPT = """You are a pharmaceutical inquiry parser.
Extract structured information from raw inquiry text and return valid JSON only.

Rules:
- Normalize product names to standard pharma API names (e.g. "azithro" → "Azithromycin")
- Extract quantity as a number and unit separately (e.g. "125 KG" → quantity: 125, unit: "KG")
- Grade options: USP, BP, IP, EP, AR, LR, or null if not mentioned
- If multiple products are listed, return all of them in the items array
- If a field is not present, return null for that field

Return JSON in this exact format:
{
  "customer_name": "string or null",
  "customer_company": "string or null",
  "customer_email": "string or null",
  "customer_phone": "string or null",
  "items": [
    {
      "product_name": "normalized product name",
      "quantity": number or null,
      "unit": "KG/MT/LT/etc or null",
      "grade": "USP/BP/IP/EP/etc or null",
      "manufacturer_pref": "string or null"
    }
  ]
}"""


def parse_inquiry(raw_text: str) -> ParsedInquiry:
    # 1. Try table parsing first (no API calls, handles structured data)
    table_result = _parse_table(raw_text)
    if table_result:
        return table_result

    # 2. Fall back to mock parser (regex-based, fast)
    if not _USE_AI:
        return _mock_parse(raw_text)
    try:
        message = _client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": f"Parse this pharmaceutical inquiry:\n\n{raw_text}"}],
        )
        content = message.content[0].text.strip()
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        data = json.loads(content)
        return ParsedInquiry(**data)
    except anthropic.AuthenticationError:
        return _mock_parse(raw_text)


def ai_available() -> bool:
    """Return True only if the API key is present and authenticates successfully."""
    if not _USE_AI:
        return False
    try:
        _client.models.list()
        return True
    except anthropic.AuthenticationError:
        return False
    except Exception:
        return True  # network or other error — assume key is valid


def normalize_product_name(raw_name: str) -> str:
    """Normalize a single product name — passthrough when no valid API key."""
    if not _USE_AI:
        return raw_name
    try:
        message = _client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=100,
            messages=[{
                "role": "user",
                "content": (
                    f"Return only the standard pharmaceutical API name for: '{raw_name}'. "
                    "No explanation, just the normalized name."
                )
            }],
        )
        return message.content[0].text.strip()
    except anthropic.AuthenticationError:
        return raw_name
