import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { API_BASE, clearApiCache } from "../lib/api";

const TOKEN_KEY = "worklode_access_token";
const USER_KEY = "worklode_auth_user";

type AuthRole = "student" | "admin";

type AuthUser = {
  id: string;
  email: string;
  role: AuthRole;
  plan: string;
  name: string;
  picture: string;
};

type AuthContextValue = {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  signingIn: boolean;
  googleLoading: boolean;
  googleReady: boolean;
  googleEnabled: boolean;
  authError: string | null;
  initializeGoogleAuth: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => void;
};

type GoogleCodeResponse = {
  code?: string;
  error?: string;
  error_description?: string;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function getStoredToken() {
  return (
    sessionStorage.getItem(TOKEN_KEY) ||
    sessionStorage.getItem("access_token") ||
    sessionStorage.getItem("token") ||
    localStorage.getItem(TOKEN_KEY) ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    null
  );
}

function getStoredUser(): AuthUser | null {
  const raw = sessionStorage.getItem(USER_KEY) || localStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    sessionStorage.removeItem(USER_KEY);
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

function persistSession(token: string, user: AuthUser) {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  sessionStorage.setItem("access_token", token);
  sessionStorage.setItem("token", token);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem("access_token");
  localStorage.removeItem("token");
}

function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  sessionStorage.removeItem("access_token");
  sessionStorage.removeItem("token");
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem("access_token");
  localStorage.removeItem("token");
}

function loadGoogleScript() {
  return new Promise<void>((resolve, reject) => {
    if ((window as Window & { google?: unknown }).google) {
      resolve();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Google script")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google script"));
    document.head.appendChild(script);
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [googleClientId, setGoogleClientId] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const codeClientRef = useRef<any>(null);
  const googleInitPromiseRef = useRef<Promise<void> | null>(null);

  const logout = () => {
    clearSession();
    clearApiCache();
    setToken(null);
    setUser(null);
    setAuthError(null);
  };

  useEffect(() => {
    let ignore = false;

    async function bootstrapSession() {
      if (!token) {
        if (!ignore) {
          setLoading(false);
        }
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error(`Failed to restore session (${res.status})`);
        }

        const data = (await res.json()) as AuthUser;
        if (!ignore) {
          setUser(data);
          persistSession(token, data);
        }
      } catch {
        if (!ignore) {
          logout();
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    bootstrapSession();

    return () => {
      ignore = true;
    };
  }, [token]);

  const initializeGoogleAuth = useCallback(async () => {
    if (codeClientRef.current && googleReady) {
      return;
    }

    if (googleInitPromiseRef.current) {
      await googleInitPromiseRef.current;
      return;
    }

    const initPromise = (async () => {
      setGoogleLoading(true);
      try {
        let clientId = googleClientId;
        let enabled = googleEnabled;

        if (!clientId) {
          const res = await fetch(`${API_BASE}/auth/google/config`);
          if (!res.ok) {
            throw new Error(`Failed to load Google auth config (${res.status})`);
          }

          const data = await res.json();
          enabled = Boolean(data?.enabled && data?.client_id);
          clientId = enabled ? String(data.client_id) : "";
          setGoogleEnabled(enabled);
          setGoogleClientId(clientId);
          if (!enabled) {
            throw new Error("Google sign-in is not configured on the backend.");
          }
        }

        await loadGoogleScript();
        const google = (window as Window & { google?: any }).google;
        if (!google?.accounts?.oauth2) {
          throw new Error("Google OAuth client is unavailable");
        }

        codeClientRef.current = google.accounts.oauth2.initCodeClient({
          client_id: clientId,
          scope: "openid email profile",
          ux_mode: "popup",
          callback: async (response: GoogleCodeResponse) => {
            if (response.error || !response.code) {
              setSigningIn(false);
              setAuthError(response.error_description || response.error || "Google sign-in was cancelled");
              return;
            }

            try {
              const res = await fetch(`${API_BASE}/auth/google`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ code: response.code }),
              });

              const data = await res.json();
              if (!res.ok) {
                throw new Error(data?.detail || `Google sign-in failed (${res.status})`);
              }

              const nextToken = String(data.access_token || "");
              const nextUser = data.user as AuthUser | undefined;
              if (!nextToken || !nextUser) {
                throw new Error("Backend did not return a valid session");
              }

              clearApiCache();
              persistSession(nextToken, nextUser);
              setToken(nextToken);
              setUser(nextUser);
              setAuthError(null);
            } catch (err) {
              clearSession();
              setToken(null);
              setUser(null);
              setAuthError(err instanceof Error ? err.message : "Google sign-in failed");
            } finally {
              setSigningIn(false);
            }
          },
        });

        setGoogleReady(true);
        setAuthError(null);
      } catch (err) {
        codeClientRef.current = null;
        setGoogleReady(false);
        setAuthError(err instanceof Error ? err.message : "Failed to initialize Google sign-in");
        throw err;
      } finally {
        setGoogleLoading(false);
        googleInitPromiseRef.current = null;
      }
    })();

    googleInitPromiseRef.current = initPromise;
    await initPromise;
  }, [googleClientId, googleEnabled, googleReady]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token && user),
      loading,
      signingIn,
      googleLoading,
      googleReady,
      googleEnabled,
      authError,
      initializeGoogleAuth,
      signInWithGoogle: async () => {
        try {
          await initializeGoogleAuth();
          if (!codeClientRef.current) {
            throw new Error("Google sign-in is not ready yet");
          }
          setSigningIn(true);
          setAuthError(null);
          codeClientRef.current.requestCode();
        } catch (err) {
          setSigningIn(false);
          if (err instanceof Error) {
            setAuthError(err.message);
          }
        }
      },
      logout,
    }),
    [token, user, loading, signingIn, googleLoading, googleReady, googleEnabled, authError, initializeGoogleAuth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return value;
}
