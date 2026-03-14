import SeasonPage from "../../components/SeasonPage";
import { tennisYear2Plan } from "../../data/tennis";

export const metadata = {
  title: "Tennis År 2 – Träningsplan 8 år",
  description: "Komplett säsongsplan för tennis med barn 8 år.",
};

export default function TennisYear2Page() {
  return <SeasonPage plan={tennisYear2Plan} />;
}
