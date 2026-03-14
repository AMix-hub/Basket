import SeasonPage from "../../components/SeasonPage";
import { fotbollYear1Plan } from "../../data/fotboll";

export const metadata = {
  title: "Fotboll År 1 – Träningsplan upp till 7 år",
  description: "Komplett säsongsplan för fotboll med barn upp till 7 år.",
};

export default function FotbollYear1Page() {
  return <SeasonPage plan={fotbollYear1Plan} />;
}
