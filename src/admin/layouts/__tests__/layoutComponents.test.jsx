import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NotificationPopover } from "../NotificationPopover";
import { Topbar } from "../Topbar";
import { Sidebar } from "../Sidebar";
import { ProfileDropdown } from "../ProfileDropdown";
import { ThemeProvider } from "@/providers/ThemeProvider";

function renderWithProviders(ui) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ThemeProvider>{ui}</ThemeProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Layout Components — UI/UX Bug Fix Verification", () => {
  // ── 1. NotificationPopover Desktop Hover & Keyboard Accessibility ──────────
  describe("NotificationPopover", () => {
    it("renders notification trigger button with proper aria attributes", () => {
      renderWithProviders(<NotificationPopover notificationCount={3} />);

      const trigger = screen.getByRole("button", {
        name: /3 unread notifications/i,
      });
      expect(trigger).toBeInTheDocument();
      expect(trigger).toHaveAttribute("aria-haspopup", "true");
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(
        screen.queryByRole("region", { name: /^notifications$/i }),
      ).not.toBeInTheDocument();
    });

    it("opens popover panel on mouse hover and stays accessible", async () => {
      const user = userEvent.setup();
      renderWithProviders(<NotificationPopover notificationCount={0} />);

      const trigger = screen.getByRole("button", { name: /^notifications$/i });

      // Hover over trigger
      await user.hover(trigger);

      // Popover should appear
      expect(
        await screen.findByRole("region", { name: /^notifications$/i }),
      ).toBeInTheDocument();
      expect(screen.getByText("Notifications")).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /view full audit logs/i }),
      ).toBeInTheDocument();

      // Unhover trigger
      await user.unhover(trigger);

      // Closes after grace period
      await waitFor(() => {
        expect(
          screen.queryByRole("region", { name: /^notifications$/i }),
        ).not.toBeInTheDocument();
      });
    });

    it("opens popover on click and closes when clicking outside", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <div>
          <NotificationPopover notificationCount={1} />
          <button type="button">Outside element</button>
        </div>,
      );

      const trigger = screen.getByRole("button", {
        name: /1 unread notification/i,
      });

      // Click to open
      await user.click(trigger);
      expect(
        screen.getByRole("region", { name: /^notifications$/i }),
      ).toBeInTheDocument();

      // Click outside
      const outside = screen.getByRole("button", { name: "Outside element" });
      await user.click(outside);

      await waitFor(() => {
        expect(
          screen.queryByRole("region", { name: /^notifications$/i }),
        ).not.toBeInTheDocument();
      });
    });

    it("opens popover on keyboard focus and closes on Escape", async () => {
      const user = userEvent.setup();
      renderWithProviders(<NotificationPopover notificationCount={0} />);

      const trigger = screen.getByRole("button", { name: /^notifications$/i });

      // Focus
      await user.tab();
      expect(document.activeElement).toBe(trigger);

      expect(
        await screen.findByRole("region", { name: /^notifications$/i }),
      ).toBeInTheDocument();

      // Press Escape
      await user.keyboard("{Escape}");

      await waitFor(() => {
        expect(
          screen.queryByRole("region", { name: /^notifications$/i }),
        ).not.toBeInTheDocument();
      });
    });
  });

  // ── 2. Topbar and Hamburger Button ─────────────────────────────────────────
  describe("Topbar", () => {
    it("renders Topbar with title, hamburger menu button, notification popover, and profile", () => {
      const onMenuOpen = vi.fn();
      renderWithProviders(
        <Topbar
          isCollapsed={false}
          onMenuOpen={onMenuOpen}
          adminName="Alex Admin"
          adminEmail="alex@kairos.ai"
          adminRole="admin"
        />,
      );

      // Hamburger button
      const menuBtn = screen.getByRole("button", {
        name: "Open navigation menu",
      });
      expect(menuBtn).toBeInTheDocument();
      expect(menuBtn).toHaveClass("topbar__menu-btn");

      // Clicking calls onMenuOpen
      menuBtn.click();
      expect(onMenuOpen).toHaveBeenCalledTimes(1);

      // Notification popover trigger is present
      expect(
        screen.getByRole("button", { name: /notifications/i }),
      ).toBeInTheDocument();

      // Profile trigger is present
      expect(
        screen.getByRole("button", { name: /account menu for Alex Admin/i }),
      ).toBeInTheDocument();
    });
  });

  // ── 4. Sidebar Rendering & Responsiveness ──────────────────────────────────
  describe("Sidebar", () => {
    it("renders navigation links and does not render removed health indicator", () => {
      const onClose = vi.fn();
      const onToggleCollapse = vi.fn();
      renderWithProviders(
        <Sidebar
          role="admin"
          isOpen={true}
          isCollapsed={false}
          onClose={onClose}
          onToggleCollapse={onToggleCollapse}
        />,
      );

      // Nav items
      expect(
        screen.getByRole("link", { name: "Dashboard" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Users" })).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "Admin Users" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "Audit Logs" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "Settings" }),
      ).toBeInTheDocument();

      // System Status Indicator should be removed
      expect(
        screen.queryByRole("button", {
          name: /System Issues and Health Indicator/i,
        }),
      ).not.toBeInTheDocument();

      // Collapse toggle button
      const collapseBtn = screen.getByRole("button", {
        name: "Collapse sidebar",
      });
      expect(collapseBtn).toBeInTheDocument();
      collapseBtn.click();
      expect(onToggleCollapse).toHaveBeenCalledTimes(1);
    });
  });

  // ── 4. ProfileDropdown Change Password & Removed Options ───────────────────
  describe("ProfileDropdown", () => {
    it("renders Change Password and does not render Profile or Two-Factor Auth", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ProfileDropdown
          adminName="Alex Vance"
          adminEmail="alex@kairos.dev"
          adminRole="admin"
          onLogout={vi.fn()}
        />,
      );

      // Open dropdown
      const trigger = screen.getByRole("button", {
        name: /Account menu for Alex Vance/i,
      });
      await user.click(trigger);

      // Verify Change Password button exists and does not say "Soon"
      const changePasswordBtn = screen.getByRole("menuitem", {
        name: /Change Password/i,
      });
      expect(changePasswordBtn).toBeInTheDocument();
      expect(screen.queryByText(/Soon/i)).not.toBeInTheDocument();

      // Verify Profile and Two-Factor Auth are removed
      expect(
        screen.queryByRole("menuitem", { name: /^Profile/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("menuitem", { name: /Two-Factor/i }),
      ).not.toBeInTheDocument();

      // Clicking Change Password opens the Change Password modal
      await user.click(changePasswordBtn);
      expect(
        screen.getByRole("heading", { name: "Change Password" }),
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/Current Password/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^New Password/i)).toBeInTheDocument();
      expect(
        screen.getByLabelText(/Confirm New Password/i),
      ).toBeInTheDocument();
    });
  });
});
