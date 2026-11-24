import "server-only";
import { angabenVollstaendig } from "@/lib/datenschutz";
import { einrichtungsSchritte, type EinrichtungStand } from "@/lib/einrichtung";
import { parseAngaben } from "@/lib/wahlausschreiben";
import { loadDatenschutzAngaben } from "./einstellungen";

type ElectionLike = {
  verfahren: "regulaer" | "wahlversammlung";
  wahlausschreibenAngaben: unknown;
  stuetzunterschriftenMin: number | null;
};

export async function loadEinrichtung(election: ElectionLike) {
  const { angaben: ds } = await loadDatenschutzAngaben();
  const stand: EinrichtungStand = {
    verfahren: election.verfahren,
    angaben: parseAngaben(election.wahlausschreibenAngaben),
    stuetzunterschriftenMin: election.stuetzunterschriftenMin,
    datenschutzVollstaendig: angabenVollstaendig(ds),
  };
  return { stand, datenschutz: ds, schritte: einrichtungsSchritte(stand) };
}
