import SeasonPage from "../../components/SeasonPage";
import { handbollYear3Plan } from "../../data/handboll";

export const metadata = {
  title: "Handboll År 3 – Träningsplan 9 år",
  description: "Komplett säsongsplan för handboll med barn 9 år.",
};

export default function HandbollYear3Page() {
  return <SeasonPage plan={handbollYear3Plan} />;
}
