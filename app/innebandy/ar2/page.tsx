import SeasonPage from "../../components/SeasonPage";
import { innebandyYear2Plan } from "../../data/innebandy";

export const metadata = {
  title: "Innebandy År 2 – Träningsplan 8 år",
  description: "Komplett säsongsplan för innebandy med barn 8 år.",
};

export default function InnebandyYear2Page() {
  return <SeasonPage plan={innebandyYear2Plan} />;
}
