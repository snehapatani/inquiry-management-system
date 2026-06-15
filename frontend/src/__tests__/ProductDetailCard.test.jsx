import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ProductDetailCard from "../components/ProductDetailCard";

vi.mock("../api", () => ({
  matchVendors: vi.fn(),
  createQuote: vi.fn(),
  setBestQuote: vi.fn(),
  getQuotes: vi.fn(),
  createVendor: vi.fn(),
  getVendors: vi.fn(),
}));

import { matchVendors, createQuote, setBestQuote, getQuotes } from "../api";

const SAMPLE_ITEM = {
  ItemID: 101,
  ProductNameRaw: "Azithromycin 500 KG",
  ProductNameNorm: "Azithromycin",
  Quantity: 500,
  Unit: "KG",
  Grade: "IP",
  MatchStatus: "Unmatched",
  IsSelected: false,
};

const SAMPLE_VENDORS = [
  {
    VendorID: 1,
    VendorName: "Alpha Chemicals",
  },
  {
    VendorID: 2,
    VendorName: "Beta Pharma",
  },
];

const SAMPLE_QUOTES = [
  {
    QuoteID: 1,
    VendorID: 1,
    Currency: "INR",
    QuotedPrice: "1200",
    PriceUnit: "per KG",
    LeadTimeDays: 7,
    Notes: "Best quality",
    IsBestPrice: true,
    QuotedDate: "2026-06-01",
    CreatedBy: "Paras",
  },
];

const SAMPLE_MATCHED_VENDORS = [
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
  matchVendors.mockResolvedValue(SAMPLE_MATCHED_VENDORS);
  createQuote.mockResolvedValue({ QuoteID: 2 });
  setBestQuote.mockResolvedValue({});
  getQuotes.mockResolvedValue(SAMPLE_QUOTES);
});

describe("ProductDetailCard", () => {
  it("renders product name and quantity", () => {
    render(
      <ProductDetailCard
        item={SAMPLE_ITEM}
        quotes={SAMPLE_QUOTES}
        vendors={SAMPLE_VENDORS}
        mode="detail"
        isSelected={false}
      />
    );

    const productHeaders = screen.getAllByText("Azithromycin");
    expect(productHeaders.length).toBeGreaterThan(0);
  });

  it("displays grade badge when available", () => {
    render(
      <ProductDetailCard
        item={SAMPLE_ITEM}
        quotes={SAMPLE_QUOTES}
        vendors={SAMPLE_VENDORS}
        mode="detail"
      />
    );

    expect(screen.getByText("IP")).toBeInTheDocument();
  });

  it("displays match status", () => {
    render(
      <ProductDetailCard
        item={SAMPLE_ITEM}
        quotes={SAMPLE_QUOTES}
        vendors={SAMPLE_VENDORS}
        mode="detail"
      />
    );

    expect(screen.getByText("Unmatched")).toBeInTheDocument();
  });

  it("expands and collapses on click", async () => {
    render(
      <ProductDetailCard
        item={SAMPLE_ITEM}
        quotes={SAMPLE_QUOTES}
        vendors={SAMPLE_VENDORS}
        mode="detail"
      />
    );

    const productHeaders = screen.getAllByText("Azithromycin");
    fireEvent.click(productHeaders[0]);

    await waitFor(() => {
      expect(screen.getByText("🔍 Find Matching Vendors")).toBeInTheDocument();
    });
  });

  it("shows Find Matching Vendors button when expanded", async () => {
    render(
      <ProductDetailCard
        item={SAMPLE_ITEM}
        quotes={SAMPLE_QUOTES}
        vendors={SAMPLE_VENDORS}
        mode="detail"
      />
    );

    fireEvent.click(screen.getByText("Azithromycin"));

    await waitFor(() => {
      expect(screen.getByText("🔍 Find Matching Vendors")).toBeInTheDocument();
    });
  });

  it("calls matchVendors when Find Matching Vendors is clicked", async () => {
    render(
      <ProductDetailCard
        item={SAMPLE_ITEM}
        quotes={SAMPLE_QUOTES}
        vendors={SAMPLE_VENDORS}
        mode="detail"
      />
    );

    fireEvent.click(screen.getByText("Azithromycin"));
    await waitFor(() => screen.getByText("🔍 Find Matching Vendors"));

    fireEvent.click(screen.getByText("🔍 Find Matching Vendors"));

    await waitFor(() => {
      expect(matchVendors).toHaveBeenCalledWith(SAMPLE_ITEM.ItemID);
    });
  });

  it("changes button to Refresh Vendors after finding matches", async () => {
    render(
      <ProductDetailCard
        item={SAMPLE_ITEM}
        quotes={SAMPLE_QUOTES}
        vendors={SAMPLE_VENDORS}
        mode="detail"
      />
    );

    fireEvent.click(screen.getByText("Azithromycin"));
    await waitFor(() => screen.getByText("🔍 Find Matching Vendors"));

    fireEvent.click(screen.getByText("🔍 Find Matching Vendors"));

    await waitFor(() => {
      expect(screen.getByText("🔄 Refresh Vendors")).toBeInTheDocument();
    });
  });

  it("calls matchVendors API when finding vendors", async () => {
    render(
      <ProductDetailCard
        item={SAMPLE_ITEM}
        quotes={SAMPLE_QUOTES}
        vendors={SAMPLE_VENDORS}
        mode="detail"
      />
    );

    fireEvent.click(screen.getByText("Azithromycin"));
    await waitFor(() => screen.getByText("🔍 Find Matching Vendors"));

    fireEvent.click(screen.getByText("🔍 Find Matching Vendors"));

    await waitFor(() => {
      expect(matchVendors).toHaveBeenCalled();
    });
  });

  it("displays Add Quote form with all fields", async () => {
    render(
      <ProductDetailCard
        item={SAMPLE_ITEM}
        quotes={SAMPLE_QUOTES}
        vendors={SAMPLE_VENDORS}
        mode="detail"
      />
    );

    fireEvent.click(screen.getByText("Azithromycin"));

    await waitFor(() => {
      expect(screen.getByText("Add Quote (after contacting vendor offline)")).toBeInTheDocument();
    });
  });

  it("displays quotes table when expanded with quotes present", async () => {
    render(
      <ProductDetailCard
        item={SAMPLE_ITEM}
        quotes={SAMPLE_QUOTES}
        vendors={SAMPLE_VENDORS}
        mode="detail"
      />
    );

    fireEvent.click(screen.getByText("Azithromycin"));

    await waitFor(() => {
      // Check that the best price indicator shows (indicates quotes table is displayed)
      expect(screen.getByText("✓ Best")).toBeInTheDocument();
    });
  });

  it("displays quote details in table when expanded", async () => {
    render(
      <ProductDetailCard
        item={SAMPLE_ITEM}
        quotes={SAMPLE_QUOTES}
        vendors={SAMPLE_VENDORS}
        mode="detail"
      />
    );

    // Expand the card first
    fireEvent.click(screen.getByText("Azithromycin"));

    // Check for vendor name in quotes table (should be displayed after expansion)
    await waitFor(() => {
      const allVendorElements = screen.getAllByText("Alpha Chemicals");
      expect(allVendorElements.length).toBeGreaterThan(0);
    });
  });

  it("shows best price indicator", async () => {
    render(
      <ProductDetailCard
        item={SAMPLE_ITEM}
        quotes={SAMPLE_QUOTES}
        vendors={SAMPLE_VENDORS}
        mode="detail"
      />
    );

    fireEvent.click(screen.getByText("Azithromycin"));

    await waitFor(() => {
      expect(screen.getByText("✓ Best")).toBeInTheDocument();
    });
  });

  it("handles queue mode correctly", () => {
    render(
      <ProductDetailCard
        item={SAMPLE_ITEM}
        quotes={SAMPLE_QUOTES}
        vendors={SAMPLE_VENDORS}
        mode="queue"
        onRemove={vi.fn()}
      />
    );

    expect(screen.getByText("Azithromycin")).toBeInTheDocument();
  });

  it("shows remove button in queue mode", () => {
    render(
      <ProductDetailCard
        item={SAMPLE_ITEM}
        quotes={SAMPLE_QUOTES}
        vendors={SAMPLE_VENDORS}
        mode="queue"
        onRemove={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("Azithromycin"));
    const removeButton = screen.getByTitle("Remove from queue");
    expect(removeButton).toBeInTheDocument();
  });

  it("displays best quote in queue mode header", () => {
    render(
      <ProductDetailCard
        item={SAMPLE_ITEM}
        quotes={SAMPLE_QUOTES}
        vendors={SAMPLE_VENDORS}
        mode="queue"
        onRemove={vi.fn()}
      />
    );

    expect(screen.getByText(/Best:.*1200/)).toBeInTheDocument();
  });

  it("calls onAddToQueue when in detail mode", async () => {
    const onAddToQueue = vi.fn();
    render(
      <ProductDetailCard
        item={SAMPLE_ITEM}
        quotes={SAMPLE_QUOTES}
        vendors={SAMPLE_VENDORS}
        mode="detail"
        isSelected={false}
        onAddToQueue={onAddToQueue}
      />
    );

    const addQueueButton = screen.getByText("+ Work Queue");
    fireEvent.click(addQueueButton);

    await waitFor(() => {
      expect(onAddToQueue).toHaveBeenCalledWith(SAMPLE_ITEM.ItemID);
    });
  });

  it("displays Work Queue button in detail mode", () => {
    render(
      <ProductDetailCard
        item={SAMPLE_ITEM}
        quotes={SAMPLE_QUOTES}
        vendors={SAMPLE_VENDORS}
        mode="detail"
        isSelected={false}
        onAddToQueue={vi.fn()}
      />
    );

    expect(screen.getByText("+ Work Queue")).toBeInTheDocument();
  });
});
