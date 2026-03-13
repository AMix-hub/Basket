import SeasonPage from "../../components/SeasonPage";
import { fotbollYear2Plan } from "../../data/fotboll";

export const metadata = {
  title: "Fotboll År 2 – Träningsplan 8 år",
  description: "Komplett säsongsplan för fotboll med barn 8 år.",
};

export default function FotbollYear2Page() {
  return <SeasonPage plan={fotbollYear2Plan} />;
}
