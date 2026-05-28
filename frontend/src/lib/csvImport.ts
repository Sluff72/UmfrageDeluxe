import type { VotingMethod } from "@/types/survey";

export const MAX_IMPORT_SURVEYS = 50;
export const MAX_OPTIONS_PER_SURVEY = 100;
const TITLE_MAX_LENGTH = 200;
const DESCRIPTION_MAX_LENGTH = 2000;
const OPTION_TITLE_MAX_LENGTH = 300;

export interface ParsedImportOption {
  title: string;
  description?: string;
}

export interface ParsedImportSurvey {
  title: string;
  description?: string;
  votingMethod: VotingMethod;
  wMax?: number;
  maxPointsPerOption?: number;
  allowAnonymous?: boolean;
  options: ParsedImportOption[];
}

export interface RowError {
  /** 1-based row number as seen in the CSV (header excluded). */
  row: number;
  message: string;
}

export interface CsvImportResult {
  surveys: ParsedImportSurvey[];
  errors: RowError[];
}

/**
 * Maps German voting-method labels (and common short forms) to the internal
 * enum value. Case-insensitive and whitespace-tolerant.
 */
const ART_ALIASES: Record<string, VotingMethod> = {
  widerstandsabfrage: "widerstand",
  widerstand: "widerstand",
  "widerstandsabfrage mit punkteregel": "widerstand_punkte",
  "widerstand mit punkten": "widerstand_punkte",
  widerstandspunkte: "widerstand_punkte",
  mehrheitsentscheid: "mehrheit",
  mehrheit: "mehrheit",
};

function mapArt(value: string): VotingMethod | null {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
  return ART_ALIASES[normalized] ?? null;
}

const TRUE_VALUES = new Set(["ja", "true", "wahr", "1", "yes"]);
const FALSE_VALUES = new Set(["nein", "false", "falsch", "0", "no"]);

function parseBoolean(value: string): boolean | null | undefined {
  const normalized = value.trim().toLowerCase();
  if (normalized === "") return undefined;
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return null; // invalid
}

/**
 * Parses CSV text into a matrix of rows/cells. Handles quoted fields,
 * escaped quotes (""), commas and newlines inside quotes, and CRLF endings.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  // Strip a leading UTF-8 BOM if present.
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (char === "\r") {
      i += 1;
      continue;
    }
    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
      continue;
    }
    field += char;
    i += 1;
  }

  // Flush the final field/row (file may not end with a newline).
  row.push(field);
  rows.push(row);

  // Drop fully empty rows (e.g. trailing blank lines).
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

interface HeaderLayout {
  titleIdx: number;
  descriptionIdx: number;
  artIdx: number;
  wMaxIdx: number;
  maxPointsIdx: number;
  anonymIdx: number;
  optionIdxs: number[];
}

const HEADER_ALIASES: Record<string, keyof Omit<HeaderLayout, "optionIdxs">> = {
  titel: "titleIdx",
  title: "titleIdx",
  beschreibung: "descriptionIdx",
  description: "descriptionIdx",
  art: "artIdx",
  "w_max": "wMaxIdx",
  wmax: "wMaxIdx",
  "w-max": "wMaxIdx",
  max_punkte: "maxPointsIdx",
  maxpunkte: "maxPointsIdx",
  anonym: "anonymIdx",
};

function buildHeaderLayout(headerCells: string[]): HeaderLayout {
  const layout: HeaderLayout = {
    titleIdx: -1,
    descriptionIdx: -1,
    artIdx: -1,
    wMaxIdx: -1,
    maxPointsIdx: -1,
    anonymIdx: -1,
    optionIdxs: [],
  };

  const optionColumns: { idx: number; order: number }[] = [];

  headerCells.forEach((raw, idx) => {
    const key = raw.trim().toLowerCase();
    const mapped = HEADER_ALIASES[key];
    if (mapped) {
      layout[mapped] = idx;
      return;
    }
    const optionMatch = key.match(/^option\s*(\d*)$/);
    if (optionMatch) {
      const order = optionMatch[1] === "" ? idx : Number(optionMatch[1]);
      optionColumns.push({ idx, order });
    }
  });

  optionColumns.sort((a, b) => a.order - b.order);
  layout.optionIdxs = optionColumns.map((c) => c.idx);

  return layout;
}

function cellAt(cells: string[], idx: number): string {
  if (idx < 0) return "";
  return (cells[idx] ?? "").trim();
}

/**
 * Parses the full CSV text into survey import objects. Returns both the valid
 * surveys and a list of per-row errors so the UI can show a preview with
 * problems highlighted. The import should only proceed when `errors` is empty.
 */
export function parseSurveysCsv(text: string): CsvImportResult {
  const matrix = parseCsv(text);
  const errors: RowError[] = [];

  if (matrix.length === 0) {
    return { surveys: [], errors: [{ row: 0, message: "Die Datei ist leer" }] };
  }

  const layout = buildHeaderLayout(matrix[0]);

  if (layout.titleIdx === -1) {
    errors.push({ row: 0, message: 'Spalte "titel" fehlt in der Kopfzeile' });
  }
  if (layout.artIdx === -1) {
    errors.push({ row: 0, message: 'Spalte "art" fehlt in der Kopfzeile' });
  }
  if (errors.length > 0) {
    return { surveys: [], errors };
  }

  const dataRows = matrix.slice(1);

  if (dataRows.length === 0) {
    return { surveys: [], errors: [{ row: 0, message: "Keine Umfragen in der Datei gefunden" }] };
  }

  if (dataRows.length > MAX_IMPORT_SURVEYS) {
    errors.push({
      row: 0,
      message: `Maximal ${MAX_IMPORT_SURVEYS} Umfragen pro Import erlaubt (${dataRows.length} gefunden)`,
    });
  }

  const surveys: ParsedImportSurvey[] = [];

  dataRows.forEach((cells, index) => {
    const rowNumber = index + 1;
    const rowErrors: string[] = [];

    const title = cellAt(cells, layout.titleIdx);
    if (title === "") {
      rowErrors.push("Titel fehlt");
    } else if (title.length > TITLE_MAX_LENGTH) {
      rowErrors.push(`Titel darf maximal ${TITLE_MAX_LENGTH} Zeichen lang sein`);
    }

    const description = cellAt(cells, layout.descriptionIdx);
    if (description.length > DESCRIPTION_MAX_LENGTH) {
      rowErrors.push(`Beschreibung darf maximal ${DESCRIPTION_MAX_LENGTH} Zeichen lang sein`);
    }

    const artRaw = cellAt(cells, layout.artIdx);
    const votingMethod = artRaw === "" ? null : mapArt(artRaw);
    if (artRaw === "") {
      rowErrors.push("Art der Umfrage fehlt");
    } else if (votingMethod === null) {
      rowErrors.push(`Unbekannte Art "${artRaw}" (erlaubt: Widerstandsabfrage, Widerstandsabfrage mit Punkteregel, Mehrheitsentscheid)`);
    }

    let wMax: number | undefined;
    const wMaxRaw = cellAt(cells, layout.wMaxIdx);
    if (wMaxRaw !== "") {
      const parsed = Number(wMaxRaw);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        rowErrors.push("W-Max muss eine positive ganze Zahl sein");
      } else {
        wMax = parsed;
      }
    }

    let maxPointsPerOption: number | undefined;
    const maxPointsRaw = cellAt(cells, layout.maxPointsIdx);
    if (maxPointsRaw !== "") {
      const parsed = Number(maxPointsRaw);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10) {
        rowErrors.push("Max. Punkte pro Option muss zwischen 1 und 10 liegen");
      } else {
        maxPointsPerOption = parsed;
      }
    }

    let allowAnonymous: boolean | undefined;
    const anonymRaw = cellAt(cells, layout.anonymIdx);
    const parsedAnonym = parseBoolean(anonymRaw);
    if (parsedAnonym === null) {
      rowErrors.push(`Ungültiger Wert für "anonym": "${anonymRaw}" (ja/nein)`);
    } else {
      allowAnonymous = parsedAnonym;
    }

    const options: ParsedImportOption[] = [];
    layout.optionIdxs.forEach((optIdx) => {
      const optTitle = cellAt(cells, optIdx);
      if (optTitle === "") return;
      if (optTitle.length > OPTION_TITLE_MAX_LENGTH) {
        rowErrors.push(`Option "${optTitle.slice(0, 20)}…" überschreitet ${OPTION_TITLE_MAX_LENGTH} Zeichen`);
        return;
      }
      options.push({ title: optTitle });
    });

    if (options.length > MAX_OPTIONS_PER_SURVEY) {
      rowErrors.push(`Maximal ${MAX_OPTIONS_PER_SURVEY} Optionen pro Umfrage erlaubt`);
    }

    if (rowErrors.length > 0) {
      errors.push({ row: rowNumber, message: rowErrors.join("; ") });
      return;
    }

    surveys.push({
      title,
      ...(description !== "" ? { description } : {}),
      votingMethod: votingMethod as VotingMethod,
      ...(wMax !== undefined ? { wMax } : {}),
      ...(maxPointsPerOption !== undefined ? { maxPointsPerOption } : {}),
      ...(allowAnonymous !== undefined ? { allowAnonymous } : {}),
      options,
    });
  });

  return { surveys, errors };
}
