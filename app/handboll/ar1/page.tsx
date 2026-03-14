import SeasonPage from "../../components/SeasonPage";
import { handbollYear1Plan } from "../../data/handboll";

export const metadata = {
  title: "Handboll År 1 – Träningsplan upp till 7 år",
  description: "Komplett säsongsplan för handboll med barn upp till 7 år.",
};

export default function HandbollYear1Page() {
  return <SeasonPage plan={handbollYear1Plan} />;
}
