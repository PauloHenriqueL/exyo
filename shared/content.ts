import dilemmasJson from "../content/dilemmas.json";
import housesJson from "../content/houses.json";
import type { Dilemma, HousesFile } from "./types";

export const DILEMMAS = dilemmasJson.dilemmas as unknown as Dilemma[];
export const HOUSES = housesJson as unknown as HousesFile;
export const DILEMMA_BY_ID: Record<string, Dilemma> = Object.fromEntries(DILEMMAS.map((d) => [d.id, d]));
