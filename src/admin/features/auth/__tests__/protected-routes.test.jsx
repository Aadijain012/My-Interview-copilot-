/**
 * protected-routes.test.tsx — Route guard and auth state persistence tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { AuthProvider } from "../AuthProvider";
import { useAuth } from "../useAuth";
import {
  ProtectedRoute,
  PublicOnlyRoute,
} from "../../../router/ProtectedRoute";

// Lightweight test pages
const DashboardPage = () => <div>Dashboard</div>;
const LoginPage = () => <div>Login</div>;

// ── localStorage mock ─────────────────────────────────────────────────────────

const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, val) => {
      store[key] = val;
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();
vi.stubGlobal("localStorage", localStorageMock);

// Mock fetch for logout
vi.stubGlobal(
  "fetch",
  vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: { get: () => "application/json" },
    json: () => Promise.resolve({ ok: true }),
    text: () => Promise.resolve(""),
  }),
);

function seedAuth() {
  localStorageMock.setItem("kairos_admin_access_token", "fake-access");
  localStorageMock.setItem("kairos_admin_refresh_token", "fake-refresh");
  localStorageMock.setItem(
    "kairos_admin_identity",
    JSON.stringify({
      id: "1",
      email: "admin@example.com",
      name: "Admin",
      role: "admin",
    }),
  );
}

function clearAuth() {
  localStorageMock.clear();
}

function renderWithRouter(initialPath) {
  const router = createMemoryRouter(
    [
      {
        element: <PublicOnlyRoute />,
        children: [{ path: "login", element: <LoginPage /> }],
      },
      {
        element: <ProtectedRoute />,
        children: [
          { path: "/", element: <DashboardPage /> },
          { path: "dashboard", element: <DashboardPage /> },
        ],
      },
    ],
    { initialEntries: [initialPath] },
  );

  render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    clearAuth();
  });

  it("redirects unauthenticated user from /dashboard to /login", async () => {
    renderWithRouter("/dashboard");
    expect(await screen.findByText("Login")).toBeInTheDocument();
  });

  it("renders protected page for authenticated user", async () => {
    seedAuth();
    renderWithRouter("/dashboard");
    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
  });
});

describe("PublicOnlyRoute", () => {
  beforeEach(() => {
    clearAuth();
  });

  it("renders login page when not authenticated", async () => {
    renderWithRouter("/login");
    expect(await screen.findByText("Login")).toBeInTheDocument();
  });

  it("redirects authenticated user from /login to /dashboard", async () => {
    seedAuth();
    renderWithRouter("/login");
    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
  });
});

describe("Auth state persistence", () => {
  beforeEach(() => {
    clearAuth();
  });

  it("recovers authenticated state from localStorage on mount", async () => {
    seedAuth();
    renderWithRouter("/dashboard");
    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
  });

  it("treats partial auth state (no tokens) as unauthenticated", async () => {
    // Only identity stored, no tokens — must be unauthenticated
    localStorageMock.setItem(
      "kairos_admin_identity",
      JSON.stringify({
        id: "1",
        email: "a@b.com",
        name: "Admin",
        role: "admin",
      }),
    );
    renderWithRouter("/dashboard");
    expect(await screen.findByText("Login")).toBeInTheDocument();
  });
});

describe("Logout", () => {
  beforeEach(() => {
    clearAuth();
  });

  it("clears auth state and redirects to login after logout", async () => {
    seedAuth();

    // Page with a logout button using useAuth
    function LogoutPage() {
      const { logout } = useAuth();
      return <button onClick={() => void logout()}>Logout</button>;
    }

    const router = createMemoryRouter(
      [
        {
          element: <PublicOnlyRoute />,
          children: [{ path: "login", element: <LoginPage /> }],
        },
        {
          element: <ProtectedRoute />,
          children: [{ path: "dashboard", element: <LogoutPage /> }],
        },
      ],
      { initialEntries: ["/dashboard"] },
    );

    render(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );
    const btn = await screen.findByRole("button", { name: /logout/i });
    await userEvent.click(btn);
    expect(await screen.findByText("Login")).toBeInTheDocument();
  });
});
