import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NotificationPopover } from "@/layouts/NotificationPopover";
import * as notificationsApi from "../api/notificationsApi";

vi.mock("../api/notificationsApi", () => ({
  fetchNotifications: vi.fn(),
  fetchUnreadCount: vi.fn(),
  markNotificationAsRead: vi.fn(),
  markAllNotificationsAsRead: vi.fn(),
}));

const mockNotifications = [
  {
    id: "n-1",
    adminId: "admin-1",
    type: "referral_approved",
    category: "referral",
    priority: "high",
    title: "Referral Approved",
    message: "Referral ref-100 was successfully approved.",
    entityType: "referral",
    entityId: "ref-100",
    isRead: false,
    readAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "n-2",
    adminId: "admin-1",
    type: "campaign_activated",
    category: "campaign",
    priority: "medium",
    title: "Campaign Live",
    message: "Summer Promo is active now.",
    entityType: "campaign",
    entityId: "camp-200",
    isRead: true,
    readAt: new Date().toISOString(),
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

function renderWithClient(ui) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("NotificationPopover Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(notificationsApi.fetchUnreadCount).mockResolvedValue({
      ok: true,
      unreadCount: 1,
    });
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValue({
      ok: true,
      data: mockNotifications,
      meta: { total: 2, unreadCount: 1, page: 1, limit: 20, totalPages: 1 },
    });
    vi.mocked(notificationsApi.markNotificationAsRead).mockResolvedValue({
      ok: true,
      notification: { ...mockNotifications[0], isRead: true },
    });
    vi.mocked(notificationsApi.markAllNotificationsAsRead).mockResolvedValue({
      ok: true,
      count: 1,
    });
  });

  it("renders unread count badge and triggers popover on click", async () => {
    const user = userEvent.setup();
    renderWithClient(<NotificationPopover />);

    // Button should display unread count from mock (1)
    const trigger = await screen.findByRole("button", {
      name: /1 unread notification/i,
    });
    expect(trigger).toBeInTheDocument();

    // Click to open popover
    await user.click(trigger);

    expect(
      screen.getByRole("region", { name: /^notifications$/i }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Referral Approved")).toBeInTheDocument();
    expect(screen.getByText("Campaign Live")).toBeInTheDocument();
  });

  it("allows clicking an unread notification to mark as read", async () => {
    const user = userEvent.setup();
    renderWithClient(<NotificationPopover />);

    const trigger = await screen.findByRole("button", {
      name: /1 unread notification/i,
    });
    await user.click(trigger);

    const unreadItem = await screen.findByText("Referral Approved");
    await user.click(unreadItem);

    await waitFor(() => {
      expect(notificationsApi.markNotificationAsRead).toHaveBeenCalledWith(
        "n-1",
      );
    });
  });

  it("allows marking all notifications as read", async () => {
    const user = userEvent.setup();
    renderWithClient(<NotificationPopover />);

    const trigger = await screen.findByRole("button", {
      name: /1 unread notification/i,
    });
    await user.click(trigger);

    const markAllBtn = await screen.findByRole("button", {
      name: /mark all read/i,
    });
    await user.click(markAllBtn);

    await waitFor(() => {
      expect(notificationsApi.markAllNotificationsAsRead).toHaveBeenCalled();
    });
  });

  it("switches between All and Unread filter tabs", async () => {
    const user = userEvent.setup();
    renderWithClient(<NotificationPopover />);

    const trigger = await screen.findByRole("button", {
      name: /1 unread notification/i,
    });
    await user.click(trigger);

    const unreadTab = screen.getByRole("button", { name: /^unread/i });
    await user.click(unreadTab);

    await waitFor(() => {
      expect(notificationsApi.fetchNotifications).toHaveBeenCalledWith(
        expect.objectContaining({ isRead: false, page: 1 }),
      );
    });
  });

  it("renders pagination controls and navigates between pages", async () => {
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValue({
      ok: true,
      data: mockNotifications,
      meta: { total: 20, unreadCount: 1, page: 1, limit: 10, totalPages: 2 },
    });

    const user = userEvent.setup();
    renderWithClient(<NotificationPopover />);

    const trigger = await screen.findByRole("button", {
      name: /1 unread notification/i,
    });
    await user.click(trigger);

    // Pagination info should be visible
    expect(await screen.findByText(/Page 1 of 2/i)).toBeInTheDocument();

    const prevBtn = screen.getByRole("button", { name: /previous page/i });
    const nextBtn = screen.getByRole("button", { name: /next page/i });

    expect(prevBtn).toBeDisabled();
    expect(nextBtn).toBeEnabled();

    // Click next page
    await user.click(nextBtn);

    await waitFor(() => {
      expect(notificationsApi.fetchNotifications).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2, limit: 10 }),
      );
    });
  });
});
