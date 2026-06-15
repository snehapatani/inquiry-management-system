"""
Seed script — reads Inquiry Sheet.xlsx and populates the DB with all real data.
Run: python seed_data.py
Safe to re-run: clears existing data first.
Excel path is resolved relative to this script's parent directory.
"""
import re
import sys
import os
from datetime import datetime, timedelta
from pathlib import Path

try:
    import openpyxl
except ImportError:
    sys.exit("openpyxl not installed. Run: pip install openpyxl")

from database import engine, SessionLocal, Base
import models

Base.metadata.create_all(bind=engine)

# ── Excel path ────────────────────────────────────────────────────────────────
EXCEL_PATH = Path(__file__).parent.parent / "Inquiry Sheet.xlsx"
if not EXCEL_PATH.exists():
    sys.exit(f"Excel not found: {EXCEL_PATH}")

# ── Customer name normalisation ───────────────────────────────────────────────
# Collapse known spelling variants / capitalisation differences into one key.
CUSTOMER_NORM = {
    ("om prakash", "modern labs"):         ("Om Prakash",       "Modern Laboratories"),
    ("om prakash", "modern lab"):          ("Om Prakash",       "Modern Laboratories"),
    ("om prakash", "modern laboratories"): ("Om Prakash",       "Modern Laboratories"),
    ("ashish mitra", "swift life"):        ("Ashish Mitra",     "Swift LifeSciences"),
    ("ashish mitra", "swift lifesciences"):("Ashish Mitra",     "Swift LifeSciences"),
    ("ashish", "swift"):                   ("Ashish Mitra",     "Swift LifeSciences"),
    ("ashish", "swift life"):              ("Ashish Mitra",     "Swift LifeSciences"),
    ("vaishali", "cotech"):                ("Vaishali",         "Cotec"),
    ("vaishali tyagi", "cotec"):           ("Vaishali",         "Cotec"),
    ("vaishali tyagi", "cotech"):          ("Vaishali",         "Cotec"),
    ("jyoti rawat", "radbacs"):            ("Jyoti Rawat",      "Radbacs Remedies"),
    ("jyoti rawat", "radbac remedies"):    ("Jyoti Rawat",      "Radbacs Remedies"),
    ("jyoti rawat", "radbacs remedies"):   ("Jyoti Rawat",      "Radbacs Remedies"),
    ("jyoti", "radbacs"):                  ("Jyoti Rawat",      "Radbacs Remedies"),
    ("jagdish bhai", "erva healthcare"):   ("Jagdish Tarapada", "ERVA Healthcare"),
    ("jagdish bhai", "erva health"):       ("Jagdish Tarapada", "ERVA Healthcare"),
    ("tirth", "rajat care llp"):           ("Tirth",            "Rajat Care LLP"),
    ("tirth", "rajat care"):               ("Tirth",            "Rajat Care LLP"),
    ("tirth", "rajat"):                    ("Tirth",            "Rajat Care LLP"),
    ("aaryan", "ved"):                     ("Aaryan",           "Ved Lifesavers"),
    ("siddhant", "ved lifesavers"):        ("Sidhant",          "Ved Lifesavers"),
    ("sidhant", "ved"):                    ("Sidhant",          "Ved Lifesavers"),
}

# Rows whose customer/company are placeholders — skip entirely
SKIP_CUSTOMERS = {
    "no one", "broker", "na", "some", "n/a", "", "merck", "hrishabh",
    "bhumit",  # single-person temp entries
}


def norm_customer(raw_name: str, raw_company: str):
    """Return a canonical (name, company) tuple, or None to skip the row."""
    name    = raw_name.strip().split("\n")[0].strip()
    company = raw_company.strip().split("\n")[0].strip()
    if name.lower() in SKIP_CUSTOMERS or company.lower() in SKIP_CUSTOMERS:
        return None
    key = (name.lower(), company.lower())
    if key in CUSTOMER_NORM:
        return CUSTOMER_NORM[key]
    return (name, company)


# ── Quantity / unit parser ────────────────────────────────────────────────────
_QTY_RE = re.compile(
    r"^\s*(?:=\s*)?(\d[\d,\.\*\s]*?\d|\d)"   # number, possibly formula like =250*5
    r"\s*([A-Za-z]+)?\s*$"
)

def parse_qty(raw):
    """Return (quantity_float_or_None, unit_str_or_None)."""
    if not raw:
        return None, None
    s = str(raw).strip()
    if s.upper() in ("MOQ", "MINIMUM PACK SIZE", "STANDARD"):
        return None, None
    # evaluate simple formulas like =250*5
    s = re.sub(r"^=", "", s)
    if "*" in s:
        try:
            s = str(eval(s))       # noqa: S307 — only numeric ops from our own xlsx
        except Exception:
            pass
    m = _QTY_RE.match(s)
    if not m:
        # try just extracting a leading number
        nm = re.match(r"^\s*([\d,\.]+)", s)
        if nm:
            try:
                qty = float(nm.group(1).replace(",", ""))
                return qty, None
            except ValueError:
                pass
        return None, None
    qty_str, unit = m.group(1), m.group(2)
    try:
        qty = float(qty_str.replace(",", "").replace(" ", ""))
    except ValueError:
        return None, None
    unit = unit.upper() if unit else None
    # normalise common unit spellings
    unit_map = {"KGS": "KG", "KGS.": "KG", "GM": "GM", "GMS": "GM",
                "GRM": "GM", "GRAM": "GM", "GRAMS": "GM",
                "MT": "MT", "MTS": "MT", "TON": "MT", "TONS": "MT",
                "LT": "LT", "LIT": "LT", "LITRE": "LT", "LITRES": "LT",
                "BOU": "BOU", "LAC": "LAC", "LACS": "LAC"}
    unit = unit_map.get(unit, unit)
    return qty, unit


# ── Vendor / price parser ─────────────────────────────────────────────────────
_PRICE_RE = re.compile(r"[\d,]+(?:\.\d+)?")

def parse_quote_cell(cell_text: str):
    """
    Return (vendor_name, price_float_or_None, notes_str) from a quote cell.
    Cells look like:  "Vipul\n 12,750/Kg"  or  "Premier drug"  or  "930.0"
    """
    if not cell_text:
        return None, None, None
    text = cell_text.strip()
    if not text or text.upper() in ("CLOSED", "LOST", "QUOTED"):
        return None, None, None

    lines = [l.strip() for l in text.splitlines() if l.strip()]
    # If first line looks like a bare price, there's no vendor name
    first = lines[0]
    bare_price = re.match(r"^[\d,]+(?:\.\d+)?$", first)
    if bare_price:
        try:
            price = float(first.replace(",", ""))
            return None, price, text
        except ValueError:
            return None, None, text

    vendor = first[:200]  # first line = vendor name
    rest   = " ".join(lines[1:])
    prices = _PRICE_RE.findall(rest)
    price  = None
    for p in prices:
        try:
            v = float(p.replace(",", ""))
            if v > 0:          # skip things like "18%" (GST)
                price = v
                break
        except ValueError:
            pass
    notes = text[:500]
    return vendor, price, notes


# ── Grade extractor ───────────────────────────────────────────────────────────
_GRADE_RE = re.compile(r"\b(USP|BP|IP|EP|AR|LR|NF|JP|PH\.EUR)\b", re.I)

def extract_grade(text: str):
    m = _GRADE_RE.search(text or "")
    return m.group(1).upper() if m else None


# ── Main seeder ───────────────────────────────────────────────────────────────
def seed():
    wb = openpyxl.load_workbook(EXCEL_PATH)
    ws = wb["API Inquiries"]
    rows = list(ws.iter_rows(values_only=True))[1:]   # skip header

    # Group raw rows by normalised customer key
    groups: dict[tuple, list] = {}
    skipped = 0
    for r in rows:
        if not r[2] or not r[3]:
            skipped += 1
            continue
        key = norm_customer(str(r[2]), str(r[3]))
        if key is None:
            skipped += 1
            continue
        groups.setdefault(key, []).append(r)

    print(f"Excel: {len(rows)} rows -> {len(groups)} customer groups ({skipped} skipped)")

    db = SessionLocal()
    try:
        # ── Wipe existing data ─────────────────────────────────────
        for model in (models.SentResponse, models.VendorQuote,
                      models.InquiryItem, models.Inquiry,
                      models.VendorProduct, models.Vendor, models.Customer):
            db.query(model).delete()
        db.commit()

        # ── Build vendor registry ──────────────────────────────────
        # Collect unique vendor names from all quote columns (col 4 onwards)
        vendor_names: set[str] = set()
        for item_rows in groups.values():
            for r in item_rows:
                for cell in r[4:]:
                    if cell:
                        vname, _, _ = parse_quote_cell(str(cell))
                        if vname and len(vname) > 1:
                            vendor_names.add(vname.strip()[:200])

        vendor_objs: dict[str, models.Vendor] = {}
        for vname in sorted(vendor_names):
            v = models.Vendor(VendorName=vname)
            db.add(v)
            vendor_objs[vname] = v
        db.flush()
        print(f"Vendors: {len(vendor_objs)}")

        # ── Build VendorProduct catalog from quote data ────────────
        # Collect unique (vendor_name, product_name) pairs so each vendor's
        # catalog reflects the products they've actually quoted before.
        vp_seen: set[tuple] = set()
        for item_rows in groups.values():
            for r in item_rows:
                product_raw = str(r[0]).strip() if r[0] else ""
                if not product_raw:
                    continue
                for col_idx in range(4, len(r)):
                    cell = r[col_idx]
                    if not cell:
                        continue
                    vname, _, _ = parse_quote_cell(str(cell))
                    if vname and vname in vendor_objs:
                        key = (vname, product_raw[:300])
                        if key not in vp_seen:
                            vp_seen.add(key)
                            grade = extract_grade(product_raw)
                            db.add(models.VendorProduct(
                                VendorID=vendor_objs[vname].VendorID,
                                ProductName=product_raw[:300],
                                Grade=grade,
                                IsAvailable=True,
                            ))
        db.flush()
        print(f"VendorProducts: {len(vp_seen)}")

        # ── Create customers, inquiries, items, quotes ─────────────
        total_items   = 0
        total_quotes  = 0
        inquiry_count = 0
        offset_days   = 0   # spread inquiries over past ~90 days

        for (cust_name, cust_company), item_rows in groups.items():
            # Customer
            cust = models.Customer(
                Name=cust_name,
                Company=cust_company,
                SourceChannel="WhatsApp",
            )
            db.add(cust)
            db.flush()

            # Determine inquiry source/status from presence of quotes
            has_quotes = any(
                any(r[c] for c in range(4, len(r))) for r in item_rows
            )
            status = "Quoted" if has_quotes else "New"

            # Build raw_text from product list
            product_lines = []
            for i, r in enumerate(item_rows, 1):
                pname = str(r[0]).strip() if r[0] else "?"
                qty   = str(r[1]).strip() if r[1] else ""
                product_lines.append(f"{i}. {pname}" + (f" — {qty}" if qty else ""))
            raw_text = (
                f"Inquiry from {cust_name} ({cust_company}):\n"
                + "\n".join(product_lines)
            )

            # Inquiry
            received = datetime.now() - timedelta(days=offset_days % 90)
            inq = models.Inquiry(
                CustomerID=cust.CustomerID,
                ReceivedDate=received,
                Source="WhatsApp",
                Status=status,
                RawText=raw_text,
                CreatedBy="Admin",
            )
            db.add(inq)
            db.flush()
            offset_days += 1
            inquiry_count += 1

            # Items + quotes
            for r in item_rows:
                product_raw = str(r[0]).strip() if r[0] else ""
                if not product_raw:
                    continue

                qty, unit = parse_qty(r[1])
                grade = extract_grade(product_raw)

                item = models.InquiryItem(
                    InquiryID=inq.InquiryID,
                    ProductNameRaw=product_raw[:300],
                    ProductNameNorm=product_raw[:300],   # no LLM normalisation in seed
                    Quantity=qty,
                    Unit=unit,
                    Grade=grade,
                    MatchStatus="Unmatched",
                )
                db.add(item)
                db.flush()
                total_items += 1

                # Parse quote columns (index 4 onwards)
                best_price = None
                for col_idx in range(4, len(r)):
                    cell = r[col_idx]
                    if not cell:
                        continue
                    vname, price, notes = parse_quote_cell(str(cell))
                    if vname and vname in vendor_objs:
                        is_best = False
                        if price and (best_price is None or price < best_price):
                            best_price = price
                            is_best = True
                        db.add(models.VendorQuote(
                            ItemID=item.ItemID,
                            VendorID=vendor_objs[vname].VendorID,
                            QuotedPrice=price,
                            Currency="INR",
                            PriceUnit="per KG",
                            IsBestPrice=is_best,
                            Notes=(notes or "")[:500],
                            CreatedBy="Admin",
                        ))
                        total_quotes += 1

        db.commit()
        print(
            f"Done. {inquiry_count} inquiries | "
            f"{total_items} items | "
            f"{total_quotes} vendor quotes"
        )

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
