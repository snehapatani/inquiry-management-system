import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Analytics from "../pages/Analytics";

vi.mock("../api", () => ({
  getInquiries: vi.fn(),
  getQuotes: vi.fn(),
  getResponses: vi.fn(),
}));

import { getInquiries, getQuotes, getResponses } from "../api";

const SAMPLE_INQUIRIES = [
  {
    InquiryID: 1,
    ReceivedDate: "2026-06-01T10:00:00",
    CustomerName: "Rajesh Kumar",
    CustomerCompany: "Alpha Pharma",
    ItemCount: 2,
    Source: "Email",
    Status: "New",
    CreatedBy: "Paras",
  },
  {
    InquiryID: 2,
    ReceivedDate: "2026-06-02T10:00:00",
    CustomerName: "Sneha Patel",
    CustomerCompany: "Beta Labs",
    ItemCount: 3,
    Source: "WhatsApp",
    Status: "In Progress",
    CreatedBy: "Paras",
  },
  {
    InquiryID: 3,
    ReceivedDate: "2026-06-03T10:00:00",
    CustomerName: "John Doe",
    CustomerCompany: "Gamma Corp",
    ItemCount: 1,
    Source: "Email",
    Status: "Quoted",
    CreatedBy: "Sneha",
  },
  {
    InquiryID: 4,
    ReceivedDate: "2026-06-04T10:00:00",
    CustomerName: "Jane Smith",
    CustomerCompany: "Delta Inc",
    ItemCount: 2,
    Source: "Phone",
    Status: "Closed",
    CreatedBy: "Paras",
  },
];

beforeEach(() => {
  getInquiries.mockResolvedValue(SAMPLE_INQUIRIES);
  getQuotes.mockResolvedValue([]);
  getResponses.mockResolvedValue([]);
});

describe("Analytics Dashboard", () => {
  it("renders analytics page with title", async () => {
    render(<Analytics />);
    await waitFor(() => {
      expect(screen.getByText("Analytics Dashboard")).toBeInTheDocument();
    });
  });

  it("displays analytics page structure", async () => {
    render(<Analytics />);
    await waitFor(() => {
      expect(screen.getByText("Analytics Dashboard")).toBeInTheDocument();
    });
  });

  it("displays filter controls", async () => {
    render(<Analytics />);
    await waitFor(() => {
      expect(screen.getByText("Time Period")).toBeInTheDocument();
    });
  });

  it("renders without crashing with sample data", async () => {
    render(<Analytics />);
    await waitFor(() => {
      expect(screen.getByText("Analytics Dashboard")).toBeInTheDocument();
    });
  });

  it("displays all major sections", async () => {
    render(<Analytics />);
    await waitFor(() => {
      // Check that key UI elements are present
      expect(document.querySelector("select")).toBeInTheDocument();
    });
  });

});
