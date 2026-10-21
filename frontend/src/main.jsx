import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { isLite } from "./lite.js";
import "./styles.css";

if (isLite()) document.documentElement.classList.add("lite");

createRoot(document.getElementById("root")).render(<App />);
