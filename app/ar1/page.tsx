import SeasonPage from "../components/SeasonPage";
import { year1Plan } from "../data/year1";

export const metadata = {
  title: "År 1 – Träningsplan upp till 7 år | Basket",
  description: "Komplett säsongsplan för basket med barn upp till 7 år.",
};

export default function Year1Page() {
  return <SeasonPage plan={year1Plan} />;
}
