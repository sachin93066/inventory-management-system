
import { useEffect, useState } from "react";
import Login from "./Login";
import Dashboard from "./Dashboard";
import { apiFetch } from "./api";
import "./App.css";

const AUTH_ME_URL = "http://127.0.0.1:5000/api/auth/me";

function App() {
  const [token, setToken] = useState(
    () => sessionStorage.getItem("stockflow_token") || ""
  );
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      const savedToken = sessionStorage.getItem("stockflow_token");

      if (!savedToken) {
        if (!cancelled) {
          setToken("");
          setUser(null);
          setCheckingSession(false);
        }
        return;
      }

      try {
        const response = await apiFetch(AUTH_ME_URL);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.msg || data.error || "Your session has expired."
          );
        }

        const loggedInUser = data.user || data;

        if (!cancelled) {
          setToken(savedToken);
          setUser(loggedInUser);
        }
      } catch (error) {
        sessionStorage.removeItem("stockflow_token");

        if (!cancelled) {
          setToken("");
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setCheckingSession(false);
        }
      }
    }

    checkSession();

    return () => {
      cancelled = true;
    };
  }, []);

  function handleLogin(loginData) {
    const accessToken = loginData?.access_token;
    const loggedInUser = loginData?.user;

    if (!accessToken) {
      console.error(
        "Login response does not contain an access token."
      );
      return;
    }

    sessionStorage.setItem("stockflow_token", accessToken);
    setToken(accessToken);
    setUser(loggedInUser || null);
  }

  function handleLogout() {
    sessionStorage.removeItem("stockflow_token");
    setToken("");
    setUser(null);
  }

  if (checkingSession) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-card">
          <div className="auth-spinner" />
          <h2>StockFlow</h2>
          <p>Verifying your session...</p>
        </div>
      </div>
    );
  }

  if (!token || !user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Dashboard
      user={user}
      onLogout={handleLogout}
    />
  );
}

export default App;