import SeasonPage from "../../components/SeasonPage";
import { innebandyYear3Plan } from "../../data/innebandy";

export const metadata = {
  title: "Innebandy År 3 – Träningsplan 9 år",
  description: "Komplett säsongsplan för innebandy med barn 9 år.",
};

export default function InnebandyYear3Page() {
  return <SeasonPage plan={innebandyYear3Plan} />;
}
