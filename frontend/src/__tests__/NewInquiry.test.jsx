import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import NewInquiry from "../pages/NewInquiry";

vi.mock("../api", () => ({
  parseInquiry: vi.fn(),
  createCustomer: vi.fn(),
  createInquiry: vi.fn(),
  getParseMode: vi.fn(),
  autocompleteCustomers: vi.fn(),
}));

import { parseInquiry, createCustomer, createInquiry, getParseMode, autocompleteCustomers } from "../api";

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

  it("saves inquiry successfully and calls callbacks", async () => {
    const onSaved = vi.fn();
    let component;
    await act(async () => {
      ({ container: component } = render(<NewInquiry onSaved={onSaved} />));
    });
    fireEvent.change(component.querySelector("textarea"), { target: { value: "Azithromycin 125 KG" } });
    fireEvent.change(screen.getByPlaceholderText(/Enter your name/i), { target: { value: "Paras" } });
    await act(async () => { fireEvent.click(screen.getByText("Parse Inquiry")); });
    await waitFor(() => screen.getByText("Save Inquiry"));
    await act(async () => { fireEvent.click(screen.getByText("Save Inquiry")); });
    await waitFor(() => {
      expect(createCustomer).toHaveBeenCalled();
      expect(createInquiry).toHaveBeenCalled();
    });
  });
});

describe("NewInquiry — autocomplete feature", () => {
  it("does not show suggestions when customer name field has less than 2 characters", async () => {
    const c = await renderForm();
    fireEvent.change(c.querySelector("textarea"), { target: { value: "Azithromycin 125 KG" } });
    fireEvent.change(screen.getByPlaceholderText(/Enter your name/i), { target: { value: "Paras" } });
    await act(async () => { fireEvent.click(screen.getByText("Parse Inquiry")); });
    await waitFor(() => screen.getByText("Save Inquiry"));
    const nameInput = screen.getByDisplayValue("Rajesh Kumar");
    fireEvent.change(nameInput, { target: { value: "R" } });
    await waitFor(() => {
      expect(autocompleteCustomers).not.toHaveBeenCalled();
    });
  });

  it("calls autocomplete API when typing 2+ characters in customer name", async () => {
    autocompleteCustomers.mockResolvedValue([]);
    const c = await renderForm();
    fireEvent.change(c.querySelector("textarea"), { target: { value: "Azithromycin 125 KG" } });
    fireEvent.change(screen.getByPlaceholderText(/Enter your name/i), { target: { value: "Paras" } });
    await act(async () => { fireEvent.click(screen.getByText("Parse Inquiry")); });
    await waitFor(() => screen.getByText("Save Inquiry"));
    const nameInput = screen.getByDisplayValue("Rajesh Kumar");
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: "Ra" } });
    });
    await waitFor(() => {
      expect(autocompleteCustomers).toHaveBeenCalledWith("Ra");
    });
  });

  it("displays customer suggestions in a dropdown", async () => {
    const suggestions = [
      { CustomerID: 1, Name: "Rajesh Kumar", Company: "Alpha Pharma", Email: "rajesh@alpha.com", Phone: "9876543210" },
      { CustomerID: 2, Name: "Rajesh Singh", Company: "Beta Pharma", Email: "rajesh@beta.com", Phone: "9876543211" },
    ];
    autocompleteCustomers.mockResolvedValue(suggestions);
    const c = await renderForm();
    fireEvent.change(c.querySelector("textarea"), { target: { value: "Azithromycin 125 KG" } });
    fireEvent.change(screen.getByPlaceholderText(/Enter your name/i), { target: { value: "Paras" } });
    await act(async () => { fireEvent.click(screen.getByText("Parse Inquiry")); });
    await waitFor(() => screen.getByText("Save Inquiry"));
    const nameInput = screen.getByDisplayValue("Rajesh Kumar");
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: "Rajesh" } });
    });
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
      expect(screen.getByText("Rajesh Singh")).toBeInTheDocument();
    });
  });

  it("selects a suggestion and fills customer details", async () => {
    const suggestions = [
      { CustomerID: 1, Name: "Rajesh Kumar", Company: "Alpha Pharma", Email: "rajesh@alpha.com", Phone: "9876543210" },
    ];
    autocompleteCustomers.mockResolvedValue(suggestions);
    const c = await renderForm();
    fireEvent.change(c.querySelector("textarea"), { target: { value: "Azithromycin 125 KG" } });
    fireEvent.change(screen.getByPlaceholderText(/Enter your name/i), { target: { value: "Paras" } });
    await act(async () => { fireEvent.click(screen.getByText("Parse Inquiry")); });
    await waitFor(() => screen.getByText("Save Inquiry"));
    const nameInput = screen.getByDisplayValue("Rajesh Kumar");
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: "Rajesh" } });
    });
    await waitFor(() => screen.getByText("Rajesh Kumar"));
    const suggestionItem = screen.getAllByText("Rajesh Kumar")[1];
    await act(async () => {
      fireEvent.click(suggestionItem);
    });
    await waitFor(() => {
      expect(screen.getByDisplayValue("Alpha Pharma")).toBeInTheDocument();
      expect(screen.getByDisplayValue("rajesh@alpha.com")).toBeInTheDocument();
    });
  });

  it("hides suggestions when customer name field is blurred", async () => {
    const suggestions = [
      { CustomerID: 1, Name: "Rajesh Kumar", Company: "Alpha Pharma", Email: "rajesh@alpha.com", Phone: "9876543210" },
    ];
    autocompleteCustomers.mockResolvedValue(suggestions);
    const c = await renderForm();
    fireEvent.change(c.querySelector("textarea"), { target: { value: "Azithromycin 125 KG" } });
    fireEvent.change(screen.getByPlaceholderText(/Enter your name/i), { target: { value: "Paras" } });
    await act(async () => { fireEvent.click(screen.getByText("Parse Inquiry")); });
    await waitFor(() => screen.getByText("Save Inquiry"));
    const nameInput = screen.getByDisplayValue("Rajesh Kumar");
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: "Rajesh" } });
    });
    await waitFor(() => screen.getByText("Alpha Pharma"));
    await act(async () => {
      fireEvent.blur(nameInput);
    });
    await waitFor(() => {
      expect(screen.queryByText("Alpha Pharma")).not.toBeInTheDocument();
    });
  });

  it("clears suggestions when API returns empty results", async () => {
    autocompleteCustomers.mockResolvedValue([]);
    const c = await renderForm();
    fireEvent.change(c.querySelector("textarea"), { target: { value: "Azithromycin 125 KG" } });
    fireEvent.change(screen.getByPlaceholderText(/Enter your name/i), { target: { value: "Paras" } });
    await act(async () => { fireEvent.click(screen.getByText("Parse Inquiry")); });
    await waitFor(() => screen.getByText("Save Inquiry"));
    const nameInput = screen.getByDisplayValue("Rajesh Kumar");
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: "XYZ" } });
    });
    await waitFor(() => {
      expect(autocompleteCustomers).toHaveBeenCalled();
    });
  });
});
