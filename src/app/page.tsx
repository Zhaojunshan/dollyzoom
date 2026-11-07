import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { BeforeAfter } from "@/components/BeforeAfter";
import { UploadZone } from "@/components/UploadZone";
import { Pricing } from "@/components/Pricing";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Hero />
        <BeforeAfter />
        <UploadZone />
        <Pricing />
      </main>
      <Footer />
    </>
  );
}
