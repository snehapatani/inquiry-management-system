import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import VendorMaster from "../pages/VendorMaster";

vi.mock("../api", () => ({
  getVendors: vi.fn(),
  createVendor: vi.fn(),
  updateVendor: vi.fn(),
  deleteVendor: vi.fn(),
  getVendorProducts: vi.fn(),
  createVendorProduct: vi.fn(),
  deleteVendorProduct: vi.fn(),
}));

import {
  getVendors, createVendor, updateVendor, deleteVendor,
  getVendorProducts, createVendorProduct, deleteVendorProduct,
} from "../api";

const VENDORS = [
  { VendorID: 1, VendorName: "Alpha Chemicals", ContactPerson: "Ravi", Phone: "9876543210", Email: "ravi@alpha.com", City: "Mumbai", Region: "West", IsActive: true, ProductCount: 3 },
  { VendorID: 2, VendorName: "Beta Pharma", ContactPerson: "Sita", Phone: "8765432109", Email: null, City: "Delhi", Region: "North", IsActive: true, ProductCount: 0 },
];

const PRODUCTS = [
  { VendorProductID: 10, VendorID: 1, ProductName: "Azithromycin", Grade: "IP", Manufacturer: "Cipla", LeadTimeDays: 7, IsAvailable: true, LastQuotedPrice: "1200", LastCurrency: "INR", LastPriceUnit: "per KG", LastQuotedDate: "2026-01-10T00:00:00" },
];

beforeEach(() => {
  getVendors.mockResolvedValue(VENDORS);
  getVendorProducts.mockResolvedValue(PRODUCTS);
  createVendor.mockResolvedValue({ VendorID: 3, VendorName: "New Vendor", ProductCount: 0 });
  deleteVendor.mockResolvedValue({ ok: true });
  createVendorProduct.mockResolvedValue({ VendorProductID: 20, ProductName: "Metformin" });
  deleteVendorProduct.mockResolvedValue({ ok: true });
});

async function renderVendors() {
  await act(async () => { render(<VendorMaster />); });
}

describe("VendorMaster — table", () => {
  it("renders vendor names in the table", async () => {
    await renderVendors();
    await waitFor(() => {
      expect(screen.getByText("Alpha Chemicals")).toBeInTheDocument();
      expect(screen.getByText("Beta Pharma")).toBeInTheDocument();
    });
  });

  it("shows product count badges", async () => {
    await renderVendors();
    await waitFor(() => {
      expect(screen.getByText("3 products")).toBeInTheDocument();
      expect(screen.getByText("0 products")).toBeInTheDocument();
    });
  });

  it("shows Add Vendor button", async () => {
    await renderVendors();
    expect(screen.getByText("+ Add Vendor")).toBeInTheDocument();
  });
});

describe("VendorMaster — Add Vendor modal", () => {
  it("opens modal on Add Vendor click", async () => {
    await renderVendors();
    fireEvent.click(screen.getByText("+ Add Vendor"));
    expect(screen.getByRole("heading", { name: "Add Vendor" })).toBeInTheDocument();
    // "Vendor Name *" label exists inside the modal (distinct from the table column header)
    expect(screen.getByText((_, el) => el?.tagName === "LABEL" && el.textContent.includes("Vendor Name"))).toBeInTheDocument();
  });

  it("closes modal on Cancel", async () => {
    await renderVendors();
    fireEvent.click(screen.getByText("+ Add Vendor"));
    fireEvent.click(screen.getByText("Cancel"));
    await waitFor(() => {
      expect(screen.queryByText("Vendor Name *")).not.toBeInTheDocument();
    });
  });
});

describe("VendorMaster — products modal", () => {
  it("opens product modal on vendor row click", async () => {
    await renderVendors();
    await waitFor(() => screen.getByText("Alpha Chemicals"));

    fireEvent.click(screen.getByText("Alpha Chemicals"));

    await waitFor(() => {
      expect(screen.getByText("Products — Alpha Chemicals")).toBeInTheDocument();
      expect(screen.getByText("Azithromycin")).toBeInTheDocument();
    });
  });

  it("shows previous price in product list", async () => {
    await renderVendors();
    await waitFor(() => screen.getByText("Alpha Chemicals"));
    fireEvent.click(screen.getByText("Alpha Chemicals"));

    await waitFor(() => {
      expect(screen.getByText(/INR 1200/)).toBeInTheDocument();
    });
  });
});
