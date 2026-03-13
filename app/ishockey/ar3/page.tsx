import SeasonPage from "../../components/SeasonPage";
import { ishockeyYear3Plan } from "../../data/ishockey";

export const metadata = {
  title: "Ishockey År 3 – Träningsplan 9 år",
  description: "Komplett säsongsplan för ishockey med barn 9 år.",
};

export default function IshockeyYear3Page() {
  return <SeasonPage plan={ishockeyYear3Plan} />;
}
