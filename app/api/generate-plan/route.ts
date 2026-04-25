import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest) {
  const { players, duration, focus, equipment, sport } = await req.json();

  if (!duration || !focus) {
    return NextResponse.json({ error: "duration och focus krävs" }, { status: 400 });
  }

  const prompt = `Du är en erfaren ungdomstränare inom ${sport ?? "basket"}.
Skapa ett träningspass på ${duration} minuter.
Antal spelare: ${players ?? "okänt"}.
Fokusområde: ${focus}.
Tillgänglig utrustning: ${equipment ?? "standardutrustning"}.

Returnera EXAKT följande JSON-format (inget annat, inga förklaringar):
{
  "theme": "Passende tema för passet (max 60 tecken)",
  "items": [
    { "title": "Momentnamn", "duration_minutes": 10, "description": "Kort beskrivning" }
  ]
}

Regler:
- 4 till 7 moment
- Börja med uppvärmning och avsluta med nedvarvning/reflektion
- Summera momentens minuter till exakt ${duration} minuter
- Varje description max 120 tecken
- Anpassa svårighetsgrad för ungdomar
- Svara ENDAST med JSON, inga backticks, inga förklaringar`;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY saknas på servern." }, { status: 500 });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = (message.content[0] as { type: string; text: string }).text.trim();
    const parsed = JSON.parse(raw);
    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[generate-plan]", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
