import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import WorkQueue from "../pages/WorkQueue";

vi.mock("../api", () => ({
  getWorkItems: vi.fn(),
  matchVendors: vi.fn(),
  getQuotes: vi.fn(),
  createQuote: vi.fn(),
  setBestQuote: vi.fn(),
  toggleSelectItem: vi.fn(),
  getVendors: vi.fn(),
  createVendor: vi.fn(),
  sendResponse: vi.fn(),
  updateInquiryStatus: vi.fn(),
}));

import {
  getWorkItems, matchVendors, getQuotes, toggleSelectItem,
  getVendors, sendResponse, updateInquiryStatus,
} from "../api";

const WORK_ITEMS = [
  {
    ItemID: 101,
    InquiryID: 1,
    ProductNameRaw: "Azithromycin 500 KG",
    ProductNameNorm: "Azithromycin",
    Quantity: 500,
    Unit: "KG",
    Grade: "IP",
    MatchStatus: "Unmatched",
    CustomerName: "Rajesh Kumar",
    CustomerCompany: "Alpha Pharma",
  },
];

const MATCHED_VENDORS = [
  {
    VendorProductID: 10,
    VendorID: 1,
    VendorName: "Alpha Chemicals",
    ContactPerson: "Ravi",
    Phone: "9876543210",
    ProductName: "Azithromycin",
    Grade: "IP",
    LeadTimeDays: 7,
    LastQuotedPrice: "1200",
    LastCurrency: "INR",
    LastPriceUnit: "per KG",
    LastQuotedDate: "2026-01-10T00:00:00",
  },
];

beforeEach(() => {
  getWorkItems.mockResolvedValue(WORK_ITEMS);
  getQuotes.mockResolvedValue([]);
  getVendors.mockResolvedValue([{ VendorID: 1, VendorName: "Alpha Chemicals" }]);
  matchVendors.mockResolvedValue(MATCHED_VENDORS);
  toggleSelectItem.mockResolvedValue({ IsSelected: false });
  sendResponse.mockResolvedValue({ ResponseID: 1 });
  updateInquiryStatus.mockResolvedValue({ ok: true });
});

async function renderQueue(props = {}) {
  await act(async () => { render(<WorkQueue onOpenInquiry={() => {}} {...props} />); });
}

describe("WorkQueue", () => {
  it("shows empty state when no items in queue", async () => {
    getWorkItems.mockResolvedValue([]);
    await renderQueue();
    await waitFor(() => {
      expect(screen.getByText(/No products in the work queue/i)).toBeInTheDocument();
    });
  });

  it("renders work item with product and customer details", async () => {
    await renderQueue();
    await waitFor(() => {
      expect(screen.getByText("Azithromycin")).toBeInTheDocument();
      expect(screen.getByText(/Rajesh Kumar/)).toBeInTheDocument();
      expect(screen.getByText(/Alpha Pharma/)).toBeInTheDocument();
    });
  });

  it("shows inquiry group header with inquiry number", async () => {
    await renderQueue();
    await waitFor(() => {
      expect(screen.getByText("Inquiry #1")).toBeInTheDocument();
    });
  });

  it("navigates to inquiry on group header click", async () => {
    const onOpenInquiry = vi.fn();
    await act(async () => { render(<WorkQueue onOpenInquiry={onOpenInquiry} />); });
    await waitFor(() => screen.getByText("Inquiry #1"));
    fireEvent.click(screen.getByText("Inquiry #1"));
    expect(onOpenInquiry).toHaveBeenCalledWith(1);
  });

  it("removes item from queue on ✕ click", async () => {
    await renderQueue();
    await waitFor(() => screen.getByText("Azithromycin"));
    fireEvent.click(screen.getByTitle("Remove from queue"));
    expect(toggleSelectItem).toHaveBeenCalledWith(101);
  });

  it("expands product card on click and shows Find Matching Vendors button", async () => {
    await renderQueue();
    await waitFor(() => screen.getByText("Azithromycin"));

    fireEvent.click(screen.getByText("Azithromycin"));
    await waitFor(() => {
      expect(screen.getByText("🔍 Find Matching Vendors")).toBeInTheDocument();
    });
  });

  it("shows matched vendors after Find Matching Vendors click and changes button to Refresh", async () => {
    await renderQueue();
    await waitFor(() => screen.getByText("Azithromycin"));

    fireEvent.click(screen.getByText("Azithromycin"));
    await waitFor(() => screen.getByText("🔍 Find Matching Vendors"));
    fireEvent.click(screen.getByText("🔍 Find Matching Vendors"));

    await waitFor(() => {
      expect(screen.getByText(/Matched Vendors \(1\)/)).toBeInTheDocument();
      expect(screen.getByText("🔄 Refresh Vendors")).toBeInTheDocument();
    });
  });

  it("opens Send Response modal", async () => {
    await renderQueue();
    await waitFor(() => screen.getByText("✉ Send Response & Close"));
    fireEvent.click(screen.getByText("✉ Send Response & Close"));
    expect(screen.getByText(/Send Response — Inquiry #1/)).toBeInTheDocument();
  });
});
