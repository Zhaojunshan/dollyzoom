"use client";

const DEMO_KEY = "tj.demo.v1";

export function DemoButton({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      className={`btn btn-ghost ${className}`}
      aria-describedby="demo-cta-note"
      onClick={() => {
        window.localStorage.setItem(DEMO_KEY, "1");
        window.dispatchEvent(new Event("tj-demo"));
        document.getElementById("records")?.scrollIntoView({ behavior: "smooth" });
      }}
    >
      View sample
    </button>
  );
}
