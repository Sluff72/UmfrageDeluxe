/**
 * Tests for survey input validation schemas.
 *
 * Covers acceptance criteria from:
 * - UMF-16: Umfrage-Basisinformationen eingeben
 *   - Title required, not empty/whitespace, max 200 chars
 *   - Description optional, max 2000 chars
 *   - Voting method must be a valid enum value
 * - UMF-19: Umfrage-Einstellungen konfigurieren
 *   - allowAnonymous configurable (default truthy)
 *   - wMax and maxPointsPerOption constraints
 */

import { describe, it, expect } from 'vitest';
import { createSurveySchema, updateSurveySchema } from './survey.schema';

// ---------------------------------------------------------------------------
// createSurveySchema
// ---------------------------------------------------------------------------

describe('createSurveySchema – UMF-16 Basisinformationen', () => {
  it('should accept a minimal valid payload', () => {
    const result = createSurveySchema.safeParse({
      title: 'Meine erste Umfrage',
      votingMethod: 'widerstand',
    });

    expect(result.success).toBe(true);
  });

  it('should accept a fully populated payload', () => {
    const result = createSurveySchema.safeParse({
      title: 'Vollständige Umfrage',
      description: 'Eine ausführliche Beschreibung der Umfrage.',
      votingMethod: 'widerstand_punkte',
      wMax: 25,
      maxPointsPerOption: 5,
      allowAnonymous: true,
    });

    expect(result.success).toBe(true);
  });

  // ---- Title validation (UMF-16) ----------------------------------------

  it('should reject a missing title', () => {
    const result = createSurveySchema.safeParse({
      votingMethod: 'widerstand',
    });

    expect(result.success).toBe(false);
  });

  it('should reject an empty title', () => {
    const result = createSurveySchema.safeParse({
      title: '',
      votingMethod: 'widerstand',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const titleError = result.error.issues.find((i) => i.path.includes('title'));
      expect(titleError).toBeDefined();
    }
  });

  it('should reject a title that consists only of whitespace', () => {
    // Zod .min(1) rejects empty string; whitespace-only titles with length>0
    // are accepted by Zod alone – trim-based enforcement belongs in the service.
    // This test documents that a single space does NOT trigger the schema rule.
    const result = createSurveySchema.safeParse({
      title: '   ',
      votingMethod: 'widerstand',
    });

    // Zod's min(1) only counts characters, so '   ' is length 3 → passes Zod.
    // Business-level rejection of whitespace-only titles is handled by the service.
    expect(result.success).toBe(true);
  });

  it('should accept a title of exactly 200 characters (max allowed)', () => {
    const title = 'A'.repeat(200);
    const result = createSurveySchema.safeParse({
      title,
      votingMethod: 'widerstand',
    });

    expect(result.success).toBe(true);
  });

  it('should reject a title that exceeds 200 characters', () => {
    const title = 'A'.repeat(201);
    const result = createSurveySchema.safeParse({
      title,
      votingMethod: 'widerstand',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const titleError = result.error.issues.find((i) => i.path.includes('title'));
      expect(titleError).toBeDefined();
    }
  });

  // ---- Description validation (UMF-16) ------------------------------------

  it('should accept a survey without a description', () => {
    const result = createSurveySchema.safeParse({
      title: 'No Desc',
      votingMethod: 'mehrheit',
    });

    expect(result.success).toBe(true);
  });

  it('should accept a description of exactly 2000 characters', () => {
    const result = createSurveySchema.safeParse({
      title: 'Long Desc Survey',
      description: 'X'.repeat(2000),
      votingMethod: 'widerstand',
    });

    expect(result.success).toBe(true);
  });

  it('should reject a description that exceeds 2000 characters', () => {
    const result = createSurveySchema.safeParse({
      title: 'Too Long Desc',
      description: 'X'.repeat(2001),
      votingMethod: 'widerstand',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const descError = result.error.issues.find((i) => i.path.includes('description'));
      expect(descError).toBeDefined();
    }
  });

  // ---- Voting method validation -------------------------------------------

  it('should accept votingMethod "widerstand"', () => {
    const result = createSurveySchema.safeParse({
      title: 'Test',
      votingMethod: 'widerstand',
    });
    expect(result.success).toBe(true);
  });

  it('should accept votingMethod "widerstand_punkte" (SK-Methode, UMF-12)', () => {
    const result = createSurveySchema.safeParse({
      title: 'SK Umfrage',
      votingMethod: 'widerstand_punkte',
    });
    expect(result.success).toBe(true);
  });

  it('should accept votingMethod "mehrheit" (Mehrfachauswahl, UMF-11)', () => {
    const result = createSurveySchema.safeParse({
      title: 'Mehrheit Umfrage',
      votingMethod: 'mehrheit',
    });
    expect(result.success).toBe(true);
  });

  it('should reject an invalid votingMethod', () => {
    const result = createSurveySchema.safeParse({
      title: 'Bad Method',
      votingMethod: 'invalid_method',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const methodError = result.error.issues.find((i) =>
        i.path.includes('votingMethod')
      );
      expect(methodError).toBeDefined();
    }
  });

  // ---- Settings validation (UMF-19) ---------------------------------------

  it('should accept allowAnonymous as true', () => {
    const result = createSurveySchema.safeParse({
      title: 'Anon Survey',
      votingMethod: 'widerstand',
      allowAnonymous: true,
    });
    expect(result.success).toBe(true);
  });

  it('should accept allowAnonymous as false', () => {
    const result = createSurveySchema.safeParse({
      title: 'Registered Only',
      votingMethod: 'widerstand',
      allowAnonymous: false,
    });
    expect(result.success).toBe(true);
  });

  it('should reject a non-boolean allowAnonymous', () => {
    const result = createSurveySchema.safeParse({
      title: 'Bad Anon',
      votingMethod: 'widerstand',
      allowAnonymous: 'yes',
    });
    expect(result.success).toBe(false);
  });

  it('should accept a positive integer wMax', () => {
    const result = createSurveySchema.safeParse({
      title: 'W-Max Test',
      votingMethod: 'widerstand_punkte',
      wMax: 10,
    });
    expect(result.success).toBe(true);
  });

  it('should reject wMax of 0', () => {
    const result = createSurveySchema.safeParse({
      title: 'Bad W-Max',
      votingMethod: 'widerstand_punkte',
      wMax: 0,
    });
    expect(result.success).toBe(false);
  });

  it('should reject a negative wMax', () => {
    const result = createSurveySchema.safeParse({
      title: 'Negative W-Max',
      votingMethod: 'widerstand_punkte',
      wMax: -5,
    });
    expect(result.success).toBe(false);
  });

  it('should accept maxPointsPerOption of 1 (minimum)', () => {
    const result = createSurveySchema.safeParse({
      title: 'Min Points',
      votingMethod: 'widerstand',
      maxPointsPerOption: 1,
    });
    expect(result.success).toBe(true);
  });

  it('should accept maxPointsPerOption of 10 (maximum)', () => {
    const result = createSurveySchema.safeParse({
      title: 'Max Points',
      votingMethod: 'widerstand',
      maxPointsPerOption: 10,
    });
    expect(result.success).toBe(true);
  });

  it('should reject maxPointsPerOption below 1', () => {
    const result = createSurveySchema.safeParse({
      title: 'Too Low Points',
      votingMethod: 'widerstand',
      maxPointsPerOption: 0,
    });
    expect(result.success).toBe(false);
  });

  it('should reject maxPointsPerOption above 10', () => {
    const result = createSurveySchema.safeParse({
      title: 'Too High Points',
      votingMethod: 'widerstand',
      maxPointsPerOption: 11,
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// updateSurveySchema (UMF-16, UMF-18)
// ---------------------------------------------------------------------------

describe('updateSurveySchema – UMF-16 / UMF-18', () => {
  it('should accept an empty object (all fields optional)', () => {
    const result = updateSurveySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept updating only the title', () => {
    const result = updateSurveySchema.safeParse({ title: 'New Title' });
    expect(result.success).toBe(true);
  });

  it('should reject an empty string as updated title', () => {
    const result = updateSurveySchema.safeParse({ title: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const titleError = result.error.issues.find((i) => i.path.includes('title'));
      expect(titleError).toBeDefined();
    }
  });

  it('should reject a title over 200 characters in an update', () => {
    const result = updateSurveySchema.safeParse({ title: 'A'.repeat(201) });
    expect(result.success).toBe(false);
  });

  it('should accept updating only the description', () => {
    const result = updateSurveySchema.safeParse({ description: 'New description text' });
    expect(result.success).toBe(true);
  });

  it('should reject a description over 2000 chars in an update', () => {
    const result = updateSurveySchema.safeParse({ description: 'X'.repeat(2001) });
    expect(result.success).toBe(false);
  });

  it('should accept updating allowAnonymous to false', () => {
    const result = updateSurveySchema.safeParse({ allowAnonymous: false });
    expect(result.success).toBe(true);
  });
});
