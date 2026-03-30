import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AdminPage from "./pages/AdminPage";
import TermsPage from "./pages/TermsPage";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/"       element={<Navigate to="/terms" replace />} />
        <Route path="/terms"  element={<TermsPage />} />
        <Route path="/admin"  element={<AdminPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
