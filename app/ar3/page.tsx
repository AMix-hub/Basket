import SeasonPage from "../components/SeasonPage";
import { year3Plan } from "../data/year3";

export const metadata = {
  title: "År 3 – Träningsplan 9 år | Basket",
  description: "Komplett säsongsplan för basket med 9-åringar.",
};

export default function Year3Page() {
  return <SeasonPage plan={year3Plan} />;
}
