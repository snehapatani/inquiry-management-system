import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import NewInquiry from "../pages/NewInquiry";

vi.mock("../api", () => ({
  parseInquiry: vi.fn(),
  createCustomer: vi.fn(),
  createInquiry: vi.fn(),
  getParseMode: vi.fn(),
}));

import { parseInquiry, createCustomer, createInquiry, getParseMode } from "../api";

const PARSED = {
  customer_name: "Rajesh Kumar",
  customer_company: "Alpha Pharma",
  customer_email: null,
  customer_phone: null,
  items: [{ product_name: "Azithromycin", quantity: 125, unit: "KG", grade: null, manufacturer_pref: null }],
};

async function renderForm() {
  let container;
  await act(async () => { ({ container } = render(<NewInquiry onSaved={() => {}} />)); });
  return container;
}

beforeEach(() => {
  getParseMode.mockResolvedValue({ ai: false });
  parseInquiry.mockResolvedValue(PARSED);
  createCustomer.mockResolvedValue({ CustomerID: 1 });
  createInquiry.mockResolvedValue({ InquiryID: 1 });
  localStorage.setItem("createdBy", "");
});

describe("NewInquiry — validation", () => {
  it("Parse button is disabled when text is empty", async () => {
    await renderForm();
    expect(screen.getByText("Parse Inquiry")).toBeDisabled();
  });

  it("Parse button is disabled when only text is filled (no created by)", async () => {
    const c = await renderForm();
    fireEvent.change(c.querySelector("textarea"), { target: { value: "Azithromycin 125 KG" } });
    expect(screen.getByText("Parse Inquiry")).toBeDisabled();
  });

  it("Parse button is disabled when only created by is filled (no text)", async () => {
    await renderForm();
    fireEvent.change(screen.getByPlaceholderText(/Enter your name/i), { target: { value: "Paras" } });
    expect(screen.getByText("Parse Inquiry")).toBeDisabled();
  });

  it("Parse button is enabled when both fields are filled", async () => {
    const c = await renderForm();
    fireEvent.change(c.querySelector("textarea"), { target: { value: "Azithromycin 125 KG" } });
    fireEvent.change(screen.getByPlaceholderText(/Enter your name/i), { target: { value: "Paras" } });
    expect(screen.getByText("Parse Inquiry")).not.toBeDisabled();
  });

  it("shows inline error when text is blurred while empty", async () => {
    const c = await renderForm();
    fireEvent.blur(c.querySelector("textarea"));
    expect(screen.getByText("Inquiry text is required.")).toBeInTheDocument();
  });

  it("shows inline error when created by is blurred while empty", async () => {
    await renderForm();
    fireEvent.blur(screen.getByPlaceholderText(/Enter your name/i));
    expect(screen.getByText("Created by is required.")).toBeInTheDocument();
  });
});

describe("NewInquiry — parse and save flow", () => {
  it("shows parsed data after clicking Parse", async () => {
    const c = await renderForm();
    fireEvent.change(c.querySelector("textarea"), { target: { value: "Azithromycin 125 KG\nRajesh, Alpha" } });
    fireEvent.change(screen.getByPlaceholderText(/Enter your name/i), { target: { value: "Paras" } });
    await act(async () => { fireEvent.click(screen.getByText("Parse Inquiry")); });
    await waitFor(() => {
      expect(screen.getByText("Review Parsed Data")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Rajesh Kumar")).toBeInTheDocument();
    });
  });

  it("Save Inquiry button is disabled while saving", async () => {
    createInquiry.mockImplementation(() => new Promise(() => {}));
    const c = await renderForm();
    fireEvent.change(c.querySelector("textarea"), { target: { value: "Azithromycin 125 KG" } });
    fireEvent.change(screen.getByPlaceholderText(/Enter your name/i), { target: { value: "Paras" } });
    await act(async () => { fireEvent.click(screen.getByText("Parse Inquiry")); });
    await waitFor(() => screen.getByText("Save Inquiry"));
    await act(async () => { fireEvent.click(screen.getByText("Save Inquiry")); });
    await waitFor(() => { expect(screen.getByText("Saving…")).toBeDisabled(); });
  });

  it("shows validation error when no products have a name", async () => {
    parseInquiry.mockResolvedValue({
      customer_name: "Rajesh",
      customer_company: "",
      customer_email: null,
      customer_phone: null,
      items: [{ product_name: "", quantity: null, unit: null, grade: null, manufacturer_pref: null }],
    });
    const c = await renderForm();
    fireEvent.change(c.querySelector("textarea"), { target: { value: "some text" } });
    fireEvent.change(screen.getByPlaceholderText(/Enter your name/i), { target: { value: "Paras" } });
    await act(async () => { fireEvent.click(screen.getByText("Parse Inquiry")); });
    await waitFor(() => screen.getByText("Save Inquiry"));
    fireEvent.click(screen.getByText("Save Inquiry"));
    await waitFor(() => { expect(screen.getByText(/At least one product/i)).toBeInTheDocument(); });
  });
});
