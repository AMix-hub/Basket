import SeasonPage from "../../components/SeasonPage";
import { tennisYear3Plan } from "../../data/tennis";

export const metadata = {
  title: "Tennis År 3 – Träningsplan 9 år",
  description: "Komplett säsongsplan för tennis med barn 9 år.",
};

export default function TennisYear3Page() {
  return <SeasonPage plan={tennisYear3Plan} />;
}
