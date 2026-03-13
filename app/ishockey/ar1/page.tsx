import SeasonPage from "../../components/SeasonPage";
import { ishockeyYear1Plan } from "../../data/ishockey";

export const metadata = {
  title: "Ishockey År 1 – Träningsplan upp till 7 år",
  description: "Komplett säsongsplan för ishockey med barn upp till 7 år.",
};

export default function IshockeyYear1Page() {
  return <SeasonPage plan={ishockeyYear1Plan} />;
}
