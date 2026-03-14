import SeasonPage from "../../components/SeasonPage";
import { handbollYear2Plan } from "../../data/handboll";

export const metadata = {
  title: "Handboll År 2 – Träningsplan 8 år",
  description: "Komplett säsongsplan för handboll med barn 8 år.",
};

export default function HandbollYear2Page() {
  return <SeasonPage plan={handbollYear2Plan} />;
}
