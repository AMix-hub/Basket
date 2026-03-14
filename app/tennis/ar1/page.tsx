import SeasonPage from "../../components/SeasonPage";
import { tennisYear1Plan } from "../../data/tennis";

export const metadata = {
  title: "Tennis År 1 – Träningsplan upp till 7 år",
  description: "Komplett säsongsplan för tennis med barn upp till 7 år.",
};

export default function TennisYear1Page() {
  return <SeasonPage plan={tennisYear1Plan} />;
}
