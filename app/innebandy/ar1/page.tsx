import SeasonPage from "../../components/SeasonPage";
import { innebandyYear1Plan } from "../../data/innebandy";

export const metadata = {
  title: "Innebandy År 1 – Träningsplan upp till 7 år",
  description: "Komplett säsongsplan för innebandy med barn upp till 7 år.",
};

export default function InnebandyYear1Page() {
  return <SeasonPage plan={innebandyYear1Plan} />;
}
