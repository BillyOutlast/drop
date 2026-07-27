#![cfg(test)]
extern crate test_generator;

use std::path::Path;

use test_generator::test_resources;
use tokio::io::SimplexStream;

use crate::manifest::{generate_manifest_rusty, ManifestWriterFactory};

#[test_resources("testfiles/**/*.7z")]
fn manifest_gen(resource: &str) {
    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .expect("failed to create tokio runtime");

    runtime.block_on(async move {
        let filepath = Path::new(resource);
        let manifest = generate_manifest_rusty(
            filepath,
            |_| {},
            |message| {
                println!("({}) {}", filepath.display(), message);
            },
            None::<&dyn ManifestWriterFactory<Writer = SimplexStream>>, // Dummy type signature, not actually used
            None,
        )
        .await
        .unwrap_or_else(|err| {
            panic!(
                "failed to generate manifest for {}: {:?}",
                filepath.display(),
                err
            )
        });

        let first_chunk = manifest
            .chunks
            .values()
            .next()
            .expect("no chunks generated");
        let first_chunk_length = first_chunk.files.len();
        if first_chunk_length == 0 {
            panic!("{} has no files in manifest", filepath.display());
        }
    });
}

mod manifest_unit_tests {
    use crate::manifest::{
        collect_split_files, collect_whole_files, organise_files, push_chunk, CHUNK_SIZE,
    };
    use crate::versions::types::VersionFile;

    fn make_file(name: &str, size: u64) -> VersionFile {
        VersionFile {
            relative_filename: name.to_string(),
            size,
            permission: 0o644,
        }
    }

    // ── push_chunk ─────────────────────────────────────────────

    #[test]
    fn test_push_chunk_to_empty_chunks() {
        let mut chunks: Vec<Vec<(VersionFile, u64, u64)>> = Vec::new();
        let file = make_file("a.bin", 100);
        let mut chunk = vec![(file, 0, 100)];

        push_chunk(&mut chunks, &mut chunk);

        assert_eq!(chunks.len(), 1, "should have pushed one chunk");
        assert_eq!(chunks[0].len(), 1, "chunk should hold the file entry");
        assert!(chunk.is_empty(), "source chunk should be taken (mem::take)");
    }

    #[test]
    fn test_push_chunk_multiple_times() {
        let mut chunks: Vec<Vec<(VersionFile, u64, u64)>> = Vec::new();
        let mut chunk = vec![(make_file("a.bin", 10), 0, 10)];

        push_chunk(&mut chunks, &mut chunk);
        chunk.push((make_file("b.bin", 20), 0, 20));
        push_chunk(&mut chunks, &mut chunk);
        chunk.push((make_file("c.bin", 30), 0, 30));
        push_chunk(&mut chunks, &mut chunk);

        assert_eq!(chunks.len(), 3);
        assert_eq!(chunks[0][0].0.relative_filename, "a.bin");
        assert_eq!(chunks[1][0].0.relative_filename, "b.bin");
        assert_eq!(chunks[2][0].0.relative_filename, "c.bin");
    }

    // ── collect_whole_files ────────────────────────────────────

    #[test]
    fn test_collect_whole_file_smaller_than_chunk_size() {
        let file = make_file("small.bin", 1024); // 1 KiB << 64 MiB
        let mut current_chunk = Vec::new();
        let mut chunks: Vec<Vec<(VersionFile, u64, u64)>> = Vec::new();

        collect_whole_files(file, &mut current_chunk, &mut chunks);

        assert_eq!(chunks.len(), 0, "no full chunk pushed yet");
        assert_eq!(current_chunk.len(), 1, "file added to working chunk");
        assert_eq!(current_chunk[0].1, 0, "starts at offset 0");
    }

    #[test]
    fn test_collect_whole_file_larger_than_chunk_size() {
        let file = make_file("huge.bin", CHUNK_SIZE); // exactly CHUNK_SIZE
        let mut current_chunk = Vec::new();
        let mut chunks: Vec<Vec<(VersionFile, u64, u64)>> = Vec::new();

        collect_whole_files(file, &mut current_chunk, &mut chunks);

        assert_eq!(chunks.len(), 1, "large file gets its own chunk");
        assert_eq!(chunks[0].len(), 1);
        assert!(
            current_chunk.is_empty(),
            "large file not added to working chunk"
        );
    }

    #[test]
    fn test_collect_whole_file_fills_chunk() {
        // current_chunk already partially full; adding this file pushes past CHUNK_SIZE
        let partial = make_file("partial.bin", CHUNK_SIZE - 500);
        let filler = make_file("filler.bin", 1000); // makes total = CHUNK_SIZE + 500
        let mut current_chunk = vec![(partial, 0, CHUNK_SIZE - 500)];
        let mut chunks: Vec<Vec<(VersionFile, u64, u64)>> = Vec::new();

        collect_whole_files(filler, &mut current_chunk, &mut chunks);

        assert_eq!(chunks.len(), 1, "full chunk should be pushed");
        assert!(
            current_chunk.is_empty(),
            "current_chunk taken by push_chunk"
        );
    }

    // ── collect_split_files ────────────────────────────────────

    #[test]
    fn test_collect_split_file_fits_in_remaining_space() {
        let file = make_file("fits.bin", CHUNK_SIZE / 2); // 32 MiB fits in empty chunk
        let mut current_chunk = Vec::new();
        let mut chunks: Vec<Vec<(VersionFile, u64, u64)>> = Vec::new();

        collect_split_files(file, &mut current_chunk, &mut chunks);

        assert_eq!(chunks.len(), 0, "no chunk pushed when file fits");
        assert_eq!(current_chunk.len(), 1);
        assert_eq!(current_chunk[0].1, 0, "offset 0 for full file");
        assert_eq!(
            current_chunk[0].2,
            CHUNK_SIZE / 2,
            "length is full file size"
        );
    }

    #[test]
    fn test_collect_split_file_spans_multiple_chunks() {
        // current_chunk nearly full; file is larger than a chunk.
        // The while loop fills remaining space, then creates whole chunks,
        // and any leftover < CHUNK_SIZE stays in current_chunk.
        let near_full = make_file("near_full.bin", CHUNK_SIZE - 100);
        // big = 2 * CHUNK_SIZE → after filling 100 free bytes, remaining
        // is 2*CHUNK_SIZE - 100 = one full CHUNK_SIZE + (CHUNK_SIZE - 100) remainder
        let big = make_file("big.bin", CHUNK_SIZE * 2);
        let mut current_chunk = vec![(near_full, 0, CHUNK_SIZE - 100)];
        let mut chunks: Vec<Vec<(VersionFile, u64, u64)>> = Vec::new();

        collect_split_files(big, &mut current_chunk, &mut chunks);

        // 1 chunk for the 100-byte fill + 1 chunk for the full CHUNK_SIZE portion
        assert_eq!(chunks.len(), 2, "fill chunk + one whole chunk");
        // remainder (CHUNK_SIZE - 100) stays in current_chunk
        assert_eq!(current_chunk.len(), 1);
        assert_eq!(current_chunk[0].2, CHUNK_SIZE - 100, "remainder length");
    }

    #[test]
    fn test_collect_split_file_with_remainder() {
        let near_full = make_file("near_full2.bin", CHUNK_SIZE - 100);
        // odd = CHUNK_SIZE + 50 → after filling 100 free bytes, remaining
        // is (CHUNK_SIZE - 50) which is < CHUNK_SIZE → stays in current_chunk
        let odd = make_file("odd.bin", CHUNK_SIZE + 50);
        let mut current_chunk = vec![(near_full, 0, CHUNK_SIZE - 100)];
        let mut chunks: Vec<Vec<(VersionFile, u64, u64)>> = Vec::new();

        collect_split_files(odd, &mut current_chunk, &mut chunks);

        // 1 chunk for the 100-byte fill
        assert_eq!(chunks.len(), 1, "only fill chunk pushed");
        // remainder (CHUNK_SIZE - 50) stays in current_chunk
        assert_eq!(current_chunk.len(), 1);
        assert_eq!(current_chunk[0].2, CHUNK_SIZE - 50, "remainder length");
    }

    // ── organise_files ─────────────────────────────────────────

    #[test]
    fn test_organise_files_require_whole_files() {
        let files = vec![
            make_file("small.bin", 1024),
            make_file("medium.bin", CHUNK_SIZE - 100),
            make_file("huge.bin", CHUNK_SIZE),
        ];
        let chunks = organise_files(files, true);

        // small + medium fit in one chunk; huge gets its own
        assert_eq!(chunks.len(), 2, "one combined chunk + one solo chunk");
        // The combined chunk should have 2 files
        let combined = &chunks[0];
        assert_eq!(combined.len(), 2, "small + medium together");
        // The solo chunk should have 1 file (huge)
        let solo = &chunks[1];
        assert_eq!(solo.len(), 1, "huge file alone");
        assert_eq!(solo[0].0.relative_filename, "huge.bin");
        assert_eq!(solo[0].0.size, CHUNK_SIZE);
    }

    #[test]
    fn test_organise_files_allow_split() {
        let files = vec![
            make_file("a.bin", CHUNK_SIZE * 3), // 192 MiB — spans multiple splits
            make_file("b.bin", 1024),           // small, goes into remainder space
        ];
        let chunks = organise_files(files, false);

        // a.bin covers 3 chunks, b.bin goes into remainder
        assert!(
            chunks.len() >= 3,
            "large file should produce at least 3 chunks"
        );
        // Verify no file lost — count entries across all chunks
        let total_entries: usize = chunks.iter().map(|c| c.len()).sum();
        assert_eq!(
            total_entries, 4,
            "3 file references for a.bin + 1 for b.bin"
        );
    }

    #[test]
    fn test_organise_files_empty_input() {
        let chunks = organise_files(vec![], true);
        assert!(chunks.is_empty(), "no files means no chunks");

        let chunks = organise_files(vec![], false);
        assert!(chunks.is_empty(), "no files means no chunks (split mode)");
    }
}
