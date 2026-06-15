import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import InquiryList from "../pages/InquiryList";

// Mock the api module
vi.mock("../api", () => ({
  getInquiries: vi.fn(),
  bulkSelectItems: vi.fn(),
}));

import { getInquiries, bulkSelectItems } from "../api";

const SAMPLE_INQUIRIES = [
  {
    InquiryID: 1,
    ReceivedDate: "2026-01-15T10:00:00",
    CustomerName: "Rajesh Kumar",
    CustomerCompany: "Alpha Pharma",
    ItemCount: 2,
    Source: "WhatsApp",
    Status: "New",
    MatchingItemIDs: [101, 102],
  },
  {
    InquiryID: 2,
    ReceivedDate: "2026-01-16T10:00:00",
    CustomerName: "Sneha Patel",
    CustomerCompany: "Beta Labs",
    ItemCount: 1,
    Source: "Email",
    Status: "Quoted",
    MatchingItemIDs: [],
  },
];

beforeEach(() => {
  getInquiries.mockResolvedValue(SAMPLE_INQUIRIES);
  bulkSelectItems.mockResolvedValue({ ok: true, count: 2 });
});

describe("InquiryList", () => {
  it("renders the inquiry table with customer names", async () => {
    render(<InquiryList onOpen={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
      expect(screen.getByText("Sneha Patel")).toBeInTheDocument();
    });
  });

  it("shows product count badges", async () => {
    render(<InquiryList onOpen={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText("2 products")).toBeInTheDocument();
      expect(screen.getByText("1 product")).toBeInTheDocument();
    });
  });

  it("does NOT show checkboxes when product search is empty", async () => {
    render(<InquiryList onOpen={() => {}} />);
    await waitFor(() => screen.getByText("Rajesh Kumar"));
    const checkboxes = screen.queryAllByRole("checkbox");
    expect(checkboxes).toHaveLength(0);
  });

  it("shows checkboxes after product search", async () => {
    render(<InquiryList onOpen={() => {}} />);
    await waitFor(() => screen.getByText("Rajesh Kumar"));

    const productInput = screen.getByPlaceholderText("Search by product name…");
    fireEvent.change(productInput, { target: { value: "Azithromycin" } });
    fireEvent.click(screen.getByText("Search"));

    await waitFor(() => {
      const checkboxes = screen.queryAllByRole("checkbox");
      expect(checkboxes.length).toBeGreaterThan(0);
    });
  });

  it("shows match count badge on rows with matching items", async () => {
    render(<InquiryList onOpen={() => {}} />);
    await waitFor(() => screen.getByText("Rajesh Kumar"));

    const productInput = screen.getByPlaceholderText("Search by product name…");
    fireEvent.change(productInput, { target: { value: "Azithromycin" } });
    fireEvent.click(screen.getByText("Search"));

    await waitFor(() => {
      expect(screen.getByText("2 matches")).toBeInTheDocument();
    });
  });

  it("calls onOpen when Open button is clicked", async () => {
    const onOpen = vi.fn();
    render(<InquiryList onOpen={onOpen} />);
    await waitFor(() => screen.getAllByText("Open"));

    fireEvent.click(screen.getAllByText("Open")[0]);
    // First inquiry is #2 (sorted by date descending - newest first)
    expect(onOpen).toHaveBeenCalledWith(2);
  });

  it("shows Clear button when search is active and clears on click", async () => {
    render(<InquiryList onOpen={() => {}} />);
    await waitFor(() => screen.getByText("Rajesh Kumar"));

    const input = screen.getByPlaceholderText("Search by customer name…");
    fireEvent.change(input, { target: { value: "Rajesh" } });

    expect(screen.getByText("Clear")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Clear"));
    expect(input.value).toBe("");
  });
});
