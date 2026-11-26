import { describe, expect, test } from "vitest";
import type { ConfigB } from "./lineage";
import { buildB } from "./lineage";
import { suggestB } from "./suggest";
import type { StudySpec, Table } from "./table";
import studies from "./synthetic-studies.json";

// The synthetic studies of experimental-design-ui-wizard, with the designs its own code built
// from the pre-filled answers and from the hand-written ones. The port must build the same.
type Study = {
  slug: string;
  table: Table;
  suggested: ConfigB;
  answered: ConfigB;
  designs: { suggested: StudySpec["materials"]; answered: StudySpec["materials"] };
};

describe.each(studies as unknown as Study[])("$slug", (study) => {
  test("pre-fills the same answers", () => {
    expect(suggestB(study.table)).toEqual(study.suggested);
  });
  test("builds the same design from the pre-filled answers", () => {
    expect(buildB(study.table, study.suggested).materials).toEqual(study.designs.suggested);
  });
  test("builds the same design from the hand-written answers", () => {
    expect(buildB(study.table, study.answered).materials).toEqual(study.designs.answered);
  });
});
