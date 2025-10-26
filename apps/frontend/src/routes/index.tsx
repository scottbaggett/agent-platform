import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: App });

function App() {
  return (
    <div className="min-h-screen">
      <h1>Agent Frontend</h1>
    </div>
  );
}
