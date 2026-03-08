import SeasonPage from "../components/SeasonPage";
import { year2Plan } from "../data/year2";

export const metadata = {
  title: "År 2 – Träningsplan 8 år | Basket",
  description: "Komplett säsongsplan för basket med 8-åringar.",
};

export default function Year2Page() {
  return <SeasonPage plan={year2Plan} />;
}
