import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

// ✅ Corrected imports
import LandingPage from "./components/LandingPage.jsx";
import Entry from "./components/authority/Entry.jsx";
import SignIn from "./components/authority/SignIn.jsx";
import SignUp from "./components/authority/SignUp.jsx";
import Dashboard from "./components/authority/Dashboard.jsx";
import ComplaintDetails from "./components/authority/ComplaintDetails.jsx";
import PeopleDashboard from "./components/PeopleDashboard.jsx";
import PeopleChat from "./components/PeopleChat.jsx";  // ✅ Chat component import

import "./styles.css";

createRoot(document.getElementById("root")).render(
  <Router>
    <Routes>
      {/* 🌍 Public Landing */}
      <Route path="/" element={<LandingPage />} />

      {/* 🏛️ Authority Section */}
      <Route path="/authority" element={<Entry />} />
      <Route path="/authority/signin" element={<SignIn />} />
      <Route path="/authority/signup" element={<SignUp />} />
      <Route path="/authority/dashboard" element={<Dashboard />} />
      <Route path="/authority/complaint/:id" element={<ComplaintDetails />} />

      {/* 👥 People Section */}
      <Route path="/people" element={<PeopleDashboard />} />
      <Route path="/chat" element={<PeopleChat />} />  {/* ✅ Chat route */}
    </Routes>
  </Router>
);
