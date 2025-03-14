import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

console.log('Starting application render process');
try {
  const rootElement = document.getElementById("root");
  console.log('Root element found:', rootElement);
  
  if (rootElement) {
    const root = createRoot(rootElement);
    console.log('Root created, rendering App component');
    root.render(<App />);
    console.log('App rendered successfully');
  } else {
    console.error('Root element not found in DOM');
  }
} catch (error) {
  console.error('Error rendering application:', error);
}
