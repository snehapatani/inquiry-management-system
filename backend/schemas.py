from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel


# ── Auth ─────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserOut(BaseModel):
    UserID: int
    Username: str
    FullName: Optional[str] = None
    Role: str
    class Config: from_attributes = True

class UserCreate(BaseModel):
    Username: str
    FullName: Optional[str] = None
    Password: str
    Role: str = "user"


# ── Customer ──────────────────────────────────────────────────
class CustomerCreate(BaseModel):
    Name: str
    Company: Optional[str] = None
    Email: Optional[str] = None
    Phone: Optional[str] = None
    SourceChannel: Optional[str] = None
    CustomerCategory: Optional[str] = None  # End User / Trader / Distributor / Not Identified

class CustomerOut(CustomerCreate):
    CustomerID: int
    CreatedAt: Optional[datetime] = None
    class Config: from_attributes = True


# ── InquiryItem ───────────────────────────────────────────────
class InquiryItemCreate(BaseModel):
    ProductNameRaw: str
    ProductNameNorm: Optional[str] = None
    Quantity: Optional[Decimal] = None
    Unit: Optional[str] = None
    Grade: Optional[str] = None
    ManufacturerPref: Optional[str] = None
    Remarks: Optional[str] = None

class InquiryItemOut(InquiryItemCreate):
    ItemID: int
    InquiryID: int
    MatchStatus: str = "Unmatched"
    BestQuoteID: Optional[int] = None
    IsSelected: Optional[bool] = False
    CreatedAt: Optional[datetime] = None
    class Config: from_attributes = True

class WorkItemOut(BaseModel):
    ItemID: int
    InquiryID: int
    ProductNameRaw: str
    ProductNameNorm: Optional[str] = None
    Quantity: Optional[Decimal] = None
    Unit: Optional[str] = None
    Grade: Optional[str] = None
    MatchStatus: str = "Unmatched"
    CustomerName: Optional[str] = None
    CustomerCompany: Optional[str] = None
    class Config: from_attributes = True


# ── Inquiry ───────────────────────────────────────────────────
class InquiryCreate(BaseModel):
    CustomerID: int
    Source: Optional[str] = None
    InquiryDate: Optional[datetime] = None
    RawText: Optional[str] = None
    Remarks: Optional[str] = None
    CreatedBy: Optional[str] = None
    Items: List[InquiryItemCreate] = []

class InquiryOut(BaseModel):
    InquiryID: int
    CustomerID: int
    CustomerName: Optional[str] = None
    CustomerCompany: Optional[str] = None
    InquiryDate: Optional[datetime] = None
    ReceivedDate: Optional[datetime] = None
    Source: Optional[str] = None
    RawText: Optional[str] = None
    Status: str
    Remarks: Optional[str] = None
    CreatedBy: Optional[str] = None
    ItemCount: int = 0
    MatchingItemIDs: List[int] = []
    class Config: from_attributes = True

class InquiryDetail(InquiryOut):
    Items: List[InquiryItemOut] = []
    Customer: Optional[CustomerOut] = None


# ── Vendor ────────────────────────────────────────────────────
class VendorCreate(BaseModel):
    VendorName: str
    ContactPerson: Optional[str] = None
    Email: Optional[str] = None
    Phone: Optional[str] = None
    City: Optional[str] = None
    Region: Optional[str] = None
    CreatedBy: Optional[str] = None

class VendorOut(VendorCreate):
    VendorID: int
    IsActive: Optional[bool] = True
    ProductCount: Optional[int] = 0
    class Config: from_attributes = True


# ── VendorProduct ─────────────────────────────────────────────
class VendorProductCreate(BaseModel):
    VendorID: int
    ProductName: str
    Grade: Optional[str] = None
    Manufacturer: Optional[str] = None
    LeadTimeDays: Optional[int] = None
    Notes: Optional[str] = None
    ReferencePrice: Optional[Decimal] = None
    ReferenceCurrency: Optional[str] = "INR"
    ReferencePriceUnit: Optional[str] = None
    ReferencePriceDate: Optional[datetime] = None
    CreatedBy: Optional[str] = None

class VendorProductOut(VendorProductCreate):
    VendorProductID: int
    IsAvailable: Optional[bool] = True
    LastQuotedPrice: Optional[Decimal] = None
    LastQuotedDate: Optional[datetime] = None
    LastPriceUnit: Optional[str] = None
    LastCurrency: Optional[str] = None
    class Config: from_attributes = True


# ── VendorQuote ───────────────────────────────────────────────
class VendorQuoteCreate(BaseModel):
    ItemID: int
    VendorID: int
    QuotedPrice: Optional[Decimal] = None
    Currency: str = "INR"
    PriceUnit: Optional[str] = None
    LeadTimeDays: Optional[int] = None
    QuotedDate: Optional[datetime] = None
    Notes: Optional[str] = None
    CreatedBy: Optional[str] = None

class VendorQuoteOut(VendorQuoteCreate):
    QuoteID: int
    IsBestPrice: Optional[bool] = False
    QuotedDate: Optional[datetime] = None
    class Config: from_attributes = True


# ── SentResponse ──────────────────────────────────────────────
class SentResponseCreate(BaseModel):
    InquiryID: int
    Channel: Optional[str] = None
    MessageBody: Optional[str] = None
    SentBy: Optional[str] = None

class SentResponseOut(SentResponseCreate):
    ResponseID: int
    SentDate: Optional[datetime] = None
    Status: str = "Sent"
    class Config: from_attributes = True

class SentResponseLog(SentResponseOut):
    CustomerName: Optional[str] = None
    CustomerCompany: Optional[str] = None


# ── LLM Parser ───────────────────────────────────────────────
class ParseRequest(BaseModel):
    raw_text: str

class ParsedItem(BaseModel):
    product_number: int  # Sequential product count (1, 2, 3, ...)
    product_name: str
    quantity: Optional[float] = None
    unit: Optional[str] = None
    grade: Optional[str] = None
    manufacturer_pref: Optional[str] = None

class ParsedInquiry(BaseModel):
    customer_name: Optional[str] = None
    customer_company: Optional[str] = None
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    items: List[ParsedItem] = []


# ── Vendor Match ──────────────────────────────────────────────
class VendorMatch(BaseModel):
    VendorProductID: int
    VendorID: int
    VendorName: str
    ContactPerson: Optional[str] = None
    Email: Optional[str] = None
    Phone: Optional[str] = None
    ProductName: str
    Grade: Optional[str] = None
    Manufacturer: Optional[str] = None
    LeadTimeDays: Optional[int] = None
    LastQuotedPrice: Optional[Decimal] = None
    LastQuotedDate: Optional[datetime] = None
    LastPriceUnit: Optional[str] = None
    LastCurrency: Optional[str] = None
