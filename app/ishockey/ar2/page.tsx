import SeasonPage from "../../components/SeasonPage";
import { ishockeyYear2Plan } from "../../data/ishockey";

export const metadata = {
  title: "Ishockey År 2 – Träningsplan 8 år",
  description: "Komplett säsongsplan för ishockey med barn 8 år.",
};

export default function IshockeyYear2Page() {
  return <SeasonPage plan={ishockeyYear2Plan} />;
}
