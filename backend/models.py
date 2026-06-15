from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, DateTime, Numeric, Boolean,
    ForeignKey, Text, func
)
from database import Base


class User(Base):
    __tablename__ = "Users"
    UserID         = Column(Integer, primary_key=True, autoincrement=True)
    Username       = Column(String(100), unique=True, nullable=False)
    FullName       = Column(String(200))
    HashedPassword = Column(String(200), nullable=False)
    Role           = Column(String(50), default="user")
    IsActive       = Column(Boolean, default=True)
    CreatedAt      = Column(DateTime, default=func.now())


class Customer(Base):
    __tablename__ = "Customers"
    CustomerID    = Column(Integer, primary_key=True, autoincrement=True)
    Name          = Column(String(150), nullable=False)
    Company       = Column(String(200))
    Email         = Column(String(150))
    Phone         = Column(String(50))
    SourceChannel = Column(String(20))
    CustomerCategory = Column(String(50), nullable=True, default="Not Identified")
    CreatedAt     = Column(DateTime, default=func.now())
    IsActive      = Column(Boolean, default=1)


class Inquiry(Base):
    __tablename__ = "Inquiries"
    InquiryID    = Column(Integer, primary_key=True, autoincrement=True)
    CustomerID   = Column(Integer, ForeignKey("Customers.CustomerID"), nullable=False)
    InquiryDate  = Column(DateTime, nullable=True)
    ReceivedDate = Column(DateTime, default=func.now())
    Source       = Column(String(20))
    RawText      = Column(Text)
    Status       = Column(String(30), default="New")
    Remarks      = Column(String(500))
    CreatedAt    = Column(DateTime, default=func.now())
    CreatedBy    = Column(String(100))


class InquiryItem(Base):
    __tablename__ = "InquiryItems"
    ItemID           = Column(Integer, primary_key=True, autoincrement=True)
    InquiryID        = Column(Integer, ForeignKey("Inquiries.InquiryID"), nullable=False)
    ProductNameRaw   = Column(String(300), nullable=False)
    ProductNameNorm  = Column(String(300))
    Quantity         = Column(Numeric(18, 3))
    Unit             = Column(String(20))
    Grade            = Column(String(50))
    ManufacturerPref = Column(String(200))
    MatchStatus      = Column(String(30), default="Unmatched")
    BestQuoteID      = Column(Integer, ForeignKey("VendorQuotes.QuoteID"), nullable=True)
    IsSelected       = Column(Boolean, default=False, nullable=True)
    Remarks          = Column(String(500))
    CreatedAt        = Column(DateTime, default=func.now())


class Vendor(Base):
    __tablename__ = "Vendors"
    VendorID      = Column(Integer, primary_key=True, autoincrement=True)
    VendorName    = Column(String(200), nullable=False)
    ContactPerson = Column(String(150))
    Email         = Column(String(150))
    Phone         = Column(String(50))
    City          = Column(String(100))
    Region        = Column(String(100))
    IsActive      = Column(Boolean, default=1)
    CreatedBy     = Column(String(100), nullable=True)
    CreatedAt     = Column(DateTime, default=func.now())


class VendorProduct(Base):
    __tablename__ = "VendorProducts"
    VendorProductID    = Column(Integer, primary_key=True, autoincrement=True)
    VendorID           = Column(Integer, ForeignKey("Vendors.VendorID"), nullable=False)
    ProductName        = Column(String(300), nullable=False)
    Grade              = Column(String(50))
    Manufacturer       = Column(String(200))
    LeadTimeDays       = Column(Integer)
    IsAvailable        = Column(Boolean, default=1)
    Notes              = Column(String(500))
    ReferencePrice     = Column(Numeric(18, 4), nullable=True)
    ReferenceCurrency  = Column(String(10), nullable=True)
    ReferencePriceUnit = Column(String(30), nullable=True)
    ReferencePriceDate = Column(DateTime, nullable=True)
    CreatedBy          = Column(String(100), nullable=True)
    CreatedAt          = Column(DateTime, default=func.now())


class VendorQuote(Base):
    __tablename__ = "VendorQuotes"
    QuoteID      = Column(Integer, primary_key=True, autoincrement=True)
    ItemID       = Column(Integer, ForeignKey("InquiryItems.ItemID"), nullable=False)
    VendorID     = Column(Integer, ForeignKey("Vendors.VendorID"), nullable=False)
    QuotedPrice  = Column(Numeric(18, 4))
    Currency     = Column(String(10), default="INR")
    PriceUnit    = Column(String(30))
    LeadTimeDays = Column(Integer)
    QuotedDate   = Column(DateTime, default=func.now())
    IsBestPrice  = Column(Boolean, default=0)
    Notes        = Column(String(500))
    CreatedBy    = Column(String(100))


class SentResponse(Base):
    __tablename__ = "SentResponses"
    ResponseID  = Column(Integer, primary_key=True, autoincrement=True)
    InquiryID   = Column(Integer, ForeignKey("Inquiries.InquiryID"), nullable=False)
    SentDate    = Column(DateTime, default=func.now())
    Channel     = Column(String(20))
    MessageBody = Column(Text)
    SentBy      = Column(String(100))
    Status      = Column(String(30), default="Sent")
