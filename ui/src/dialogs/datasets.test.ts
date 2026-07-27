import { test } from "vitest";
import type { ImportFileHandle } from "@platforma-sdk/model";
import type { ParsedFile } from "./datasets";
import { commonDirPrefix, findDuplicateKeys, toPosixPath } from "./datasets";
import { FileNamePattern } from "./file_name_parser";

test.for([
  {
    name: "files in one folder leave bare file names",
    paths: ["/data/run/A_R1.fastq.gz", "/data/run/A_R2.fastq.gz"],
    expected: "/data/run/",
  },
  {
    name: "a single file leaves its bare name",
    paths: ["/data/run/A_R1.fastq.gz"],
    expected: "/data/run/",
  },
  {
    name: "per-sample folders keep the folder",
    paths: ["/data/run/A/R1.fastq.gz", "/data/run/B/R1.fastq.gz"],
    expected: "/data/run/",
  },
  {
    name: "a file name is never mistaken for a shared directory",
    paths: ["/data/run/A/R1.fastq.gz", "/data/run/A/R2.fastq.gz"],
    expected: "/data/run/A/",
  },
  {
    name: "unrelated roots share nothing",
    paths: ["/data/one/A_R1.fastq.gz", "runs/two/B_R1.fastq.gz"],
    expected: "",
  },
  {
    name: "a partial segment match is not a shared directory",
    paths: ["/data/run1/A_R1.fastq.gz", "/data/run2/A_R1.fastq.gz"],
    expected: "/data/",
  },
  {
    name: "no paths",
    paths: [],
    expected: "",
  },
])("commonDirPrefix: $name", ({ paths, expected }, { expect }) => {
  expect(commonDirPrefix(paths)).to.equal(expected);
});

test("toPosixPath normalizes Windows separators", ({ expect }) => {
  expect(toPosixPath("C:\\data\\run\\A_R1.fastq.gz")).to.equal("C:/data/run/A_R1.fastq.gz");
});

/** ParsedFile carrying only what findDuplicateKeys reads. */
function parsed(pattern: FileNamePattern, fileName: string): ParsedFile {
  return {
    handle: `upload://upload/${fileName}` as ImportFileHandle,
    fileName,
    match: pattern.match(fileName),
  };
}

test("findDuplicateKeys is empty when every file resolves to its own identity", ({ expect }) => {
  const pattern = FileNamePattern.parse("{{Sample}}/{{R}}.fastq.gz");
  const files = ["A/R1.fastq.gz", "A/R2.fastq.gz", "B/R1.fastq.gz"].map((f) => parsed(pattern, f));
  expect(findDuplicateKeys(files)).to.toMatchObject([]);
});

test("findDuplicateKeys catches files that would overwrite each other", ({ expect }) => {
  // The folder carries the identity, but the pattern reads only the file name —
  // so both samples collapse onto "R1" and one file would be dropped silently.
  const pattern = FileNamePattern.parse("{{**}}/{{Sample}}.fastq.gz");
  const files = ["A/R1.fastq.gz", "B/R1.fastq.gz"].map((f) => parsed(pattern, f));
  const duplicates = findDuplicateKeys(files);
  expect(duplicates.length).to.equal(1);
  expect(duplicates[0].sample).to.equal("R1");
  expect(duplicates[0].fileNames).to.toMatchObject(["A/R1.fastq.gz", "B/R1.fastq.gz"]);
});

test("findDuplicateKeys treats read index and lane as part of the identity", ({ expect }) => {
  const pattern = FileNamePattern.parse("{{Sample}}_L{{L}}_{{RR}}.fastq.gz");
  const distinct = ["A_L001_R1.fastq.gz", "A_L001_R2.fastq.gz", "A_L002_R1.fastq.gz"].map((f) =>
    parsed(pattern, f),
  );
  expect(findDuplicateKeys(distinct)).to.toMatchObject([]);

  // Unmatched files carry no identity and must not be reported as duplicates.
  const unmatched = ["nope.txt", "also-nope.txt"].map((f) => parsed(pattern, f));
  expect(findDuplicateKeys(unmatched)).to.toMatchObject([]);
});
