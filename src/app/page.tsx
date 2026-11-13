import { Hero } from "@/components/Hero";
import { BeforeAfter } from "@/components/BeforeAfter";
import { UploadZone } from "@/components/UploadZone";
import { Pricing } from "@/components/Pricing";

export default function Home() {
  return (
    <main className="flex-1">
      <Hero />
      <BeforeAfter />
      <UploadZone />
      <Pricing />
    </main>
  );
}
