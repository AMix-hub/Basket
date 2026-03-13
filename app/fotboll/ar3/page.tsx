import SeasonPage from "../../components/SeasonPage";
import { fotbollYear3Plan } from "../../data/fotboll";

export const metadata = {
  title: "Fotboll År 3 – Träningsplan 9 år",
  description: "Komplett säsongsplan för fotboll med barn 9 år.",
};

export default function FotbollYear3Page() {
  return <SeasonPage plan={fotbollYear3Plan} />;
}
