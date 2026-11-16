import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import "./styles.css";

// The previous POS bundle installed a service worker on loyalty.dkasu.com.
// Retire it when this independent app takes over the origin.
if ("serviceWorker" in navigator) {
  void navigator.serviceWorker
    .getRegistrations()
    .then((registrations) =>
      Promise.all(
        registrations.map((registration) => registration.unregister())
      )
    );
}
if ("caches" in window) {
  void caches
    .keys()
    .then((names) =>
      Promise.all(
        names
          .filter((name) => name.startsWith("waka-"))
          .map((name) => caches.delete(name))
      )
    );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
