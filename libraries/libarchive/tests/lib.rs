extern crate libarchive_drop;

pub mod util;

use libarchive_drop::archive::{self, Entry, ReadFilter, ReadFormat};
use libarchive_drop::reader::{self, Reader};
use libarchive_drop::writer;
use std::fs::File;

#[test]
fn reading_from_file() {
    let tar = util::path::fixture("sample.tar.gz");
    let mut builder = reader::Builder::new();
    builder.support_format(ReadFormat::All).ok();
    builder.support_filter(ReadFilter::All).ok();
    let mut reader = builder.open_file(tar).ok().unwrap();
    reader.next_header();
    // let entry: &archive::Entry = &reader.entry;
    // println!("{:?}", entry.pathname());
    // println!("{:?}", entry.size());
    // for entry in reader.entries() {
    //     let file = entry as &archive::Entry;
    //     println!("{:?}", file.pathname());
    //     println!("{:?}", file.size());
    // }
    assert_eq!(4, 4);
}

#[test]
fn read_archive_from_stream() {
    let tar = util::path::fixture("sample.tar.gz");
    let f = File::open(tar).ok().unwrap();
    let mut builder = reader::Builder::new();
    builder.support_format(ReadFormat::All).ok();
    builder.support_filter(ReadFilter::All).ok();
    match builder.open_stream(f) {
        Ok(mut reader) => {
            assert_eq!(reader.header_position(), 0);
            let writer = writer::Disk::new();
            let count = writer
                .write(&mut reader, Some("/opt/bldr/fucks"))
                .ok()
                .unwrap();
            assert_eq!(count, 14);
            assert_eq!(reader.header_position(), 1024);
            assert_eq!(4, 4);
        }
        Err(e) => {
            println!("{:?}", e);
        }
    }
}

#[test]
fn extracting_from_file() {
    let tar = util::path::fixture("sample.tar.gz");
    let mut builder = reader::Builder::new();
    builder.support_format(ReadFormat::All).ok();
    builder.support_filter(ReadFilter::All).ok();
    let mut reader = builder.open_file(tar).ok().unwrap();
    println!("{:?}", reader.header_position());
    let writer = writer::Disk::new();
    writer.write(&mut reader, None).ok();
    println!("{:?}", reader.header_position());
    assert_eq!(4, 4)
}

#[test]
fn extracting_an_archive_with_options() {
    let tar = util::path::fixture("sample.tar.gz");
    let mut builder = reader::Builder::new();
    builder.support_format(ReadFormat::All).ok();
    builder.support_filter(ReadFilter::All).ok();
    let mut reader = builder.open_file(tar).ok().unwrap();
    println!("{:?}", reader.header_position());
    let mut opts = archive::ExtractOptions::new();
    opts.add(archive::ExtractOption::Time);
    let writer = writer::Disk::new();
    writer.set_options(&opts).ok();
    writer.write(&mut reader, None).ok();
    println!("{:?}", reader.header_position());
    assert_eq!(4, 4)
}

#[test]
fn extracting_a_reader_twice() {
    let tar = util::path::fixture("sample.tar.gz");
    let mut builder = reader::Builder::new();
    builder.support_format(ReadFormat::All).ok();
    builder.support_filter(ReadFilter::All).ok();
    let mut reader = builder.open_file(tar).ok().unwrap();
    println!("{:?}", reader.header_position());
    let writer = writer::Disk::new();
    writer.write(&mut reader, None).ok();
    println!("{:?}", reader.header_position());
    match writer.write(&mut reader, None) {
        Ok(_) => println!("oops"),
        Err(_) => println!("nice"),
    }
    assert_eq!(4, 4)
}

// Regression tests for `Reader::read_block`, which was refactored from a
// self-recursive implementation (risking stack overflow on runs of
// zero-length blocks) into an iterative loop. These tests exercise the
// public contract of the method directly: it must keep looping internally
// until it has real data or hits EOF, never returning early with a null
// buffer, and it must be safe to call repeatedly after EOF.
#[test]
fn read_block_accumulates_to_the_full_entry_size() {
    let tar = util::path::fixture("sample.tar.gz");
    let mut builder = reader::Builder::new();
    builder.support_format(ReadFormat::All).ok();
    builder.support_filter(ReadFilter::All).ok();
    let mut reader = builder.open_file(tar).ok().unwrap();

    // Find the first entry that actually carries data (skip directories,
    // which report a size of 0 and have no data blocks to read).
    let mut entry_size: i64 = -1;
    while let Some(entry) = reader.next_header() {
        let size = entry.size();
        if size > 0 {
            entry_size = size;
            break;
        }
    }
    assert!(
        entry_size > 0,
        "expected sample.tar.gz to contain at least one non-empty entry"
    );

    let mut total_bytes: usize = 0;
    let mut block_count: usize = 0;
    loop {
        match reader.read_block() {
            Ok(Some(block)) => {
                total_bytes += block.len();
                block_count += 1;
                // Guard against the old recursive bug regressing into an
                // unbounded loop: a small fixture archive should never take
                // an unreasonable number of blocks to drain.
                assert!(block_count < 100_000, "read_block looped unexpectedly");
            }
            Ok(None) => break,
            Err(e) => panic!("unexpected error reading block: {:?}", e),
        }
    }

    assert_eq!(total_bytes, entry_size as usize);
}

#[test]
fn read_block_returns_none_repeatedly_after_eof() {
    let tar = util::path::fixture("sample.tar.gz");
    let mut builder = reader::Builder::new();
    builder.support_format(ReadFormat::All).ok();
    builder.support_filter(ReadFilter::All).ok();
    let mut reader = builder.open_file(tar).ok().unwrap();

    reader.next_header();
    while let Ok(Some(_)) = reader.read_block() {}

    // Calling read_block again after EOF must keep returning `Ok(None)`
    // rather than erroring or hanging.
    assert!(matches!(reader.read_block(), Ok(None)));
    assert!(matches!(reader.read_block(), Ok(None)));
}
